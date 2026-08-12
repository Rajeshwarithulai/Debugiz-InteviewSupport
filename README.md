# Interview Tracker

A small full-stack app for logging scheduled interviews. Built with **Node.js + Express + Socket.IO** on
the backend and **HTML / CSS / TypeScript** (no framework) on the frontend. Every submission is written to
a JSON database, broadcast live to every connected browser over WebSockets, and used to regenerate an
`interviews.xlsx` export — the spreadsheet is a **derived report**, never the source of truth, so live
updates stay fast and reliable.

```
interview-tracker/
├── server/                 Node + Express + Socket.IO API (TypeScript)
│   ├── src/
│   │   ├── server.ts        entry point
│   │   ├── db.ts            JSON database (lowdb)
│   │   ├── excelExport.ts   regenerates interviews.xlsx (exceljs)
│   │   └── routes/
│   │       └── interviews.ts  REST endpoints + file uploads (multer)
│   ├── data/                db.json + interviews.xlsx live here
│   ├── uploads/              uploaded attachments/snapshots live here
│   └── package.json
└── public/                 Static frontend served by Express
    ├── index.html
    ├── css/style.css
    ├── ts/app.ts             frontend source
    └── js/app.js             compiled output (already built and included)
```

## What it captures

Per interview: **Candidate Name, Email, Supporting By, Hired By, Candidate Mail Attachment,
Interview Link Direct Mail Snapshot.** On submit, the record is saved, the Excel file is regenerated, and
every open browser tab updates its dashboard instantly (no refresh).

## Run it locally

Requires Node.js 18+.

```bash
cd server
npm install
npm run build     # compiles server TypeScript -> dist/
npm start          # http://localhost:4000
```

The frontend's `public/js/app.js` is already compiled and committed, so you don't need a separate
frontend build step to run the app. If you edit `public/ts/app.ts`, recompile it with:

```bash
cd public/ts
npx tsc -p tsconfig.json
```

For active development with auto-reload on the server:

```bash
cd server
npm run dev
```

## Environment

- `PORT` — port the server listens on (defaults to `4000`).
- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` — optional, enables live sync
  to a real Google Sheet (see below). If unset, the app works exactly as before, just without the sheet.
- `GOOGLE_SHEET_TAB_NAME` — optional, defaults to `Interviews`.

No other configuration or external database is required — data persists to `server/data/db.json` and
files to `server/uploads/`.

## Live Google Sheet sync (optional)

Every submission can also append a row to a real Google Sheet, live, in addition to the in-app
dashboard. This is off by default — the app runs fine without it — and turns on automatically once
the three env vars below are set.

### 1. Create a Google Cloud service account

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create (or pick) a project.
2. In the search bar, open **APIs & Services → Library**, search **Google Sheets API**, click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → Service account**.
4. Give it any name (e.g. `interview-tracker-sync`) and click through to **Done** — no roles needed.
5. Click into the service account you just created → **Keys** tab → **Add Key → Create new key → JSON**.
   This downloads a `.json` file — keep it safe, you'll need two values from it in a moment:
   - `client_email`
   - `private_key`

### 2. Create the Google Sheet and share it

1. Create a new Google Sheet at [sheets.new](https://sheets.new).
2. Click **Share**, paste in the `client_email` from the JSON file (looks like
   `something@your-project.iam.gserviceaccount.com`), give it **Editor** access, and share.
3. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_SHEET_ID`**`/edit`

### 3. Set the environment variables

On Render (or whichever host), add these under **Environment**:

| Key | Value |
|---|---|
| `GOOGLE_SHEET_ID` | the Sheet ID from step 2 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | the `private_key` from the JSON key, pasted as-is (see note below) |

**Note on the private key:** it's a multi-line value like:
```
-----BEGIN PRIVATE KEY-----
MIIEvQ...
-----END PRIVATE KEY-----
```
Most hosts' env var fields accept it pasted directly with real line breaks — try that first. If your
host flattens it to one line, paste it with `\n` in place of line breaks instead
(`-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n`) — the app automatically converts
`\n` back into real newlines.

Once those three vars are set and you redeploy, the dashboard will show an **"Open Google Sheet"**
button, and every new interview submission appends a row there in real time — alongside the existing
in-app live table and the Excel export.

### Images and attachments inside the sheet

Each row's **Interview Link Direct Mail Snapshot** cell uses Google Sheets' `=IMAGE()` formula, so the
actual screenshot renders as a thumbnail directly in the cell. The **Candidate Mail Attachment** cell
uses `=HYPERLINK()`, so clicking it opens the file in a new tab.

For these to work, Google's servers need to be able to fetch the file from your app over the public
internet — the app builds the link from the request that hit it (e.g.
`https://your-app.onrender.com/api/interviews/files/xyz.png`), so this works automatically once your
app is deployed and reachable at a public URL. It won't work while running purely on `localhost`.

**Important:** uploaded files live on the server's local disk (`server/uploads/`). Most hosts, including
Render's free tier, wipe the filesystem on every redeploy — which means old thumbnails/links in the
sheet will break (and old attachments become unreachable) after your next deploy. To keep them working
long-term, attach a **persistent disk** mounted at `server/uploads` (Render: Dashboard → your service →
**Disks** → add one, mount path `/opt/render/project/src/server/uploads`, a few hundred MB is plenty).

## Deploying

This is a single Node.js service that also serves the static frontend, so any Node host works
(Render, Railway, Fly.io, an EC2/VPS box, etc). General steps:

1. Push this project to a Git repository.
2. On your host, set:
   - **Build command:** `cd server && npm install && npm run build`
   - **Start command:** `cd server && npm start`
   - **Node version:** 18 or newer
3. Attach a **persistent disk/volume** mounted at `server/data` and `server/uploads` if your host wipes
   the filesystem on redeploy (Render/Railway both support this). Without persistence, uploaded files
   and the database reset on every deploy.
4. Socket.IO uses the same HTTP server as Express, so no extra configuration is needed for WebSockets —
   just make sure your host's proxy allows WebSocket upgrades (Render/Railway do by default).

### Render.com (quick path)

1. New → Web Service → connect your repo.
2. Root directory: leave blank (repo root).
3. Build command: `cd server && npm install && npm run build`
4. Start command: `cd server && npm start`
5. Add a disk mounted at `/opt/render/project/src/server/data` (and another at `.../server/uploads`)
   so records and uploads survive redeploys.

### Docker (optional)

A minimal `Dockerfile` is included at the project root if you'd rather containerize it.

## API

| Method | Path                          | Description                              |
|--------|-------------------------------|-------------------------------------------|
| GET    | `/api/interviews`             | List all interview records                |
| GET    | `/api/interviews/people`      | Supporting/Hiring dropdown options         |
| POST   | `/api/interviews`             | Create a record (multipart form, files)    |
| GET    | `/api/interviews/export/excel`| Download the current `interviews.xlsx`     |
| GET    | `/api/interviews/files/:name` | Fetch an uploaded attachment/snapshot      |

Live updates are pushed over Socket.IO on the `interview:created` event.

## Notes / next steps

- The "Supporting By" / "Hired By" dropdown options are seeded in `server/data/db.json` under `people`.
  Edit that list (or wire up a small admin endpoint) to manage who appears there.
- File uploads are capped at 10MB each; adjust `limits.fileSize` in `server/src/routes/interviews.ts`
  if you need larger attachments.
- For multi-instance deployments (more than one server process), Socket.IO needs a shared adapter
  (e.g. `@socket.io/redis-adapter`) so live updates reach clients connected to a different instance.
  A single instance (the default here) doesn't need this.
