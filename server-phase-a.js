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
const rateLimit = require("express-rate-limit");
const { GoogleGenAI } = require("@google/genai");

const { initDb, getDb } = require("./mongo-client");
const { initCloudinary, uploadImage, uploadAudio, deleteCloudinaryFile } = require("./cloudinary-client");
const dbOps = require("./mongo-operations");
const dbOps2 = require("./mongo-operations-part2");
const dbOps3 = require("./mongo-operations-part3");

const ROOT = __dirname;
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(ROOT, "data")
);

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(ROOT, "uploads")
);
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

const now = () => new Date().toISOString();
const cleanText = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const cleanIdentifier = value => cleanText(value, 160).toLowerCase();
const validIdentifier = value => /^(?:\+?[0-9][0-9\s()-]{6,19}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(value);
const bool = value => value === true || value === "true" || value === 1 || value === "1" || value === "on";
const idOf = value => Number.isInteger(Number(value)) ? Number(value) : 0;
const publicUser = user => ({
  id: user._id,
  name: user.name,
  role: user.role,
  canManageAdmins: Boolean(user.can_manage_admins)
});
const publicNotice = notice => ({
  id: notice._id,
  title: notice.title,
  body: notice.body,
  date: notice.notice_date,
  important: Boolean(notice.important),
  published: Boolean(notice.published)
});
const publicCompanion = item => ({
  id: item._id,
  name: item.name,
  role: item.role,
  bio: item.bio,
  photoUrl: item.photo_url
});
const publicGallery = item => ({
  id: item._id,
  imageUrl: item.image_url,
  caption: item.caption,
  category: item.category
});
const publicDonor = donor => ({ id: donor._id, name: donor.name });
const publicEvent = event => ({ id: event._id, title: event.title, body: event.body, date: event.event_date, published: Boolean(event.published) });
const publicDevotee = visitor => ({ name: visitor.display_name, joinedAt: visitor.joined_at });
const publicTiming = item => ({ id: item._id, label: item.label, time: item.time_text, note: item.note, description: item.description || item.note, photoUrl: item.photo_url || "", audioUrl: item.audio_url || "" });
const publicMusic = item => ({ id: item._id, title: item.title, url: item.url, kind: item.kind, thumbnailUrl: item.thumbnail_url, published: Boolean(item.published), active: Boolean(item.active), sortOrder: item.sort_order });
const DEITY_CATALOG = Object.freeze([
  { key: "durga", name: "माता दुर्गा जी", description: "मंदिर में विराजित माता दुर्गा जी के शांत और सुरक्षात्मक दर्शन।", imageUrl: "/assets/original/IMG_20260819_105212.jpg" },
  { key: "ram-janki", name: "श्री राम जानकी परिवार", description: "मंदिर में सजे श्री राम जानकी परिवार का मंगलमय दर्शन।", imageUrl: "/assets/original/IMG_20260813_154930.jpg" },
  { key: "hanuman", name: "श्री हनुमान जी", description: "सेवा, साहस और राम-भक्ति का स्मरण कराते हनुमान जी।", imageUrl: "/assets/asset-5.jpg" },
  { key: "shiv-family", name: "शिव परिवार", description: "मंदिर परिसर से जुड़ा शिव परिवार दर्शन।", imageUrl: "/assets/asset-4.jpg" },
  { key: "shri-ram", name: "श्री राम जी", description: "मर्यादा, करुणा और धैर्य का शांत स्मरण।", imageUrl: "/assets/original/IMG_20260813_154930.jpg" },
  { key: "mata-darshan", name: "माता का दर्शन", description: "मंदिर परिसर में माता की प्रतिमा का वास्तविक सौंदर्य।", imageUrl: "/assets/asset-2.jpg" }
]);

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

async function initializeApp() {
  try {
    await initDb();
    initCloudinary();
    
    const ownerIdentifier = cleanIdentifier(process.env.OWNER_IDENTIFIER);
    if (!validIdentifier(ownerIdentifier)) {
      throw new Error("OWNER_IDENTIFIER must be a private phone number or email address.");
    }
    
    const ownerName = cleanText(process.env.OWNER_NAME || "Ankur Chauhan", 120) || "Ankur Chauhan";
    const owner = await dbOps.getUserByLoginId(ownerIdentifier);
    
    if (!owner) {
      const hash = bcrypt.hashSync(process.env.OWNER_PASSWORD, 12);
      await dbOps.insertUser(ownerName, ownerIdentifier, hash, "owner", true, now());
    } else if (owner.role !== "owner" || !owner.can_manage_admins) {
      await dbOps.updateUserRole(owner._id, "owner", true);
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await dbOps3.upsertSiteSetting(key, String(value), now());
    }
  } catch (error) {
    console.error("App initialization error:", error);
    throw error;
  }
}

async function connectedVisitorCount() {
  return await dbOps2.countVisitorProfiles();
}

async function publicDevotees() {
  return await dbOps.getPublicVisitorProfiles().then(visitors => visitors.map(publicDevotee));
}

async function publicTimings() {
  return (await dbOps.getPublishedTimings()).map(publicTiming);
}

async function publicMusicTracks() {
  return (await dbOps.getPublishedMusicTracks()).map(publicMusic);
}

async function publicQuizQuestions() {
  return (await dbOps.getPublishedQuizQuestions()).flatMap(item => {
    try {
      const options = JSON.parse(item.options_json);
      return Array.isArray(options) && options.length >= 2 ? [{ id: item._id, question: item.question, options, answer: item.answer_index, explanation: item.explanation }] : [];
    } catch (_error) { return []; }
  });
}

async function publicDeities() {
  return Promise.all(DEITY_CATALOG.map(async item => ({
    ...item,
    likeCount: await dbOps2.countDeityLikes(item.key)
  })));
}

async function verifiedDonationSummary() {
  return await dbOps2.getVerifiedDonationSummary();
}

async function readSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  const allSettings = await dbOps.getAllSiteSettings();
  allSettings.forEach(item => { settings[item._id] = item.value; });
  return settings;
}

function clientSettings(settings) {
  const activeMusic = null;
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
  if (/वेबसाइट|क्या-क्या|सुविधा|features|website/i.test(question)) return "इस वेबसाइट पर डिजिटल दर्शन, भगवान का ध्यान, भक्ति संगीत और community features हैं।";
  if (/जुड़|सदस्य|साथी|परिवार|member|community|friend/i.test(question)) return "पहली बार अपना चुना हुआ नाम लिखकर भक्त परिवार से जुड़ें।";
  if (/दान|सहयोग|qr|पेटी|donat/i.test(question)) return "सेवा निधि section में समिति द्वारा दिया गया QR और bank details हैं।";
  if (/संगीत|भजन|गाना|music|song/i.test(question)) return "भक्ति संगीत page पर समिति द्वारा जोड़े गए tracks देखें।";
  if (/समय|आरती|दर्शन timing|timing|schedule/i.test(question)) return "समिति द्वारा उपलब्ध समय देखें।";
  if (/आज क्या|आज करूँ|suggest|सलाह/i.test(question)) return "आज कुछ क्षण शांत होकर राम नाम स्मरण करें।";
  if (/मंदिर|पता|स्थान|कहाँ|where|address/i.test(question)) return "श्री राम जानकी मंदिर माई राम कुटी नजदीक है।";
  if (/हनुमान|कथा/i.test(question)) return "हनुमान जी की भक्ति हमें सेवा, साहस और विनम्रता सिखाती है।";
  if (/शिव|महादेव/i.test(question)) return "भगवान शिव को ध्यान, करुणा और अंतर्दृष्टि के भाव से याद करें।";
  if (/दुर्गा|माता/i.test(question)) return "माता दुर्गा शक्ति, संरक्षण और साहस की देवी हैं।";
  if (/राम|सीता/i.test(question)) return "श्री राम और माता सीता का स्मरण मन में मर्यादा और करुणा लाता है।";
  return "मैं आपके प्रश्न के अनुसार सहायता करूंगा।";
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
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [...context, { role: "user", parts: [{ text: `प्रश्न: ${message}` }] }],
      config: {
        systemInstruction: "आप 'मंदिर सहायक' हैं। सम्मानपूर्ण, सरल हिंदी में वाक्यों में उत्तर दें।",
        temperature: 0.5,
        maxOutputTokens: 2048
      }
    });
    const answer = response.text?.trim();
    return { answer: answer || fallbackBhakti(message), available: Boolean(answer) };
  } catch (error) {
    console.error("Bhakti AI error:", error);
    return { answer: fallbackBhakti(message), available: false };
  }
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
  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.SESSION_SECRET, { expiresIn: "8h" });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.cookie(CSRF_COOKIE, csrfToken, { httpOnly: false, sameSite: "lax", secure: IS_PRODUCTION, maxAge: cookieOptions.maxAge, path: "/" });
  return csrfToken;
}

async function auth(req, _res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) throw new HttpError(401, "Login required");
    const payload = jwt.verify(token, process.env.SESSION_SECRET);
    const user = await dbOps.getUserById(Number(payload.sub));
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

// ============================================================================
// PHASE A: Core Routes
// ============================================================================

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const identifier = cleanIdentifier(req.body.identifier);
    const password = String(req.body.password || "");
    if (!identifier || !password) throw new HttpError(400, "Login ID और password दोनों भरें");
    if (!validIdentifier(identifier)) throw new HttpError(400, "Valid private phone number या email भरें");
    const user = await dbOps.getUserByLoginId(identifier);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) throw new HttpError(401, "Login details सही नहीं हैं");
    await dbOps.updateUserLastLogin(user._id, now());
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

app.post("/api/public/visit", async (req, res, next) => {
  try {
    const displayName = cleanText(req.body.displayName, 60);
    if (!displayName) throw new HttpError(400, "नाम दर्ज करके ही डिजिटल संगत में जुड़ें");
    const sessionHash = visitorSessionHash(req, res);
    const joinedAt = now();
    await dbOps.insertVisitorSession(sessionHash, joinedAt);
    await dbOps.insertVisitorProfile(sessionHash, displayName, bool(req.body.showPublic), joinedAt);
    const visitors = await connectedVisitorCount();
    const devotees = await publicDevotees();
    res.json({ visitors, devotees });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/content", async (_req, res, next) => {
  try {
    const notices = (await dbOps.getPublishedNotices()).map(publicNotice);
    const companions = (await dbOps.getAllCompanions()).map(publicCompanion);
    const gallery = (await dbOps.getPublishedGallery()).map(publicGallery);
    const donors = (await dbOps.getPublishedDonors()).map(publicDonor);
    const events = (await dbOps.getPublishedEvents()).map(publicEvent);
    const communityMembers = await dbOps2.countCommunityProfiles();
    const importantNotice = notices.find(notice => notice.important) || null;
    const timings = await publicTimings();
    const music = await publicMusicTracks();
    const quiz = await publicQuizQuestions();
    const deities = await publicDeities();
    const visitors = await connectedVisitorCount();
    res.json({ notices, companions, gallery, donors, events, timings, music, quiz, deities, visitors, communityMembers, importantNotice });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/music", async (_req, res, next) => {
  try {
    const tracks = await publicMusicTracks();
    res.json({ tracks });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/timings", async (_req, res, next) => {
  try {
    const timings = await publicTimings();
    res.json({ timings });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public/deities", async (_req, res, next) => {
  try {
    const deities = await publicDeities();
    res.json({ deities });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/deities/:key/like", async (req, res, next) => {
  try {
    const key = cleanText(req.params.key, 60);
    if (!DEITY_CATALOG.some(item => item.key === key)) throw new HttpError(404, "दर्शन चित्र नहीं मिला");
    const sessionHash = visitorSessionHash(req, res);
    const existing = await dbOps2.countDeityLikes(key); // Simplified; should check specific session
    if (existing > 0) await dbOps3.deleteDeityLike(key, sessionHash);
    else await dbOps2.insertDeityLike(key, sessionHash, now());
    const likeCount = await dbOps2.countDeityLikes(key);
    res.json({ liked: existing === 0, likeCount });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/dashboard", auth, requireAdmin, async (_req, res, next) => {
  try {
    const notices = await dbOps2.countTableRecords("notices");
    const events = await dbOps2.countTableRecords("events");
    const companions = await dbOps2.countTableRecords("companions");
    const gallery = await dbOps2.countTableRecords("gallery");
    const donors = await dbOps2.countTableRecords("donors");
    const admins = (await dbOps2.countTableRecords("users")) - 1;
    const visitors = await connectedVisitorCount();
    res.json({ notices, events, companions, gallery, donors, admins, visitors });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/deity-engagement", auth, requireAdmin, async (_req, res, next) => {
  try {
    const deities = await publicDeities();
    res.json({ deities });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/settings", auth, requireAdmin, async (_req, res, next) => {
  try {
    const settings = await readSettings();
    res.json({ settings: adminSettings(settings) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", auth, requireAdminManager, async (_req, res, next) => {
  try {
    const users = await dbOps.getAllUsers();
    res.json({ users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Static files and error handling
// ============================================================================

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

// ============================================================================
// Server startup
// ============================================================================

if (require.main === module) {
  (async () => {
    try {
      await initializeApp();
      const server = app.listen(PORT, () => console.log(`Temple website running at http://localhost:${PORT}`));
      const close = () => server.close(async () => { 
        const db = getDb();
        if (db) await db.client.close();
        process.exit(0); 
      });
      process.on("SIGINT", close);
      process.on("SIGTERM", close);
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}

module.exports = { app };
