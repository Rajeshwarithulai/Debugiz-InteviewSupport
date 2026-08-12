import { google } from "googleapis";
import { Interview } from "./types";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
// Render (and most hosts) store multi-line env vars with literal "\n" - convert back to real newlines.
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const SHEET_TAB_NAME = process.env.GOOGLE_SHEET_TAB_NAME || "Interviews";

const HEADER_ROW = [
  "Candidate Name",
  "Email",
  "Supporting By",
  "Hired By",
  "Candidate Mail Attachment",
  "Interview Link Direct Mail Snapshot",
  "Submitted At"
];

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let headerEnsured = false;

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(SHEET_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);
}

export function getSheetUrl(): string | null {
  if (!SHEET_ID) return null;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
}

function getClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function ensureHeaderRow(): Promise<void> {
  if (headerEnsured) return;
  const sheets = getClient();

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB_NAME}!A1:G1`
  });

  const hasHeader = existing.data.values && existing.data.values.length > 0;

  if (!hasHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB_NAME}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] }
    });
  }

  headerEnsured = true;
}

/**
 * Appends one interview record as a new row at the bottom of the sheet.
 * Safe to call even if Google Sheets isn't configured - it just no-ops.
 */
export async function appendInterviewRow(interview: Interview): Promise<void> {
  if (!isGoogleSheetsConfigured()) return;

  const sheets = getClient();
  await ensureHeaderRow();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          interview.candidateName,
          interview.email,
          interview.supportingBy,
          interview.hiredBy,
          interview.candidateMailAttachment || "-",
          interview.interviewSnapshot || "-",
          new Date(interview.createdAt).toLocaleString()
        ]
      ]
    }
  });
}
