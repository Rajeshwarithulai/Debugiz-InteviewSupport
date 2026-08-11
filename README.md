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

No other configuration or external database is required — data persists to `server/data/db.json` and
files to `server/uploads/`.

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
