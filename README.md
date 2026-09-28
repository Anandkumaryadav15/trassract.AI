# AI Plus Robotic website

Frontend: one responsive page in `public/index.html` (works on phones, tablets and desktops, with a mobile menu and dark mode).
Backend: Node.js + Express + SQLite in `server.js`. It saves enquiries from the form, rate-limits and validates them, and gives you a protected admin API.

## Run locally
1. Install Node.js 18 or newer.
2. `npm install`
3. `cp .env.example .env` and set `ADMIN_TOKEN` to a long random string.
4. `npm start`, then open http://localhost:3000

## See your enquiries
`curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/admin/enquiries`
Add `?format=csv` for a spreadsheet file.

## Email alerts (optional)
Fill the SMTP lines in `.env`. Each new enquiry is then emailed to `NOTIFY_TO`.

## Deploy
- **Render / Railway:** connect the repo, build `npm install`, start `npm start`, add a persistent disk mounted at `/app/data`, set `ADMIN_TOKEN`.
- **VPS:** `docker build -t aipr . && docker run -d -p 80:3000 -v aipr-data:/app/data -e ADMIN_TOKEN=... aipr`, then put HTTPS in front (Caddy or Nginx).

## Before you go live
- Replace sample prices, fees and the illustrated avatars with your real details and photos (children's photos only with parental consent).
- Add your phone, email, address and a privacy policy page.
- Add your YouTube links to the two video cards.

# trassract.AI
