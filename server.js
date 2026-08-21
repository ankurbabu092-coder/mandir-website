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
const { GoogleGenAI } = require("@google/genai");

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
  CREATE TABLE IF NOT EXISTS visitor_sessions (
    session_hash TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visitor_profiles (
    session_hash TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    show_public INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER NOT NULL,
    donation_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    event_date TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS music_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('audio', 'youtube', 'video')),
    thumbnail_url TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS timings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    time_text TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    audio_url TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    answer_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS deity_likes (
    deity_key TEXT NOT NULL,
    session_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (deity_key, session_hash)
  );
  CREATE TABLE IF NOT EXISTS community_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_hash TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(requester_id, recipient_id)
  );
  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_likes (
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, profile_id)
  );
  CREATE TABLE IF NOT EXISTS community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    profile_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS community_blocks (
    blocker_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES community_profiles(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );
`);

for (const [column, definition] of [["description", "TEXT NOT NULL DEFAULT ''"], ["photo_url", "TEXT NOT NULL DEFAULT ''"], ["audio_url", "TEXT NOT NULL DEFAULT ''"]]) {
  if (!db.prepare("PRAGMA table_info(timings)").all().some(item => item.name === column)) {
    db.exec(`ALTER TABLE timings ADD COLUMN ${column} ${definition}`);
  }
}

const now = () => new Date().toISOString();
const cleanText = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const cleanIdentifier = value => cleanText(value, 160).toLowerCase();
const validIdentifier = value => /^(?:\+?[0-9][0-9\s()-]{6,19}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(value);
const bool = value => value === true || value === "true" || value === 1 || value === "1" || value === "on";
const idOf = value => Number.isInteger(Number(value)) ? Number(value) : 0;
const publicUser = user => ({
  id: user.id,
  name: user.name,
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
const publicEvent = event => ({ id: event.id, title: event.title, body: event.body, date: event.event_date, published: Boolean(event.published) });
const publicDevotee = visitor => ({ name: visitor.display_name, joinedAt: visitor.joined_at });
const publicTiming = item => ({ id: item.id, label: item.label, time: item.time_text, note: item.note, description: item.description || item.note, photoUrl: item.photo_url || "", audioUrl: item.audio_url || "", published: Boolean(item.published), sortOrder: Number(item.sort_order) || 0 });
const publicMusic = item => ({ id: item.id, title: item.title, url: item.url, kind: item.kind, thumbnailUrl: item.thumbnail_url, published: Boolean(item.published), active: Boolean(item.active), sortOrder: Number(item.sort_order) || 0 });
const DEITY_CATALOG = Object.freeze([
  { key: "durga", name: "माता दुर्गा जी", description: "मंदिर में विराजित माता दुर्गा जी के शांत और श्रद्धापूर्ण दर्शन।", imageUrl: "/assets/original/IMG_20260819_105150.jpg" },
  { key: "ram-janki", name: "श्री राम जानकी परिवार", description: "मंदिर में सजे श्री राम जानकी परिवार का वास्तविक छायाचित्र।", imageUrl: "/assets/original/IMG_20260819_105212.jpg" },
  { key: "hanuman", name: "श्री हनुमान जी", description: "सेवा, साहस और राम-भक्ति का स्मरण कराते हनुमान जी।", imageUrl: "/assets/asset-2.jpg" },
  { key: "shiv-family", name: "शिव परिवार", description: "मंदिर परिसर से जुड़ा शिव परिवार दर्शन।", imageUrl: "/assets/original/IMG_20260818_185612.jpg" },
  { key: "shri-ram", name: "श्री राम जी", description: "मर्यादा, करुणा और धैर्य का शांत स्मरण।", imageUrl: "/assets/original/IMG_20260819_105217.jpg" },
  { key: "mata-darshan", name: "माता का दर्शन", description: "मंदिर परिसर में माता की प्रतिमा का वास्तविक दर्शन।", imageUrl: "/assets/original/IMG_20260819_105229.jpg" }
]);

function connectedVisitorCount() {
  return Number(db.prepare("SELECT COUNT(*) AS count FROM visitor_profiles").get().count);
}

function publicDevotees() {
  return db.prepare("SELECT display_name, joined_at FROM visitor_profiles WHERE show_public = 1 ORDER BY joined_at DESC LIMIT 80").all().map(publicDevotee);
}

function publicTimings() {
  return db.prepare("SELECT * FROM timings WHERE published = 1 ORDER BY sort_order ASC, id ASC").all().map(publicTiming);
}

function publicMusicTracks() {
  return db.prepare("SELECT * FROM music_tracks WHERE published = 1 ORDER BY active DESC, sort_order ASC, id DESC").all().map(publicMusic);
}

function publicQuizQuestions() {
  return db.prepare("SELECT id, question, options_json, answer_index, explanation FROM quiz_questions WHERE published = 1 ORDER BY id DESC").all().flatMap(item => {
    try {
      const options = JSON.parse(item.options_json);
      return Array.isArray(options) && options.length >= 2 ? [{ id: item.id, question: item.question, options, answer: item.answer_index, explanation: item.explanation }] : [];
    } catch (_error) { return []; }
  });
}

function publicDeities() {
  return DEITY_CATALOG.map(item => ({ ...item, likeCount: Number(db.prepare("SELECT COUNT(*) AS count FROM deity_likes WHERE deity_key = ?").get(item.key).count) }));
}

function verifiedDonationSummary() {
  const row = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM donations WHERE status = 'SUCCESS'").get();
  return row.count ? { total: Number(row.total), count: Number(row.count) } : null;
}

const DEFAULT_SETTINGS = Object.freeze({
  darshan_message: "आज श्री राम जानकी के दर्शन से मन में शांति और सेवा का संकल्प जगाएं।",
  darshan_image_url: "/assets/original/IMG_20260819_105212.jpg",
  morning_message: "सुप्रभात। प्रभु का नाम लेकर आज का दिन प्रेम, धैर्य और भक्ति से शुरू करें।",
  morning_image_url: "/assets/asset-1.jpg",
  hero_image_url: "/assets/original/IMG_20260813_154930.jpg",
  baba_image_url: "/assets/asset-3.jpg",
  qr_image_url: "/assets/asset-6.jpg",
  whatsapp_url: "https://chat.whatsapp.com/CL1EnOQ1e5p4kCyxJFawoA",
  today_message: "जहां भक्ति होती है, वहां मन को ठहरने का रास्ता मिल जाता है।",
  today_message_author: "श्री राम जानकी मंदिर",
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
  const activeMusic = publicMusicTracks().find(item => item.active) || null;
  return {
    darshan: { message: settings.darshan_message, imageUrl: settings.darshan_image_url },
    morning: { message: settings.morning_message, imageUrl: settings.morning_image_url },
    heroImageUrl: settings.hero_image_url,
    babaImageUrl: settings.baba_image_url,
    qrImageUrl: settings.qr_image_url,
    whatsappUrl: settings.whatsapp_url,
    message: { body: settings.today_message, author: settings.today_message_author },
    donation: { verified: verifiedDonationSummary() },
    meditation: { audioUrl: activeMusic?.kind === "audio" ? activeMusic.url : "", track: activeMusic },
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
    heroImageUrl: settings.hero_image_url,
    babaImageUrl: settings.baba_image_url,
    qrImageUrl: settings.qr_image_url,
    whatsappUrl: settings.whatsapp_url,
    todayMessage: settings.today_message,
    todayMessageAuthor: settings.today_message_author,
    liveActive: bool(settings.live_active),
    liveUrl: settings.live_url,
    liveTitle: settings.live_title,
    liveMessage: settings.live_message
  };
}

function validHttpUrl(value) {
  return !value || /^https?:\/\/\S+$/i.test(value);
}

function validMediaUrl(value) {
  return /^https?:\/\/\S+$/i.test(value) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(value);
}

function fallbackBhakti(message) {
  const question = cleanText(message, 500);
  if (/वेबसाइट|क्या-क्या|सुविधा|features|website/i.test(question)) return "इस वेबसाइट पर डिजिटल दर्शन, भगवान दर्शन gallery, एक मिनट का शांत मंदिर अनुभव, भक्ति संगीत, randomized भक्ति quiz, मंदिर सूचना, verified QR सेवा, भक्त परिवार, WhatsApp समूह, स्थान और Bhakti AI उपलब्ध हैं। बदलने वाली जानकारी समिति Admin panel से संभाल सकती है।";
  if (/जुड़|सदस्य|साथी|परिवार|member|community|friend/i.test(question)) return "पहली बार अपना चुना हुआ नाम लिखकर मंदिर परिवार से जुड़ें। नाम सार्वजनिक दिखाना वैकल्पिक है। भक्त परिवार page पर विनम्र संदेश, connections और reporting की सुविधा भी है।";
  if (/दान|सहयोग|qr|पेटी|donat/i.test(question)) return "सेवा निधि section में समिति द्वारा दिया गया QR और वास्तविक दान पेटी का चित्र है। राशि या UPI विवरण केवल समिति द्वारा सत्यापित होने पर ही public summary में दिखता है।";
  if (/संगीत|भजन|गाना|music|song/i.test(question)) return "भक्ति संगीत page पर समिति द्वारा जोड़े गए tracks दिखाई देते हैं। संगीत शुरू करने के लिए visitor को play button दबाना होता है; browser में बिना अनुमति audio शुरू नहीं किया जाता।";
  if (/समय|आरती|दर्शन timing|timing|schedule/i.test(question)) {
    const timings = publicTimings();
    return timings.length ? `समिति द्वारा उपलब्ध समय: ${timings.map(item => `${item.label}: ${item.time}${item.note ? ` (${item.note})` : ""}`).join("; ")}` : "आरती और दर्शन का समय अभी समिति द्वारा website पर दर्ज नहीं किया गया है। कृपया मंदिर सूचना या समिति से पुष्टि करें।";
  }
  if (/आज क्या|आज करूँ|suggest|सलाह/i.test(question)) return "आज कुछ क्षण शांत होकर राम नाम स्मरण करें, एक दीप जलाएं और किसी जरूरतमंद की निःस्वार्थ सहायता करें। यह सामान्य devotional suggestion है, मंदिर की official सूचना नहीं।";
  if (/मंदिर|पता|स्थान|कहाँ|where|address/i.test(question)) return "श्री राम जानकी मंदिर माई राम कुटी न्यास, बरपारवा, हरिहरपुर, गोरखपुर, उत्तर प्रदेश में है। Plus Code: G7X5+3W9। यात्रा से पहले मंदिर सूचना देखना अच्छा रहेगा।";
  if (/हनुमान|कथा/i.test(question)) return "हनुमान जी की भक्ति हमें सेवा, साहस और विनम्रता का स्मरण कराती है। उनकी कथा में निःस्वार्थ सहयोग और राम-भक्ति का भाव प्रमुख है।";
  if (/शिव|महादेव/i.test(question)) return "भगवान शिव को ध्यान, करुणा और अंतर्दृष्टि के भाव से स्मरण किया जाता है। मंदिर के वास्तविक शिव परिवार दर्शन को भगवान दर्शन page पर देखें।";
  if (/दुर्गा|माता/i.test(question)) return "माता दुर्गा शक्ति, संरक्षण और साहस के भाव की आराध्या हैं। यहां दिखाया गया दर्शन मंदिर परिसर की वास्तविक supplied photograph पर आधारित है।";
  if (/राम|सीता/i.test(question)) return "श्री राम और माता सीता का स्मरण मन में मर्यादा, करुणा और धैर्य का भाव जगाता है। कुछ क्षण शांत होकर राम नाम जपें।";
  return "मैं आपके प्रश्न के अनुसार सहायता करूंगा। आप मंदिर का पता, website features, भक्त परिवार, भक्ति संगीत, दान, आरती समय या किसी देवता के बारे में सीधे पूछ सकते हैं।";
}

async function bhaktiReply(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { answer: fallbackBhakti(message), available: false };
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const ai = new GoogleGenAI({ apiKey });
  const context = Array.isArray(history) ? history.slice(-8).flatMap(item => {
    const role = item?.role === "model" ? "model" : item?.role === "user" ? "user" : "";
    const text = cleanText(item?.text, 500);
    return role && text ? [{ role, parts: [{ text }] }] : [];
  }) : [];
  const response = await ai.models.generateContent({
    model,
    contents: [...context, { role: "user", parts: [{ text: `प्रश्न: ${message}` }] }],
    config: {
       systemInstruction: `आप 'मंदिर सहायक' हैं। सम्मानपूर्ण, सरल हिंदी या अंग्रेज़ी में वास्तविक प्रश्न का उत्तर दें। भगवान होने का दावा न करें। केवल दिए गए प्रमाणित मंदिर विवरण और current public data का उपयोग करें। मंदिर का इतिहास, समय, आयोजन, दान राशि या admin credentials कभी न गढ़ें। यदि जानकारी उपलब्ध नहीं है तो साफ कहें कि समिति ने अभी दर्ज नहीं की। Website features: digital darshan, deity gallery, one-minute temple experience, admin-controlled bhakti music, quiz, notices, verified QR service, community, WhatsApp, location और AI assistant। मंदिर: श्री राम जानकी मंदिर माई राम कुटी न्यास, बरपारवा, हरिहरपुर, गोरखपुर, उत्तर प्रदेश। Current timings: ${JSON.stringify(publicTimings())}. Current notices: ${JSON.stringify(db.prepare("SELECT title, body, notice_date FROM notices WHERE published = 1 ORDER BY updated_at DESC LIMIT 10").all())}`,
      temperature: 0.5,
      maxOutputTokens: 2048
    }
  });
  const answer = response.text?.trim();
  return { answer: answer || fallbackBhakti(message), available: Boolean(answer) };
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

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "भक्ति सहायक के लिए कुछ देर बाद फिर प्रयास करें।" }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    callback(null, allowed.has(file.mimetype));
  }
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm", "audio/x-m4a"]);
    callback(null, allowed.has(file.mimetype));
  }
});

const cookieOptions = { httpOnly: true, sameSite: "lax", secure: IS_PRODUCTION, maxAge: 8 * 60 * 60 * 1000, path: "/" };
const visitorCookieOptions = { httpOnly: true, sameSite: "lax", secure: IS_PRODUCTION, maxAge: 365 * 24 * 60 * 60 * 1000, path: "/" };
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

function saveAudio(file, prefix) {
  if (!file?.buffer || !file.buffer.length) throw new HttpError(400, "Only valid devotional audio file is allowed");
  const extension = file.mimetype.includes("mpeg") ? "mp3" : file.mimetype.includes("wav") ? "wav" : file.mimetype.includes("ogg") ? "ogg" : file.mimetype.includes("webm") ? "webm" : "m4a";
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

function visitorSessionHash(req, res) {
  let token = req.cookies.temple_visitor_id;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    res.cookie("temple_visitor_id", token, visitorCookieOptions);
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

function communityProfileView(profile) {
  if (!profile) return null;
  const active = Date.now() - new Date(profile.last_seen).getTime() < 15 * 60 * 1000;
  return { id: profile.id, name: profile.display_name, bio: profile.bio, active };
}

function communityProfileForRequest(req, res) {
  const sessionHash = visitorSessionHash(req, res);
  return db.prepare("SELECT * FROM community_profiles WHERE session_hash = ?").get(sessionHash);
}

function requireCommunityProfile(req, res, next) {
  const profile = communityProfileForRequest(req, res);
  if (!profile) return next(new HttpError(401, "भक्त परिवार में जुड़ने के लिए पहले अपना public नाम बनाएं"));
  db.prepare("UPDATE community_profiles SET last_seen = ? WHERE id = ?").run(now(), profile.id);
  req.communityProfile = { ...profile, last_seen: now() };
  next();
}

function isCommunityBlocked(firstId, secondId) {
  return Boolean(db.prepare("SELECT 1 FROM community_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)").get(firstId, secondId, secondId, firstId));
}

function publicCommunityComment(comment) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    author: { id: comment.profile_id, name: comment.display_name, active: Date.now() - new Date(comment.last_seen).getTime() < 15 * 60 * 1000 }
  };
}

function publicCommunityPost(post, profileId) {
  const comments = db.prepare("SELECT c.id, c.body, c.created_at, c.profile_id, p.display_name, p.last_seen FROM community_comments c JOIN community_profiles p ON p.id = c.profile_id WHERE c.post_id = ? AND c.hidden = 0 ORDER BY c.created_at ASC LIMIT 12").all(post.id).map(publicCommunityComment);
  const likes = Number(db.prepare("SELECT COUNT(*) AS count FROM community_likes WHERE post_id = ?").get(post.id).count);
  return {
    id: post.id,
    body: post.body,
    createdAt: post.created_at,
    author: { id: post.profile_id, name: post.display_name, active: Date.now() - new Date(post.last_seen).getTime() < 15 * 60 * 1000 },
    likeCount: likes,
    liked: Boolean(profileId && db.prepare("SELECT 1 FROM community_likes WHERE post_id = ? AND profile_id = ?").get(post.id, profileId)),
    comments
  };
}

function communityPosts(profileId) {
  const rows = db.prepare(`
    SELECT post.*, profile.display_name, profile.last_seen
    FROM community_posts post
    JOIN community_profiles profile ON profile.id = post.profile_id
    WHERE post.hidden = 0
      AND NOT EXISTS (
        SELECT 1 FROM community_blocks block
        WHERE (block.blocker_id = ? AND block.blocked_id = post.profile_id)
           OR (block.blocker_id = post.profile_id AND block.blocked_id = ?)
      )
    ORDER BY post.created_at DESC
    LIMIT 60
  `).all(profileId || 0, profileId || 0);
  return rows.map(post => publicCommunityPost(post, profileId));
}

function communityProfiles(profileId) {
  return db.prepare(`
    SELECT profile.id, profile.display_name, profile.bio, profile.last_seen
    FROM community_profiles profile
    WHERE profile.id != ?
      AND NOT EXISTS (
        SELECT 1 FROM community_blocks block
        WHERE (block.blocker_id = ? AND block.blocked_id = profile.id)
           OR (block.blocker_id = profile.id AND block.blocked_id = ?)
      )
    ORDER BY profile.last_seen DESC
    LIMIT 80
  `).all(profileId || 0, profileId || 0, profileId || 0).map(communityProfileView);
}

function communityConnections(profileId) {
  return db.prepare(`
    SELECT profile.id, profile.display_name, profile.bio, profile.last_seen
    FROM community_profiles profile
    WHERE profile.id IN (
      SELECT recipient_id FROM community_friendships WHERE requester_id = ? AND status = 'ACCEPTED'
      UNION
      SELECT requester_id FROM community_friendships WHERE recipient_id = ? AND status = 'ACCEPTED'
    )
    ORDER BY profile.display_name COLLATE NOCASE
  `).all(profileId, profileId).map(communityProfileView);
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

app.post("/api/ai", aiLimiter, async (req, res, next) => {
  try {
    const message = cleanText(req.body.message || "आज का भक्ति संदेश", 500);
    res.json(await bhaktiReply(message, req.body.history));
  } catch (error) {
    console.error(error);
    res.json({ answer: fallbackBhakti(req.body.message || ""), available: false });
  }
});

app.post("/api/public/visit", (req, res) => {
  const displayName = cleanText(req.body.displayName, 60);
  if (!displayName) throw new HttpError(400, "नाम दर्ज करके ही डिजिटल संगत में जुड़ें");
  const sessionHash = visitorSessionHash(req, res);
  const joinedAt = now();
  db.prepare("INSERT OR IGNORE INTO visitor_sessions (session_hash, first_seen) VALUES (?, ?)").run(sessionHash, joinedAt);
  db.prepare("INSERT INTO visitor_profiles (session_hash, display_name, show_public, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_hash) DO UPDATE SET display_name = excluded.display_name, show_public = excluded.show_public")
    .run(sessionHash, displayName, bool(req.body.showPublic) ? 1 : 0, joinedAt);
  if (bool(req.body.showPublic)) {
    db.prepare("INSERT INTO community_profiles (session_hash, display_name, bio, created_at, last_seen) VALUES (?, ?, '', ?, ?) ON CONFLICT(session_hash) DO UPDATE SET display_name = excluded.display_name, last_seen = excluded.last_seen")
      .run(sessionHash, displayName, joinedAt, joinedAt);
  }
  res.json({ visitors: connectedVisitorCount(), devotees: publicDevotees() });
});

app.get("/api/public/content", (_req, res) => {
  const notices = db.prepare("SELECT * FROM notices WHERE published = 1 ORDER BY important DESC, COALESCE(notice_date, created_at) DESC").all().map(publicNotice);
  const companions = db.prepare("SELECT * FROM companions ORDER BY created_at DESC").all().map(publicCompanion);
  const gallery = db.prepare("SELECT * FROM gallery WHERE published = 1 ORDER BY created_at DESC").all().map(publicGallery);
  const donors = db.prepare("SELECT id, name FROM donors WHERE published = 1 ORDER BY created_at DESC").all().map(publicDonor);
  const events = db.prepare("SELECT * FROM events WHERE published = 1 ORDER BY event_date ASC, created_at DESC").all().map(publicEvent);
  const communityMembers = Number(db.prepare("SELECT COUNT(*) AS count FROM community_profiles").get().count);
  const importantNotice = notices.find(notice => notice.important) || null;
  res.json({ notices, companions, gallery, donors, events, timings: publicTimings(), music: publicMusicTracks(), quiz: publicQuizQuestions(), deities: publicDeities(), visitors: connectedVisitorCount(), communityMembers, devotees: publicDevotees(), donationSummary: verifiedDonationSummary(), importantNotice, settings: clientSettings(readSettings()) });
});

app.get("/api/public/music", (_req, res) => res.json({ tracks: publicMusicTracks() }));
app.get("/api/public/timings", (_req, res) => res.json({ timings: publicTimings() }));
app.get("/api/public/deities", (_req, res) => res.json({ deities: publicDeities() }));
app.post("/api/public/deities/:key/like", (req, res) => {
  const key = cleanText(req.params.key, 60);
  if (!DEITY_CATALOG.some(item => item.key === key)) throw new HttpError(404, "दर्शन चित्र नहीं मिला");
  const sessionHash = visitorSessionHash(req, res);
  const existing = db.prepare("SELECT 1 FROM deity_likes WHERE deity_key = ? AND session_hash = ?").get(key, sessionHash);
  if (existing) db.prepare("DELETE FROM deity_likes WHERE deity_key = ? AND session_hash = ?").run(key, sessionHash);
  else db.prepare("INSERT INTO deity_likes (deity_key, session_hash, created_at) VALUES (?, ?, ?)").run(key, sessionHash, now());
  res.json({ liked: !existing, likeCount: Number(db.prepare("SELECT COUNT(*) AS count FROM deity_likes WHERE deity_key = ?").get(key).count) });
});

app.get("/api/community/bootstrap", (req, res) => {
  const profile = communityProfileForRequest(req, res);
  const profileId = profile?.id || 0;
  const incoming = profile ? db.prepare("SELECT request.id, request.requester_id AS requesterId, p.display_name AS name, request.status FROM community_friendships request JOIN community_profiles p ON p.id = request.requester_id WHERE request.recipient_id = ? ORDER BY request.created_at DESC").all(profile.id) : [];
  const outgoing = profile ? db.prepare("SELECT request.id, request.recipient_id AS recipientId, p.display_name AS name, request.status FROM community_friendships request JOIN community_profiles p ON p.id = request.recipient_id WHERE request.requester_id = ? ORDER BY request.created_at DESC").all(profile.id) : [];
  res.json({
    me: communityProfileView(profile),
    profiles: communityProfiles(profileId),
    connections: profile ? communityConnections(profile.id) : [],
    requests: { incoming, outgoing },
    posts: communityPosts(profileId),
    whatsappUrl: readSettings().whatsapp_url,
    counts: {
      members: Number(db.prepare("SELECT COUNT(*) AS count FROM community_profiles").get().count),
      connected: profile ? communityConnections(profile.id).length : 0,
      todayVisitors: Number(db.prepare("SELECT COUNT(*) AS count FROM visitor_sessions WHERE first_seen >= date('now')").get().count)
    }
  });
});

app.post("/api/community/profile", (req, res, next) => {
  try {
    const name = cleanText(req.body.displayName, 60);
    const bio = cleanText(req.body.bio, 180);
    if (name.length < 2) throw new HttpError(400, "नाम कम से कम 2 अक्षरों का होना चाहिए");
    const sessionHash = visitorSessionHash(req, res);
    const timestamp = now();
    db.prepare("INSERT INTO visitor_sessions (session_hash, first_seen) VALUES (?, ?) ON CONFLICT(session_hash) DO NOTHING").run(sessionHash, timestamp);
    db.prepare("INSERT INTO visitor_profiles (session_hash, display_name, show_public, joined_at) VALUES (?, ?, 1, ?) ON CONFLICT(session_hash) DO UPDATE SET display_name = excluded.display_name, show_public = 1").run(sessionHash, name, timestamp);
    db.prepare("INSERT INTO community_profiles (session_hash, display_name, bio, created_at, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_hash) DO UPDATE SET display_name = excluded.display_name, bio = excluded.bio, last_seen = excluded.last_seen").run(sessionHash, name, bio, timestamp, timestamp);
    res.status(201).json({ profile: communityProfileView(db.prepare("SELECT * FROM community_profiles WHERE session_hash = ?").get(sessionHash)) });
  } catch (error) { next(error); }
});

app.post("/api/community/posts", requireCommunityProfile, (req, res, next) => {
  try {
    const body = cleanText(req.body.body, 1000);
    if (body.length < 2) throw new HttpError(400, "भक्ति संदेश लिखें");
    const result = db.prepare("INSERT INTO community_posts (profile_id, body, created_at) VALUES (?, ?, ?)").run(req.communityProfile.id, body, now());
    const post = db.prepare("SELECT post.*, profile.display_name, profile.last_seen FROM community_posts post JOIN community_profiles profile ON profile.id = post.profile_id WHERE post.id = ?").get(result.lastInsertRowid);
    res.status(201).json({ post: publicCommunityPost(post, req.communityProfile.id) });
  } catch (error) { next(error); }
});

app.post("/api/community/posts/:id/like", requireCommunityProfile, (req, res, next) => {
  try {
    const postId = idOf(req.params.id);
    const post = db.prepare("SELECT profile_id FROM community_posts WHERE id = ? AND hidden = 0").get(postId);
    if (!post || isCommunityBlocked(req.communityProfile.id, post.profile_id)) throw new HttpError(404, "Post नहीं मिला");
    const existing = db.prepare("SELECT 1 FROM community_likes WHERE post_id = ? AND profile_id = ?").get(postId, req.communityProfile.id);
    if (existing) db.prepare("DELETE FROM community_likes WHERE post_id = ? AND profile_id = ?").run(postId, req.communityProfile.id);
    else db.prepare("INSERT INTO community_likes (post_id, profile_id, created_at) VALUES (?, ?, ?)").run(postId, req.communityProfile.id, now());
    res.json({ liked: !existing, likeCount: Number(db.prepare("SELECT COUNT(*) AS count FROM community_likes WHERE post_id = ?").get(postId).count) });
  } catch (error) { next(error); }
});

app.post("/api/community/posts/:id/comments", requireCommunityProfile, (req, res, next) => {
  try {
    const body = cleanText(req.body.body, 300);
    const postId = idOf(req.params.id);
    const post = db.prepare("SELECT profile_id FROM community_posts WHERE id = ? AND hidden = 0").get(postId);
    if (!post || isCommunityBlocked(req.communityProfile.id, post.profile_id)) throw new HttpError(404, "Post नहीं मिला");
    if (body.length < 2) throw new HttpError(400, "Comment लिखें");
    const result = db.prepare("INSERT INTO community_comments (post_id, profile_id, body, created_at) VALUES (?, ?, ?, ?)").run(postId, req.communityProfile.id, body, now());
    const comment = db.prepare("SELECT c.id, c.body, c.created_at, c.profile_id, p.display_name, p.last_seen FROM community_comments c JOIN community_profiles p ON p.id = c.profile_id WHERE c.id = ?").get(result.lastInsertRowid);
    res.status(201).json({ comment: publicCommunityComment(comment) });
  } catch (error) { next(error); }
});

app.post("/api/community/connect/:id", requireCommunityProfile, (req, res, next) => {
  try {
    const recipientId = idOf(req.params.id);
    if (recipientId === req.communityProfile.id) throw new HttpError(400, "अपने profile को connect नहीं कर सकते");
    const recipient = db.prepare("SELECT id FROM community_profiles WHERE id = ?").get(recipientId);
    if (!recipient || isCommunityBlocked(req.communityProfile.id, recipientId)) throw new HttpError(404, "भक्त profile नहीं मिला");
    const reverse = db.prepare("SELECT * FROM community_friendships WHERE requester_id = ? AND recipient_id = ?").get(recipientId, req.communityProfile.id);
    if (reverse?.status === "PENDING") {
      db.prepare("UPDATE community_friendships SET status = 'ACCEPTED', updated_at = ? WHERE id = ?").run(now(), reverse.id);
      return res.json({ status: "ACCEPTED" });
    }
    const existing = db.prepare("SELECT * FROM community_friendships WHERE requester_id = ? AND recipient_id = ?").get(req.communityProfile.id, recipientId);
    if (existing?.status === "ACCEPTED") return res.json({ status: "ACCEPTED" });
    if (existing) db.prepare("UPDATE community_friendships SET status = 'PENDING', updated_at = ? WHERE id = ?").run(now(), existing.id);
    else db.prepare("INSERT INTO community_friendships (requester_id, recipient_id, status, created_at, updated_at) VALUES (?, ?, 'PENDING', ?, ?)").run(req.communityProfile.id, recipientId, now(), now());
    res.status(201).json({ status: "PENDING" });
  } catch (error) { next(error); }
});

app.patch("/api/community/requests/:id", requireCommunityProfile, (req, res, next) => {
  try {
    const requestId = idOf(req.params.id);
    const action = cleanText(req.body.action, 12).toUpperCase();
    if (!["ACCEPTED", "REJECTED"].includes(action)) throw new HttpError(400, "Request action सही नहीं है");
    const request = db.prepare("SELECT * FROM community_friendships WHERE id = ? AND recipient_id = ?").get(requestId, req.communityProfile.id);
    if (!request) throw new HttpError(404, "Connect request नहीं मिला");
    db.prepare("UPDATE community_friendships SET status = ?, updated_at = ? WHERE id = ?").run(action, now(), requestId);
    res.json({ status: action });
  } catch (error) { next(error); }
});

app.post("/api/community/blocks/:id", requireCommunityProfile, (req, res, next) => {
  try {
    const blockedId = idOf(req.params.id);
    if (blockedId === req.communityProfile.id || !db.prepare("SELECT id FROM community_profiles WHERE id = ?").get(blockedId)) throw new HttpError(404, "Profile नहीं मिला");
    db.prepare("INSERT OR IGNORE INTO community_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").run(req.communityProfile.id, blockedId, now());
    db.prepare("DELETE FROM community_friendships WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)").run(req.communityProfile.id, blockedId, blockedId, req.communityProfile.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/community/reports", requireCommunityProfile, (req, res, next) => {
  try {
    const postId = idOf(req.body.postId) || null;
    const commentId = idOf(req.body.commentId) || null;
    const reason = cleanText(req.body.reason, 240);
    if (!postId && !commentId) throw new HttpError(400, "Report target missing है");
    if (!reason) throw new HttpError(400, "Report reason लिखें");
    if (postId && !db.prepare("SELECT id FROM community_posts WHERE id = ?").get(postId)) throw new HttpError(404, "Post नहीं मिला");
    if (commentId && !db.prepare("SELECT id FROM community_comments WHERE id = ?").get(commentId)) throw new HttpError(404, "Comment नहीं मिला");
    db.prepare("INSERT INTO community_reports (reporter_id, post_id, comment_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(req.communityProfile.id, postId, commentId, reason, now());
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/dashboard", auth, requireAdmin, (_req, res) => {
  const count = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  res.json({ notices: count("notices"), events: count("events"), companions: count("companions"), gallery: count("gallery"), donors: count("donors"), admins: count("users") - 1, visitors: connectedVisitorCount(), communityMembers: count("community_profiles"), communityPosts: count("community_posts"), communityReports: count("community_reports"), deityLikes: count("deity_likes"), music: count("music_tracks"), timings: count("timings"), quizQuestions: count("quiz_questions"), donations: verifiedDonationSummary() });
});

app.get("/api/admin/deity-engagement", auth, requireAdmin, (_req, res) => {
  res.json({ deities: publicDeities() });
});

app.get("/api/admin/music", auth, requireAdmin, (_req, res) => {
  res.json({ tracks: db.prepare("SELECT * FROM music_tracks ORDER BY active DESC, sort_order ASC, updated_at DESC").all().map(publicMusic) });
});

app.post("/api/admin/music", auth, requireAdmin, verifySameOriginAndCsrf, audioUpload.single("audioFile"), (req, res, next) => {
  try {
    requireFields(req.body, ["title", "kind"]);
    const kind = req.file ? "audio" : cleanText(req.body.kind, 12).toLowerCase();
    const url = req.file ? saveAudio(req.file, "music") : cleanText(req.body.url, 700);
    if (!["audio", "youtube", "video"].includes(kind) || !validMediaUrl(url)) throw new HttpError(400, "Music link और type सही भरें");
    const active = bool(req.body.active) ? 1 : 0;
    if (active) db.prepare("UPDATE music_tracks SET active = 0").run();
    const timestamp = now();
    const result = db.prepare("INSERT INTO music_tracks (title, url, kind, thumbnail_url, published, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(cleanText(req.body.title, 180), url, kind, cleanText(req.body.thumbnailUrl, 700), bool(req.body.published) ? 1 : 0, active, Number(req.body.sortOrder) || 0, timestamp, timestamp);
    res.status(201).json({ track: publicMusic(db.prepare("SELECT * FROM music_tracks WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) { next(error); }
});

app.put("/api/admin/music/:id", auth, requireAdmin, verifySameOriginAndCsrf, audioUpload.single("audioFile"), (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["title", "kind"]);
    const kind = req.file ? "audio" : cleanText(req.body.kind, 12).toLowerCase();
    const existing = db.prepare("SELECT * FROM music_tracks WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, "Music track नहीं मिला");
    const url = req.file ? saveAudio(req.file, "music") : cleanText(req.body.url, 700);
    if (!["audio", "youtube", "video"].includes(kind) || !validMediaUrl(url)) throw new HttpError(400, "Music link और type सही भरें");
    const active = bool(req.body.active) ? 1 : 0;
    if (active) db.prepare("UPDATE music_tracks SET active = 0").run();
    db.prepare("UPDATE music_tracks SET title = ?, url = ?, kind = ?, thumbnail_url = ?, published = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.title, 180), url, kind, cleanText(req.body.thumbnailUrl, 700), bool(req.body.published) ? 1 : 0, active, Number(req.body.sortOrder) || 0, now(), id);
    if (req.file && existing.url !== url) removeUpload(existing.url);
    res.json({ track: publicMusic(db.prepare("SELECT * FROM music_tracks WHERE id = ?").get(id)) });
  } catch (error) { next(error); }
});

app.delete("/api/admin/music/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM music_tracks WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Music track नहीं मिला");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/timings", auth, requireAdmin, (_req, res) => {
  res.json({ timings: db.prepare("SELECT * FROM timings ORDER BY sort_order ASC, id ASC").all().map(publicTiming) });
});

app.post("/api/admin/timings", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("photo"), (req, res, next) => {
  try {
    requireFields(req.body, ["label", "time"]);
    const timestamp = now();
    const photoUrl = req.file ? saveImage(req.file, "timing") : cleanText(req.body.photoUrl, 700);
    const audioUrl = cleanText(req.body.audioUrl, 700);
    if (!validMediaUrl(audioUrl) && audioUrl) throw new HttpError(400, "Aarti audio link सही नहीं है");
    const result = db.prepare("INSERT INTO timings (label, time_text, note, description, photo_url, audio_url, published, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(cleanText(req.body.label, 120), cleanText(req.body.time, 120), cleanText(req.body.note, 240), cleanText(req.body.description || req.body.note, 500), photoUrl, audioUrl, bool(req.body.published) ? 1 : 0, Number(req.body.sortOrder) || 0, timestamp, timestamp);
    res.status(201).json({ timing: publicTiming(db.prepare("SELECT * FROM timings WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) { next(error); }
});

app.put("/api/admin/timings/:id", auth, requireAdmin, verifySameOriginAndCsrf, upload.single("photo"), (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["label", "time"]);
    const existing = db.prepare("SELECT * FROM timings WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, "Timing नहीं मिला");
    const photoUrl = req.file ? saveImage(req.file, "timing") : existing.photo_url;
    const audioUrl = cleanText(req.body.audioUrl, 700);
    if (!validMediaUrl(audioUrl) && audioUrl) throw new HttpError(400, "Aarti audio link सही नहीं है");
    db.prepare("UPDATE timings SET label = ?, time_text = ?, note = ?, description = ?, photo_url = ?, audio_url = ?, published = ?, sort_order = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.label, 120), cleanText(req.body.time, 120), cleanText(req.body.note, 240), cleanText(req.body.description || req.body.note, 500), photoUrl, audioUrl, bool(req.body.published) ? 1 : 0, Number(req.body.sortOrder) || 0, now(), id);
    if (req.file && existing.photo_url !== photoUrl) removeUpload(existing.photo_url);
    res.json({ timing: publicTiming(db.prepare("SELECT * FROM timings WHERE id = ?").get(id)) });
  } catch (error) { next(error); }
});

app.delete("/api/admin/timings/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM timings WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Timing नहीं मिला");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/quiz", auth, requireAdmin, (_req, res) => {
  const questions = db.prepare("SELECT id, question, options_json, answer_index AS answer, explanation, published FROM quiz_questions ORDER BY updated_at DESC").all().flatMap(item => {
    try { return [{ ...item, options: JSON.parse(item.options_json), published: Boolean(item.published) }]; } catch (_error) { return []; }
  });
  res.json({ questions });
});

app.post("/api/admin/quiz", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    requireFields(req.body, ["question", "options", "answer", "explanation"]);
    const options = String(req.body.options).split(/\r?\n/).map(item => cleanText(item, 120)).filter(Boolean);
    const answer = Number(req.body.answer);
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new HttpError(400, "Quiz options और सही उत्तर सही भरें");
    const timestamp = now();
    const result = db.prepare("INSERT INTO quiz_questions (question, options_json, answer_index, explanation, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(cleanText(req.body.question, 300), JSON.stringify(options), answer, cleanText(req.body.explanation, 500), bool(req.body.published) ? 1 : 0, timestamp, timestamp);
    res.status(201).json({ question: db.prepare("SELECT id, question, options_json, answer_index AS answer, explanation, published FROM quiz_questions WHERE id = ?").get(result.lastInsertRowid) });
  } catch (error) { next(error); }
});

app.put("/api/admin/quiz/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["question", "options", "answer", "explanation"]);
    const options = String(req.body.options).split(/\r?\n/).map(item => cleanText(item, 120)).filter(Boolean);
    const answer = Number(req.body.answer);
    if (!db.prepare("SELECT id FROM quiz_questions WHERE id = ?").get(id)) throw new HttpError(404, "Quiz question नहीं मिला");
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new HttpError(400, "Quiz options और सही उत्तर सही भरें");
    db.prepare("UPDATE quiz_questions SET question = ?, options_json = ?, answer_index = ?, explanation = ?, published = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.question, 300), JSON.stringify(options), answer, cleanText(req.body.explanation, 500), bool(req.body.published) ? 1 : 0, now(), id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.delete("/api/admin/quiz/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM quiz_questions WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Quiz question नहीं मिला");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/community/reports", auth, requireAdmin, (_req, res) => {
  const reports = db.prepare("SELECT report.id, report.reason, report.created_at AS createdAt, report.post_id AS postId, report.comment_id AS commentId, reporter.display_name AS reporterName FROM community_reports report JOIN community_profiles reporter ON reporter.id = report.reporter_id ORDER BY report.created_at DESC LIMIT 100").all();
  res.json({ reports });
});

app.get("/api/admin/donations", auth, requireAdmin, (_req, res) => {
  res.json({ donations: db.prepare("SELECT id, amount, donation_date AS date, status, note, created_at AS createdAt FROM donations ORDER BY donation_date DESC, created_at DESC").all(), summary: verifiedDonationSummary() });
});

app.post("/api/admin/donations", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const date = cleanText(req.body.date, 20);
    const status = cleanText(req.body.status, 12).toUpperCase() || "SUCCESS";
    if (!Number.isInteger(amount) || amount <= 0 || amount > 999999999999) throw new HttpError(400, "Verified donation amount सही भरें");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Donation date YYYY-MM-DD होनी चाहिए");
    if (!["SUCCESS", "PENDING", "FAILED"].includes(status)) throw new HttpError(400, "Donation status सही नहीं है");
    const timestamp = now();
    const result = db.prepare("INSERT INTO donations (amount, donation_date, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(amount, date, status, cleanText(req.body.note, 180), timestamp, timestamp);
    res.status(201).json({ donation: db.prepare("SELECT id, amount, donation_date AS date, status, note FROM donations WHERE id = ?").get(result.lastInsertRowid), summary: verifiedDonationSummary() });
  } catch (error) { next(error); }
});

app.delete("/api/admin/donations/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM donations WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Donation record नहीं मिला");
    res.json({ ok: true, summary: verifiedDonationSummary() });
  } catch (error) { next(error); }
});

app.get("/api/admin/events", auth, requireAdmin, (_req, res) => {
  res.json({ events: db.prepare("SELECT * FROM events ORDER BY event_date ASC, updated_at DESC").all().map(publicEvent) });
});

app.post("/api/admin/events", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    requireFields(req.body, ["title", "body", "date"]);
    const timestamp = now();
    const result = db.prepare("INSERT INTO events (title, body, event_date, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(cleanText(req.body.title, 160), cleanText(req.body.body, 2000), cleanText(req.body.date, 40), bool(req.body.published) ? 1 : 0, timestamp, timestamp);
    res.status(201).json({ event: publicEvent(db.prepare("SELECT * FROM events WHERE id = ?").get(result.lastInsertRowid)) });
  } catch (error) { next(error); }
});

app.put("/api/admin/events/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const id = idOf(req.params.id);
    requireFields(req.body, ["title", "body", "date"]);
    if (!db.prepare("SELECT id FROM events WHERE id = ?").get(id)) throw new HttpError(404, "Event नहीं मिला");
    db.prepare("UPDATE events SET title = ?, body = ?, event_date = ?, published = ?, updated_at = ? WHERE id = ?")
      .run(cleanText(req.body.title, 160), cleanText(req.body.body, 2000), cleanText(req.body.date, 40), bool(req.body.published) ? 1 : 0, now(), id);
    res.json({ event: publicEvent(db.prepare("SELECT * FROM events WHERE id = ?").get(id)) });
  } catch (error) { next(error); }
});

app.delete("/api/admin/events/:id", auth, requireAdmin, verifySameOriginAndCsrf, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM events WHERE id = ?").run(idOf(req.params.id));
    if (!result.changes) throw new HttpError(404, "Event नहीं मिला");
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/admin/settings", auth, requireAdmin, (_req, res) => {
  res.json({ settings: adminSettings(readSettings()) });
});

app.put("/api/admin/settings", auth, requireAdmin, verifySameOriginAndCsrf, upload.fields([
  { name: "heroImage", maxCount: 1 },
  { name: "darshanImage", maxCount: 1 },
  { name: "morningImage", maxCount: 1 },
  { name: "babaImage", maxCount: 1 },
  { name: "qrImage", maxCount: 1 }
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
      whatsapp_url: cleanText(req.body.whatsappUrl, 700) || DEFAULT_SETTINGS.whatsapp_url,
      live_active: bool(req.body.liveActive) ? "true" : "false",
      live_url: liveUrl,
      live_title: cleanText(req.body.liveTitle, 160) || DEFAULT_SETTINGS.live_title,
      live_message: cleanText(req.body.liveMessage, 500) || DEFAULT_SETTINGS.live_message
    };
    if (!validHttpUrl(updates.whatsapp_url)) throw new HttpError(400, "WhatsApp link केवल http या https URL होना चाहिए");
    if (files.heroImage?.[0]) {
      updates.hero_image_url = saveImage(files.heroImage[0], "hero");
      replacements.push(current.hero_image_url);
    }
    if (files.darshanImage?.[0]) {
      updates.darshan_image_url = saveImage(files.darshanImage[0], "darshan");
      replacements.push(current.darshan_image_url);
    }
    if (files.morningImage?.[0]) {
      updates.morning_image_url = saveImage(files.morningImage[0], "morning");
      replacements.push(current.morning_image_url);
    }
    if (files.babaImage?.[0]) {
      updates.baba_image_url = saveImage(files.babaImage[0], "baba");
      replacements.push(current.baba_image_url);
    }
    if (files.qrImage?.[0]) {
      updates.qr_image_url = saveImage(files.qrImage[0], "qr");
      replacements.push(current.qr_image_url);
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
  res.json({ users: db.prepare("SELECT * FROM users ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC").all().map(publicUser) });
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
  if (req.path === "/.env" || req.path === "/.env.example" || req.path === "/server.js" || req.path.startsWith("/data/") || req.path === "/data") return res.sendStatus(404);
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
