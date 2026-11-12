import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";

const FILE = new URL("./data.json", import.meta.url).pathname;
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { capsules: [], predictions: [], memories: [] });
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const clip = (s, n) => String(s || "").slice(0, n);

// Capsules: text is hidden until unlockDate; private ones only visible to their owner.
app.get("/api/capsules", (req, res) => {
  const owner = req.query.owner;
  const now = Date.now();
  const out = load().capsules
    .filter((c) => c.isPublic || c.owner === owner)
    .map((c) => {
      const unlocked = new Date(c.unlockDate).getTime() <= now;
      return { id: c.id, type: c.type, title: c.title, unlockDate: c.unlockDate, createdAt: c.createdAt,
        isPublic: c.isPublic, mine: c.owner === owner, unlocked, message: unlocked ? c.message : null };
    });
  res.json(out);
});
app.post("/api/capsules", (req, res) => {
  const { owner, type, title, message, unlockDate, isPublic, consent } = req.body;
  if (!owner || !message || !unlockDate || isNaN(new Date(unlockDate))) return res.status(400).json({ error: "Missing fields" });
  if (new Date(unlockDate) <= new Date()) return res.status(400).json({ error: "Unlock date must be in the future" });
  if (isPublic && !consent) return res.status(400).json({ error: "Public capsules need explicit consent" });
  const d = load();
  const c = { id: crypto.randomUUID(), owner, type: clip(type, 30), title: clip(title, 80) || "Untitled capsule",
    message: clip(message, 5000), unlockDate, createdAt: new Date().toISOString(), isPublic: !!isPublic && !!consent };
  d.capsules.push(c); save(d);
  res.status(201).json({ id: c.id });
});

// Predictions
app.get("/api/predictions", (_req, res) => {
  const now = Date.now();
  res.json(load().predictions.map((p) => ({ ...p, locked: new Date(p.opensAt).getTime() > now, text: new Date(p.opensAt).getTime() > now ? null : p.text })));
});
app.post("/api/predictions", (req, res) => {
  const { text, category, opensAt } = req.body;
  if (!text || !opensAt) return res.status(400).json({ error: "Missing fields" });
  const d = load();
  d.predictions.push({ id: crypto.randomUUID(), text: clip(text, 400), category: clip(category, 30), opensAt, submittedAt: new Date().toISOString() });
  save(d); res.status(201).json({ ok: true });
});

// 24-Hour Memory
app.get("/api/memories", (_req, res) => res.json(load().memories.slice(-50).reverse()));
app.post("/api/memories", (req, res) => {
  const { day, song, doing, worry, happy } = req.body;
  const d = load();
  d.memories.push({ id: crypto.randomUUID(), day, song: clip(song, 100), doing: clip(doing, 200), worry: clip(worry, 200), happy: clip(happy, 200) });
  save(d); res.status(201).json({ ok: true });
});

app.listen(4000, () => console.log("CHRONO API on http://localhost:4000"));
