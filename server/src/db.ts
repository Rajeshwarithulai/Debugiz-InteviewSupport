import fs from "fs";
import path from "path";
import { DbSchema } from "./types";

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULTS: DbSchema = {
  interviews: [],
  people: {
    supporting: ["Mam","Raji",
"Pravin",
"Santhosh",
"Kabin",
"Dhinakaran"
"siva",
"viswa",
"abi",
"shiva kumar"],
    hiring: ["Mam","Raji",
"pravin",
"santhosh",
"Kabin",
"Dhinakaran"
"siva",
"viswa",
"abi",
"shiva kumar"]
  }
};

function ensureDbFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2), "utf-8");
  }
}

/** Reads the whole database from disk. Cheap enough at this data scale. */
export function readDb(): DbSchema {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<DbSchema>;
    return {
      interviews: parsed.interviews ?? [],
      people: {
        supporting: parsed.people?.supporting ?? DEFAULTS.people.supporting,
        hiring: parsed.people?.hiring ?? DEFAULTS.people.hiring
      }
    };
  } catch {
    // Corrupt or empty file - reset to defaults rather than crash the server.
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2), "utf-8");
    return DEFAULTS;
  }
}

/** Writes the whole database to disk. */
export function writeDb(data: DbSchema): void {
  ensureDbFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

ensureDbFile();
