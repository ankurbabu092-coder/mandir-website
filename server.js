"use strict";

require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { DatabaseSync } = require("node:sqlite");
const rateLimit = require("express-rate-limit");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 5500);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = "temple_admin_token";
const CSRF_COOKIE = "temple_csrf";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET is required and must be at least 32 characters. Copy .env.example to .env first.");
}
if (!process.env.OWNER_IDENTIFIER || !process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD.length < 12) {
  throw new Error("OWNER_IDENTIFIER and OWNER_PASSWORD are required. OWNER_PASSWORD must be at least 12 characters.");
}
if (process.env.OWNER_PASSWORD.startsWith("replace-with")) {
  throw new Error("Replace the placeholder owner credentials in .env before starting the server.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "temple.sqlite"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
    can_manage_admins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login TEXT
  );
  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    notice_date TEXT,
    important INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS companions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'मंदिर',
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS donors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const cleanText = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const cleanIdentifier = value => cleanText(value, 160).toLowerCase();
const validIdentifier = value => /^(?:\+?[0-9][0-9\s()-]{6,19}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(value);
const bool = value => value === true || value === "true" || value === 1 || value === "1" || value === "on";
const idOf = value => Number.isInteger(Number(value)) ? Number(value) : 0;
const publicUser = user => ({
  id: user.id,
  name: user.name,
  identifier: user.login_id,
  role: user.role,
  canManageAdmins: Boolean(user.can_manage_admins)
});
const publicNotice = notice => ({
  id: notice.id,
  title: notice.title,
  body: notice.body,
  date: notice.notice_date,
  important: Boolean(notice.important),
  published: Boolean(notice.published)
});
const publicCompanion = item => ({
  id: item.id,
  name: item.name,
  role: item.role,
  bio: item.bio,
  photoUrl: item.photo_url
});
const publicGallery = item => ({
  id: item.id,
  imageUrl: item.image_url,
  caption: item.caption,
  category: item.category
});
const publicDonor = donor => ({ id: donor.id, name: donor.name });

const DEFAULT_SETTINGS = Object.freeze({
  darshan_message: "आज श्री राम जानकी के दर्शन से मन में शांति और सेवा का संकल्प जगाएं।",
  darshan_image_url: "/assets/asset-9.jpg",
  morning_message: "सुप्रभात। प्रभु का नाम लेकर आज का दिन प्रेम, धैर्य और भक्ति से शुरू करें।",
  morning_image_url: "/assets/asset-1.jpg",
  today_message: "जहां भक्ति होती है, वहां मन को ठहरने का रास्ता मिल जाता है।",
  today_message_author: "श्री राम जानकी मंदिर",
  donation_total: "0",
  live_active: "false",
  live_url: "",
  live_title: "बाबा अभी Live नहीं हैं",
  live_message: "जब live दर्शन उपलब्ध होंगे, समिति यहां link सक्रिय करेगी।"
});

function upsertSetting(key, value) {
  db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, String(value), now());
}

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  if (!db.prepare("SELECT key FROM site_settings WHERE key = ?").get(key)) upsertSetting(key, value);
}

function readSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  db.prepare("SELECT key, value FROM site_settings").all().forEach(item => { settings[item.key] = item.value; });
  return settings;
}

function clientSettings(settings) {
  return {
    darshan: { message: settings.darshan_message, imageUrl: settings.darshan_image_url },
    morning: { message: settings.morning_message, imageUrl: settings.morning_image_url },
    message: { body: settings.today_message, author: settings.today_message_author },
    donation: { total: Number(settings.donation_total) || 0 },
    live: {
      active: bool(settings.live_active),
      url: settings.live_url,
      title: settings.live_title,
      message: settings.live_message
    }
  };
}

function adminSettings(settings) {
  return {
    darshanMessage: settings.darshan_message,
    darshanImageUrl: settings.darshan_image_url,
    morningMessage: settings.morning_message,
    morningImageUrl: settings.morning_image_url,
    todayMessage: settings.today_message,
    todayMessageAuthor: settings.today_message_author,
    donationTotal: Number(settings.donation_total) || 0,
    liveActive: bool(settings.live_active),
    liveUrl: settings.live_url,
    liveTitle: settings.live_title,
    liveMessage: settings.live_message
  };
}

function validHttpUrl(value) {
  return !value || /^https?:\/\/\S+$/i.test(value);
}

function cleanDonationTotal(value) {
  const amount = cleanText(value, 16).replace(/[₹,\s]/g, "");
  if (!/^\d{1,12}$/.test(amount)) throw new HttpError(400, "Donation total में केवल 0 से 999999999999 तक की राशि भरें");
  return String(Number(amount));
}

const ownerIdentifier = cleanIdentifier(process.env.OWNER_IDENTIFIER);
if (!validIdentifier(ownerIdentifier)) {
  throw new Error("OWNER_IDENTIFIER must be a private phone number or email address.");
}
const ownerName = cleanText(process.env.OWNER_NAME || "Ankur Chauhan", 120) || "Ankur Chauhan";
const owner = db.prepare("SELECT * FROM users WHERE login_id = ?").get(ownerIdentifier);
if (!owner) {
  const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD, 12);
  db.prepare("INSERT INTO users (name, login_id, password_hash, role, can_manage_admins, created_at) VALUES (?, ?, ?, 'owner', 1, ?)")
    .run(ownerName, ownerIdentifier, hash, now());
} else if (owner.role !== "owner" || !owner.can_manage_admins) {
  db.prepare("UPDATE users SET role = 'owner', can_manage_admins = 1 WHERE id = ?").run(owner.id);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "बहुत अधिक login प्रयास हुए हैं। 15 मिनट बाद फिर प्रयास करें।" }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    callback(null, allowed.has(file.mimetype));
  }
});

const cookieOptions = { httpOnly: true, sameSite: "lax", secure: IS_PRODUCTION, maxAge: 8 * 60 * 60 * 1000, path: "/" };
function issueSession(res, user) {
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.SESSION_SECRET, { expiresIn: "8h" });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.cookie(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: "lax", secure: IS_PRODUCTION, maxAge: cookieOptions.maxAge, path: "/" });
  return csrfToken;
}

function auth(req, _res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) throw new HttpError(401, "Login required");
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(payload.sub));
    if (!user) throw new HttpError(401, "Session expired");
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Session expired"));
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user || !["owner", "admin"].includes(req.user.role)) return next(new HttpError(403, "Admin permission required"));
  next();
}

function requireAdminManager(req, _res, next) {
  if (!req.user || (req.user.role !== "owner" && !req.user.can_manage_admins)) return next(new HttpError(403, "Admin-management permission required"));
  next();
}

function verifySameOriginAndCsrf(req, _res, next) {
  const origin = req.get("origin");
  const expected = `${req.protocol}://${req.get("host")}`;
  if (origin && origin !== expected) return next(new HttpError(403, "Invalid request origin"));
  if (!req.cookies[CSRF_COOKIE] || req.get("x-csrf-token") !== req.cookies[CSRF_COOKIE]) {
    return next(new HttpError(403, "Invalid CSRF token"));
  }
  next();
}

function requireFields(values, fields) {
  for (const field of fields) if (!cleanText(values[field])) throw new HttpError(400, `${field} is required`);
}

function isImageBuffer(file) {
  if (!file?.buffer) return false;
  const b = file.buffer;
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    || (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50);
}

function saveImage(file, prefix) {
  if (!file || !isImageBuffer(file)) throw new HttpError(400, "Only valid JPG, PNG or WebP images are allowed");
  const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer, { flag: "wx" });
  return `/uploads/${filename}`;
}

function removeUpload(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const filename = path.basename(url);
  const fullPath = path.join(UPLOAD_DIR, filename);
  if (fullPath.startsWith(UPLOAD_DIR) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

app.post("/api/auth/login", loginLimiter, (req, res, next) => {
  try {
    const identifier = cleanIdentifier(req.body.identifier);
    const password = String(req.body.password || "");
    if (!identifier || !password) throw new HttpError(400, "Login ID और password दोनों भरें");
    if (!validIdentifier(identifier)) throw new HttpError(400, "Valid private phone number या email भरें");
    const user = db.prepare("SELECT * FROM users WHERE login_id = ?").get(identifier);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) throw new HttpError(401, "Login details सही नहीं हैं");
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now(), user.id);
    const csrfToken = issueSession(res, user);
    res.json({ user: publicUser(user), csrfToken });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user), csrfToken: req.cookies[CSRF_COOKIE] || null }));
app.post("/api/auth/logout", auth, verifySameOriginAndCsrf, (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, sameSite: "lax", secure: IS_PRODUCTION, path: "/" });
  res.json({ ok: true });
});

app.get("/api/public/content", (_req, res) => {
  const notices = db.prepare("SELECT * FROM notices WHERE published = 1 ORDER BY important DESC, COALESCE(notice_date, created_at) DESC").all().map(publicNotice);
  const companions = db.prepare("SELECT * FROM companions ORDER BY created_at DESC").all().map(publicCompanion);
  const gallery = db.prepare("SELECT * FROM gallery WHERE published = 1 ORDER BY created_at DESC").all().map(publicGallery);
  const donors = db.prepare("SELECT id, name FROM donors WHERE published = 1 ORDER BY created_at DESC").all().map(publicDonor);
  res.json({ notices, companions, gallery, donors, settings: clientSettings(readSettings()) });
});

app.get("/api/admin/dashboard", auth, requireAdmin, (_req, res) => {
  const count = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  res.json({ notices: count("notices"), companions: count("companions"), gallery: count("gallery"), donors: count("donors"), admins: count("users") - 1 });
});

app.get("/api/admin/settings", auth, requireAdmin, (_req, res) => {
  res.json({ settings: adminSettings(readSettings()) });
});

app.put("/api/admin/settings", auth, requireAdmin, verifySameOriginAndCsrf, upload.fields([
  { name: "darshanImage", maxCount: 1 },
  { name: "morningImage", maxCount: 1 }
]), (req, res, next) => {
  const current = readSettings();
  const files = req.files || {};
  const replacements = [];
  try {
    const liveUrl = cleanText(req.body.liveUrl, 500);
    if (!validHttpUrl(liveUrl)) throw new HttpError(400, "Live link केवल http या https URL होना चाहिए");
    const updates = {
      darshan_message: cleanText(req.body.darshanMessage, 1000) || DEFAULT_SETTINGS.darshan_message,
      morning_message: cleanText(req.body.morningMessage, 1000) || DEFAULT_SETTINGS.morning_message,
      today_message: cleanText(req.body.todayMessage, 1000) || DEFAULT_SETTINGS.today_message,
      today_message_author: cleanText(req.body.todayMessageAuthor, 120) || DEFAULT_SETTINGS.today_message_author,
      donation_total: cleanDonationTotal(req.body.donationTotal || "0"),
      live_active: bool(req.body.liveActive) ? "true" : "false",
      live_url: liveUrl,
      live_title: cleanText(req.body.liveTitle, 160) || DEFAULT_SETTINGS.live_title,
      live_message: cleanText(req.body.liveMessage, 500) || DEFAULT_SETTINGS.live_message
    };
    if (files.darshanImage?.[0]) {
      updates.darshan_image_url = saveImage(files.darshanImage[0], "darshan");
      replacements.push(current.darshan_image_url);
    }
    if (files.morningImage?.[0]) {
      updates.morning_image_url = saveImage(files.morningImage[0], "morning");
      replacements.push(current.morning_image_url);
    }
    for (const [key, value] of Object.entries(updates)) upsertSetting(key, value);
    replacements.forEach(removeUpload);
    res.json({ settings: adminSettings(readSettings()) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/donors", auth, requireAdmin, (_req, res) => {
  res.json({ donors: db.prepare("SELECT id, name, published FROM donors ORDER BY updated_at DESC").all().map(item => ({ ...publicDonor(item), published: Boolean(item.published) })) });
});

app.post("/api/admin/donors", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    requireFields(req.body, ["name"]);
    const timestamp = now();
    const result = db.prepare("INSERT INTO donors (name, published, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(cleanText(req.body.name, 120), bool(req.body.published) ? 1 : 0, timestamp, timestamp);
    const donor = db.prepare("SELECT id, name, published FROM donors WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ donor: { ...publicDonor(donor), published: Boolean(donor.published) } });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/donors/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["name"]);
    if (!db.prepare("SELECT id FROM donors WHERE id = ?").get(id)) throw new HttpError(404, "Donor नहीं मिला");
    db.prepare("UPDATE donors SET name = ?, published = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.name, 120), bool(req.body.published) ? 1 : 0, now(), id);
    const donor = db.prepare("SELECT id, name, published FROM donors WHERE id = ?").get(id);
    res.json({ donor: { ...publicDonor(donor), published: Boolean(donor.published) } });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/donors/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM donors WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Donor नहीं मिला");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/notices", auth, requireAdmin, (_req, res) => {
  res.json({ notices: db.prepare("SELECT * FROM notices ORDER BY updated_at DESC").all().map(publicNotice) });
});

app.post("/api/admin/notices", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    requireFields(req.body, ["title", "body"]);
    const timestamp = now();
    const result = db.prepare("INSERT INTO notices (title, body, notice_date, important, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(cleanText(req.body.title, 160), cleanText(req.body.body, 2000), cleanText(req.body.date, 40) || null, bool(req.body.important) ? 1 : 0, bool(req.body.published) ? 1 : 0, timestamp, timestamp);
    res.status(201).json({ notice: publicNotice(db.prepare("SELECT * FROM notices WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/notices/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["title", "body"]);
    const existing = db.prepare("SELECT id FROM notices WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, "Notice नहीं मिला");
    db.prepare("UPDATE notices SET title = ?, body = ?, notice_date = ?, important = ?, published = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.title, 160), cleanText(req.body.body, 2000), cleanText(req.body.date, 40) || null, bool(req.body.important) ? 1 : 0, bool(req.body.published) ? 1 : 0, now(), id);
    res.json({ notice: publicNotice(db.prepare("SELECT * FROM notices WHERE id = ?").get(id)) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/notices/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM notices WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Notice नहीं मिला");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/companions", auth, requireAdmin, (_req, res) => {
  res.json({ companions: db.prepare("SELECT * FROM companions ORDER BY created_at DESC").all().map(publicCompanion) });
});

app.post("/api/admin/companions", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("photo"), (req, res, next) => {
  try {
    requireFields(req.body, ["name", "role"]);
    const photoUrl = req.file ? saveImage(req.file, "companion") : null;
    const result = db.prepare("INSERT INTO companions (name, role, bio, photo_url, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(cleanText(req.body.name, 120), cleanText(req.body.role, 160), cleanText(req.body.bio, 500), photoUrl, now());
    res.status(201).json({ companion: publicCompanion(db.prepare("SELECT * FROM companions WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/companions/:id", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("photo"), (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["name", "role"]);
    const existing = db.prepare("SELECT * FROM companions WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, "साथी नहीं मिला");
    const photoUrl = req.file ? saveImage(req.file, "companion") : existing.photo_url;
    db.prepare("UPDATE companions SET name = ?, role = ?, bio = ?, photo_url = ? WHERE id = ?")
      .run(cleanText(req.body.name, 120), cleanText(req.body.role, 160), cleanText(req.body.bio, 500), photoUrl, id);
    if (req.file && existing.photo_url !== photoUrl) removeUpload(existing.photo_url);
    res.json({ companion: publicCompanion(db.prepare("SELECT * FROM companions WHERE id = ?").get(id)) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/companions/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM companions WHERE id = ?").get(idOf(req.params.id));
    if (!existing) throw new HttpError(404, "साथी नहीं मिला");
    db.prepare("DELETE FROM companions WHERE id = ?").run(existing.id);
    removeUpload(existing.photo_url);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/gallery", auth, requireAdmin, (_req, res) => {
  res.json({ gallery: db.prepare("SELECT * FROM gallery ORDER BY created_at DESC").all().map(publicGallery) });
});

app.post("/api/admin/gallery", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("image"), (req, res, next) => {
  try {
    requireFields(req.body, ["caption"]);
    const imageUrl = saveImage(req.file, "gallery");
    const result = db.prepare("INSERT INTO gallery (image_url, caption, category, published, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(imageUrl, cleanText(req.body.caption, 180), cleanText(req.body.category, 80) || "मंदिर", bool(req.body.published) ? 1 : 0, now());
    res.status(201).json({ item: publicGallery(db.prepare("SELECT * FROM gallery WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/gallery/:id", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("image"), (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["caption"]);
    const existing = db.prepare("SELECT * FROM gallery WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, "Gallery image नहीं मिली");
    const imageUrl = req.file ? saveImage(req.file, "gallery") : existing.image_url;
    db.prepare("UPDATE gallery SET image_url = ?, caption = ?, category = ?, published = ? WHERE id = ?")
      .run(imageUrl, cleanText(req.body.caption, 180), cleanText(req.body.category, 80) || "मंदिर", bool(req.body.published) ? 1 : 0, id);
    if (req.file && existing.image_url !== imageUrl) removeUpload(existing.image_url);
    res.json({ item: publicGallery(db.prepare("SELECT * FROM gallery WHERE id = ?").get(id)) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/gallery/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM gallery WHERE id = ?").get(idOf(req.params.id));
    if (!existing) throw new HttpError(404, "Gallery image नहीं मिली");
    db.prepare("DELETE FROM gallery WHERE id = ?").run(existing.id);
    removeUpload(existing.image_url);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", auth, requireAdminManager, (_req, res) => {
  res.json({ users: db.prepare("SELECT * FROM users ORDER BY role DESC, created_at ASC").all().map(publicUser) });
});

app.post("/api/admin/users", auth, requireAdminManager, verifySameOriginAndCsrf, (req, res, next) => {
  try {
     requireFields(req.body, ["name", "identifier", "password"]);
     const name = cleanText(req.body.name, 120);
     const identifier = cleanIdentifier(req.body.identifier);
     const password = String(req.body.password || "");
     if (password.length < 12) throw new HttpError(400, "Admin password कम से कम 12 characters का होना चाहिए");
     if (!validIdentifier(identifier)) throw new HttpError(400, "Valid private phone number या email भरें");
     if (db.prepare("SELECT id FROM users WHERE login_id = ?").get(identifier)) throw new HttpError(409, "यह login ID पहले से registered है");
     const hash = bcrypt.hashSync(password, 12);
     const result = db.prepare("INSERT INTO users (name, login_id, password_hash, role, can_manage_admins, created_at) VALUES (?, ?, ?, 'admin', ?, ?)")
       .run(name, identifier, hash, bool(req.body.canManageAdmins) ? 1 : 0, now());
    res.status(201).json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/users/:id", auth, requireAdminManager, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(idOf(req.params.id));
    if (!target) throw new HttpError(404, "Admin नहीं मिला");
    if (target.role === "owner") throw new HttpError(403, "Main Admin को remove नहीं किया जा सकता");
    if (target.id === req.user.id) throw new HttpError(400, "आप खुद को remove नहीं कर सकते");
    db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use("/uploads", express.static(UPLOAD_DIR, { index: false, dotfiles: "deny", maxAge: IS_PRODUCTION ? "1d" : 0 }));
app.use((req, res, next) => {
  if (req.path === "/.env" || req.path === "/server.js" || req.path.startsWith("/data/") || req.path === "/data") return res.sendStatus(404);
  next();
});
app.use(express.static(ROOT, { index: "index.html", dotfiles: "deny" }));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: "Image upload 5MB से छोटी JPG, PNG या WebP होनी चाहिए" });
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Server error हुआ। बाद में फिर प्रयास करें।" : error.message });
});

if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`Temple website running at http://localhost:${PORT}`));
  const close = () => server.close(() => { db.close(); process.exit(0); });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

module.exports = { app, db };
