"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExcel = generateExcel;
exports.getExcelPath = getExcelPath;
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const EXPORT_DIR = path_1.default.join(__dirname, "..", "data");
const EXPORT_FILE = path_1.default.join(EXPORT_DIR, "interviews.xlsx");
/**
 * Regenerates the Excel workbook from the current list of interview records.
 * The database (JSON) is always the source of truth; this file is a derived
 * snapshot so it can safely be rebuilt any time.
 */
async function generateExcel(interviews) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = "Interview Tracker";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Interviews", {
        views: [{ state: "frozen", ySplit: 1 }]
    });
    sheet.columns = [
        { header: "Candidate Name", key: "candidateName", width: 24 },
        { header: "Email", key: "email", width: 30 },
        { header: "Supporting By", key: "supportingBy", width: 20 },
        { header: "Hired By", key: "hiredBy", width: 20 },
        { header: "Candidate Mail Attachment", key: "candidateMailAttachment", width: 30 },
        { header: "Interview Link Direct Mail Snapshot", key: "interviewSnapshot", width: 34 },
        { header: "Submitted At", key: "createdAt", width: 22 }
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2A44" }
    };
    sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });
    interviews.forEach((iv) => {
        sheet.addRow({
            candidateName: iv.candidateName,
            email: iv.email,
            supportingBy: iv.supportingBy,
            hiredBy: iv.hiredBy,
            candidateMailAttachment: iv.candidateMailAttachment || "-",
            interviewSnapshot: iv.interviewSnapshot || "-",
            createdAt: new Date(iv.createdAt).toLocaleString()
        });
    });
    if (!fs_1.default.existsSync(EXPORT_DIR)) {
        fs_1.default.mkdirSync(EXPORT_DIR, { recursive: true });
    }
    await workbook.xlsx.writeFile(EXPORT_FILE);
    return EXPORT_FILE;
}
function getExcelPath() {
    return EXPORT_FILE;
}
