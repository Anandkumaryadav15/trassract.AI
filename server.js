require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'enquiries.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS enquiries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
  interest TEXT NOT NULL, message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
const insert = db.prepare('INSERT INTO enquiries(name,phone,email,interest,message) VALUES(?,?,?,?,?)');

// Optional email notification: set SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_TO in .env
let mailer = null;
if (process.env.SMTP_HOST && process.env.NOTIFY_TO) {
  mailer = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"], upgradeInsecureRequests: null } },
}));
app.use(express.json({ limit: '10kb' }));

const enquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' } });

const INTERESTS = ['Setting up a lab', 'Robotics classes', 'AI classes'];
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/enquiries', enquiryLimiter, (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill this hidden field
  const name = clean(b.name, 100), phone = clean(b.phone, 20), email = clean(b.email, 150);
  const interest = INTERESTS.includes(b.interest) ? b.interest : INTERESTS[0];
  const message = clean(b.message, 1000);
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[0-9+\-\s]{8,20}$/.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  insert.run(name, phone, email, interest, message);
  if (mailer) mailer.sendMail({ from: process.env.SMTP_USER, to: process.env.NOTIFY_TO,
    subject: `New enquiry: ${interest}`, text: `${name}\n${phone}\n${email}\n${interest}\n\n${message}` })
    .catch(err => console.error('Email failed:', err.message));
  res.status(201).json({ ok: true });
});

function admin(req, res, next) {
  const given = Buffer.from((req.get('authorization') || '').replace(/^Bearer /, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  if (!ADMIN_TOKEN || given.length !== want.length || !crypto.timingSafeEqual(given, want))
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}
app.get('/api/admin/enquiries', admin, (req, res) => {
  const rows = db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 1000').all();
  if (req.query.format !== 'csv') return res.json(rows);
  const q = v => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
  const head = 'id,name,phone,email,interest,message,created_at';
  res.type('text/csv').send([head, ...rows.map(r => [r.id, r.name, r.phone, r.email, r.interest, r.message, r.created_at].map(q).join(','))].join('\n'));
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => console.log(`AI Plus Robotic running on http://localhost:${PORT}`));
