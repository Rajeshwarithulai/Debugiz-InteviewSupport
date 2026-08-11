"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const interviews_1 = require("./routes/interviews");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: "*" }
});
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// API routes
app.use("/api/interviews", (0, interviews_1.buildInterviewsRouter)(io));
// Serve the compiled frontend (built into ../../public)
const PUBLIC_DIR = path_1.default.join(__dirname, "..", "..", "public");
app.use(express_1.default.static(PUBLIC_DIR));
app.get("*", (_req, res) => {
    res.sendFile(path_1.default.join(PUBLIC_DIR, "index.html"));
});
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});
server.listen(PORT, () => {
    console.log(`Interview Tracker server running on http://localhost:${PORT}`);
});
