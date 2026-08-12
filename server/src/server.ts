import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { buildInterviewsRouter } from "./routes/interviews";

const app = express();
app.set("trust proxy", true);
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/interviews", buildInterviewsRouter(io));

// Serve the compiled frontend (built into ../../public)
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
app.use(express.static(PUBLIC_DIR));

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(`Interview Tracker server running on http://localhost:${PORT}`);
});
