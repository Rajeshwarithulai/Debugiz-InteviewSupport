import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { Server as SocketIOServer } from "socket.io";
import { readDb, writeDb } from "../db";
import { Interview } from "../types";
import { generateExcel, getExcelPath } from "../excelExport";
import { appendInterviewRow, getSheetUrl, isGoogleSheetsConfigured } from "../googleSheets";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
});

export function buildInterviewsRouter(io: SocketIOServer): Router {
  const router = Router();

  // List all interviews (most recent first)
  router.get("/", (_req: Request, res: Response) => {
    const db = readDb();
    const interviews = [...db.interviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ interviews });
  });

  // Dropdown source lists (Supporting By / Hired By)
  router.get("/people", (_req: Request, res: Response) => {
    const db = readDb();
    res.json(db.people);
  });

  // Lets the frontend know whether a live Google Sheet is wired up, and its link
  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      googleSheetsConnected: isGoogleSheetsConfigured(),
      googleSheetUrl: getSheetUrl()
    });
  });

  // Create a new interview record
  router.post(
    "/",
    upload.fields([
      { name: "candidateMailAttachment", maxCount: 1 },
      { name: "interviewSnapshot", maxCount: 1 }
    ]),
    async (req: Request, res: Response) => {
      try {
        const { candidateName, email, supportingBy, hiredBy } = req.body;

        if (!candidateName || !email || !supportingBy || !hiredBy) {
          return res.status(400).json({ error: "Missing required fields." });
        }

        const files = req.files as
          | { [fieldname: string]: Express.Multer.File[] }
          | undefined;

        const attachment = files?.candidateMailAttachment?.[0]?.filename || null;
        const snapshot = files?.interviewSnapshot?.[0]?.filename || null;

        const record: Interview = {
          id: uuidv4(),
          candidateName: String(candidateName).trim(),
          email: String(email).trim(),
          supportingBy: String(supportingBy).trim(),
          hiredBy: String(hiredBy).trim(),
          candidateMailAttachment: attachment,
          interviewSnapshot: snapshot,
          createdAt: new Date().toISOString()
        };

        const db = readDb();
        db.interviews.push(record);
        writeDb(db);

        // Regenerate excel snapshot on every write, then broadcast live update
        await generateExcel(db.interviews);

        // Best-effort live sync to Google Sheets - never blocks or fails the save
        // if Sheets isn't configured or the API call has a hiccup.
        try {
          await appendInterviewRow(record);
        } catch (sheetErr) {
          console.error("Google Sheets sync failed:", sheetErr);
        }

        io.emit("interview:created", record);

        res.status(201).json({ interview: record });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save interview." });
      }
    }
  );

  // Download the always-fresh Excel export
  router.get("/export/excel", async (_req: Request, res: Response) => {
    const db = readDb();
    await generateExcel(db.interviews);
    res.download(getExcelPath(), "interviews.xlsx");
  });

  // Serve uploaded files (attachments / snapshots)
  router.get("/files/:filename", (req: Request, res: Response) => {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }
    res.sendFile(filePath);
  });

  return router;
}
