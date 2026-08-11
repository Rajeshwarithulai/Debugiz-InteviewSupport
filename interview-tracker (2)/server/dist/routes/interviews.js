"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInterviewsRouter = buildInterviewsRouter;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const db_1 = require("../db");
const excelExport_1 = require("../excelExport");
const UPLOAD_DIR = path_1.default.join(__dirname, "..", "..", "uploads");
if (!fs_1.default.existsSync(UPLOAD_DIR))
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, unique);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
});
function buildInterviewsRouter(io) {
    const router = (0, express_1.Router)();
    // List all interviews (most recent first)
    router.get("/", (_req, res) => {
        const db = (0, db_1.readDb)();
        const interviews = [...db.interviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ interviews });
    });
    // Dropdown source lists (Supporting By / Hired By)
    router.get("/people", (_req, res) => {
        const db = (0, db_1.readDb)();
        res.json(db.people);
    });
    // Create a new interview record
    router.post("/", upload.fields([
        { name: "candidateMailAttachment", maxCount: 1 },
        { name: "interviewSnapshot", maxCount: 1 }
    ]), async (req, res) => {
        try {
            const { candidateName, email, supportingBy, hiredBy } = req.body;
            if (!candidateName || !email || !supportingBy || !hiredBy) {
                return res.status(400).json({ error: "Missing required fields." });
            }
            const files = req.files;
            const attachment = files?.candidateMailAttachment?.[0]?.filename || null;
            const snapshot = files?.interviewSnapshot?.[0]?.filename || null;
            const record = {
                id: (0, uuid_1.v4)(),
                candidateName: String(candidateName).trim(),
                email: String(email).trim(),
                supportingBy: String(supportingBy).trim(),
                hiredBy: String(hiredBy).trim(),
                candidateMailAttachment: attachment,
                interviewSnapshot: snapshot,
                createdAt: new Date().toISOString()
            };
            const db = (0, db_1.readDb)();
            db.interviews.push(record);
            (0, db_1.writeDb)(db);
            // Regenerate excel snapshot on every write, then broadcast live update
            await (0, excelExport_1.generateExcel)(db.interviews);
            io.emit("interview:created", record);
            res.status(201).json({ interview: record });
        }
        catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to save interview." });
        }
    });
    // Download the always-fresh Excel export
    router.get("/export/excel", async (_req, res) => {
        const db = (0, db_1.readDb)();
        await (0, excelExport_1.generateExcel)(db.interviews);
        res.download((0, excelExport_1.getExcelPath)(), "interviews.xlsx");
    });
    // Serve uploaded files (attachments / snapshots)
    router.get("/files/:filename", (req, res) => {
        const filePath = path_1.default.join(UPLOAD_DIR, req.params.filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found." });
        }
        res.sendFile(filePath);
    });
    return router;
}
