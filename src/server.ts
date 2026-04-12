import express from "express";
import path from "path";
import { loadConfig, saveConfig, BotConfig, SiteEntry } from "./config";

const app = express();
const PORT = parseInt(process.env.SETUP_PORT ?? "3456", 10);

app.use(express.json());

// ─── API ───

app.get("/api/config", (_req, res) => {
  res.json(loadConfig());
});

app.put("/api/config", (req, res) => {
  const config: BotConfig = req.body;
  saveConfig(config);
  res.json({ ok: true });
});

// ─── HTML ───

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "src", "setup.html"));
});

app.listen(PORT, () => {
  console.log(`\n  設定画面を開いてください: http://localhost:${PORT}\n`);
});
