"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDb = readDb;
exports.writeDb = writeDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, "..", "data");
const DB_FILE = path_1.default.join(DATA_DIR, "db.json");
const DEFAULTS = {
    interviews: [],
    people: {
        supporting: ["Vignesh", "Sudha", "Ganesh", "Priya"],
        hiring: ["Sudha", "Ganesh", "Ramesh", "Kavitha"]
    }
};
function ensureDbFile() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(DB_FILE)) {
        fs_1.default.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2), "utf-8");
    }
}
/** Reads the whole database from disk. Cheap enough at this data scale. */
function readDb() {
    ensureDbFile();
    const raw = fs_1.default.readFileSync(DB_FILE, "utf-8");
    try {
        const parsed = JSON.parse(raw);
        return {
            interviews: parsed.interviews ?? [],
            people: {
                supporting: parsed.people?.supporting ?? DEFAULTS.people.supporting,
                hiring: parsed.people?.hiring ?? DEFAULTS.people.hiring
            }
        };
    }
    catch {
        // Corrupt or empty file - reset to defaults rather than crash the server.
        fs_1.default.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2), "utf-8");
        return DEFAULTS;
    }
}
/** Writes the whole database to disk. */
function writeDb(data) {
    ensureDbFile();
    fs_1.default.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}
ensureDbFile();
