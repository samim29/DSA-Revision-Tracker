import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

const INTERVALS = [1, 3, 7, 21, 45, 90]; // revision gaps in days
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (s, n) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ---------- models ---------- */
const User = mongoose.model("User", new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true, trim: true },
  hash: String,
  patterns: { type: [String], default: [] },
  log: { type: [String], default: [] }, // days on which the user revised (for streak)
}));

const Problem = mongoose.model("Problem", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  pattern: String, title: String, link: String,
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
  approach: String, code: String, tc: String, sc: String, mistakes: String,
  stage: { type: Number, default: 0 },
  last: String, next: String,
  history: [{ date: String, rating: String, _id: false }],
}, { timestamps: true }));

/* ---------- helpers ---------- */
const FIELDS = ["pattern", "title", "link", "difficulty", "approach", "code", "tc", "sc", "mistakes"];
const pick = (b) => Object.fromEntries(
  FIELDS.filter((k) => typeof b[k] === "string").map((k) => [k, b[k].slice(0, k === "code" ? 20000 : 3000)])
);
const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const auth = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(id);
    if (!req.user) throw new Error("no user");
    next();
  } catch {
    res.status(401).json({ error: "Please log in to continue." });
  }
};

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: "100kb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });
const credentials = (req) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  return { email, password, ok: /^\S+@\S+\.\S+$/.test(email) && password.length >= 6 };
};

app.post("/api/auth/signup", limiter, wrap(async (req, res) => {
  const { email, password, ok } = credentials(req);
  if (!ok) return res.status(400).json({ error: "Enter a valid email and a password of at least 6 characters." });
  if (await User.findOne({ email })) return res.status(409).json({ error: "That email is already registered. Try logging in." });
  const user = await User.create({ email, hash: await bcrypt.hash(password, 10) });
  res.json({ token: sign(user) });
}));

app.post("/api/auth/login", limiter, wrap(async (req, res) => {
  const { email, password } = credentials(req);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.hash))) return res.status(401).json({ error: "Wrong email or password." });
  res.json({ token: sign(user) });
}));

app.get("/api/me", auth, (req, res) => {
  const { email, patterns, log } = req.user;
  res.json({ email, patterns, log });
});

app.get("/api/problems", auth, wrap(async (req, res) => {
  res.json(await Problem.find({ user: req.user._id }).sort({ createdAt: -1 }));
}));

app.post("/api/problems", auth, wrap(async (req, res) => {
  const data = pick(req.body);
  if (!data.title?.trim() || !data.pattern?.trim()) return res.status(400).json({ error: "Title and pattern are required." });
  if (!DAY.test(req.body.today)) return res.status(400).json({ error: "Missing date." });
  const problem = await Problem.create({
    ...data, user: req.user._id, stage: 0,
    last: req.body.today, next: addDays(req.body.today, INTERVALS[0]),
  });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { patterns: data.pattern } });
  res.json(problem);
}));

app.put("/api/problems/:id", auth, wrap(async (req, res) => {
  const data = pick(req.body);
  const problem = await Problem.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true });
  if (!problem) return res.status(404).json({ error: "Problem not found." });
  if (data.pattern) await User.updateOne({ _id: req.user._id }, { $addToSet: { patterns: data.pattern } });
  res.json(problem);
}));

app.delete("/api/problems/:id", auth, wrap(async (req, res) => {
  await Problem.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
}));

// The server decides the next revision date, based on the self-rating.
app.post("/api/problems/:id/rate", auth, wrap(async (req, res) => {
  const { rating, today } = req.body;
  if (!["Easy", "Medium", "Hard"].includes(rating) || !DAY.test(today)) return res.status(400).json({ error: "Invalid rating." });
  const p = await Problem.findOne({ _id: req.params.id, user: req.user._id });
  if (!p) return res.status(404).json({ error: "Problem not found." });
  p.stage = rating === "Easy" ? Math.min(p.stage + 1, INTERVALS.length - 1) : rating === "Hard" ? 0 : p.stage;
  p.next = addDays(today, INTERVALS[p.stage]);
  p.last = today;
  p.history.push({ date: today, rating });
  await p.save();
  await User.updateOne({ _id: req.user._id }, { $addToSet: { log: today } });
  res.json(p);
}));

app.post("/api/patterns", auth, wrap(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Pattern name is required." });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { patterns: name } });
  res.json({ ok: true });
}));

app.delete("/api/patterns/:name", auth, wrap(async (req, res) => {
  await Problem.deleteMany({ user: req.user._id, pattern: req.params.name });
  await User.updateOne({ _id: req.user._id }, { $pull: { patterns: req.params.name } });
  res.json({ ok: true });
}));

/* ---------- serve the React build in production ---------- */
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => (req.path.startsWith("/api") ? next() : res.sendFile(path.join(dist, "index.html"))));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.name === "CastError" ? 400 : 500).json({ error: "Something went wrong. Please try again." });
});

await mongoose.connect(process.env.MONGO_URI);
app.listen(process.env.PORT || 5000, () => console.log("Revisit server running"));
