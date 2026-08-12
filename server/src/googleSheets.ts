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
let cachedSheetGridId: number | null = null;

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

async function getSheetGridId(): Promise<number | null> {
  if (cachedSheetGridId !== null) return cachedSheetGridId;
  const sheets = getClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const match = meta.data.sheets?.find((s) => s.properties?.title === SHEET_TAB_NAME);
  cachedSheetGridId = match?.properties?.sheetId ?? null;
  return cachedSheetGridId;
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

  // Widen the snapshot column once so IMAGE() thumbnails aren't squashed to a sliver.
  // Best-effort - if it fails (e.g. permissions edge case), row content still works fine.
  try {
    const gridId = await getSheetGridId();
    if (gridId !== null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [
            {
              updateDimensionProperties: {
                range: { sheetId: gridId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 },
                properties: { pixelSize: 160 },
                fields: "pixelSize"
              }
            }
          ]
        }
      });
    }
  } catch {
    // Formatting is cosmetic - never let it block data sync.
  }

  headerEnsured = true;
}

/**
 * Appends one interview record as a new row at the bottom of the sheet.
 * Safe to call even if Google Sheets isn't configured - it just no-ops.
 *
 * `fileBaseUrl` is the app's own public origin (e.g. https://your-app.onrender.com),
 * used to build links Google Sheets can actually fetch/display. Uploaded files must
 * be reachable at that origin - if the server is only running on localhost, Sheets
 * cannot load the image and the cell will show a broken-image icon instead.
 */
export async function appendInterviewRow(interview: Interview, fileBaseUrl: string): Promise<void> {
  if (!isGoogleSheetsConfigured()) return;

  const sheets = getClient();
  await ensureHeaderRow();

  const attachmentUrl = interview.candidateMailAttachment
    ? `${fileBaseUrl}/api/interviews/files/${interview.candidateMailAttachment}`
    : null;
  const snapshotUrl = interview.interviewSnapshot
    ? `${fileBaseUrl}/api/interviews/files/${interview.interviewSnapshot}`
    : null;

  // HYPERLINK for the attachment (any file type - opens in a new tab).
  // IMAGE for the snapshot (renders as an actual thumbnail inside the cell, since
  // the upload field is restricted to image files).
  const attachmentCell = attachmentUrl
    ? `=HYPERLINK("${attachmentUrl}", "Open attachment")`
    : "-";
  const snapshotCell = snapshotUrl
    ? `=HYPERLINK("${snapshotUrl}", "Open attachment")`
    : "-";

  const appendResult = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED", // required so formulas are evaluated, not stored as literal text
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          interview.candidateName,
          interview.email,
          interview.supportingBy,
          interview.hiredBy,
          attachmentCell,
          snapshotCell,
          new Date(interview.createdAt).toLocaleString()
        ]
      ]
    }
  });

  // Give the new row extra height so the IMAGE() thumbnail isn't cropped to a sliver.
  // Best-effort - purely cosmetic, never blocks the data write above.
  if (snapshotUrl) {
    try {
      const updatedRange = appendResult.data.updates?.updatedRange; // e.g. "Interviews!A5:G5"
      const rowMatch = updatedRange?.match(/(\d+)(?::[A-Z]+\d+)?$/);
      const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : null;
      const gridId = await getSheetGridId();

      if (rowNumber && gridId !== null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId: gridId,
                    dimension: "ROWS",
                    startIndex: rowNumber - 1,
                    endIndex: rowNumber
                  },
                  properties: { pixelSize: 120 },
                  fields: "pixelSize"
                }
              }
            ]
          }
        });
      }
    } catch {
      // Cosmetic only - ignore failures here.
    }
  }
}
