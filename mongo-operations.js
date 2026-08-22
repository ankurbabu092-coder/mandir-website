const { getDb } = require("./mongo-client");

// ============================================================================
// CATEGORY A: Simple SELECT by ID (.get())
// ============================================================================

async function getUserById(id) {
  const db = getDb();
  return await db.collection("users").findOne({ _id: id });
}

async function getUserByLoginId(loginId) {
  const db = getDb();
  return await db.collection("users").findOne({ login_id: loginId });
}

async function getNoticeById(id) {
  const db = getDb();
  return await db.collection("notices").findOne({ _id: id });
}

async function getCompanionById(id) {
  const db = getDb();
  return await db.collection("companions").findOne({ _id: id });
}

async function getGalleryById(id) {
  const db = getDb();
  return await db.collection("gallery").findOne({ _id: id });
}

async function getDonorById(id) {
  const db = getDb();
  return await db.collection("donors").findOne({ _id: id });
}

async function getDonationById(id) {
  const db = getDb();
  return await db.collection("donations").findOne({ _id: id });
}

async function getEventById(id) {
  const db = getDb();
  return await db.collection("events").findOne({ _id: id });
}

async function getMusicTrackById(id) {
  const db = getDb();
  return await db.collection("music_tracks").findOne({ _id: id });
}

async function getTimingById(id) {
  const db = getDb();
  return await db.collection("timings").findOne({ _id: id });
}

async function getQuizQuestionById(id) {
  const db = getDb();
  return await db.collection("quiz_questions").findOne({ _id: id });
}

async function getCommunityProfileById(id) {
  const db = getDb();
  return await db.collection("community_profiles").findOne({ _id: id });
}

async function getCommunityProfileBySessionHash(sessionHash) {
  const db = getDb();
  return await db.collection("community_profiles").findOne({ session_hash: sessionHash });
}

async function getCommunityPostById(id) {
  const db = getDb();
  return await db.collection("community_posts").findOne({ _id: id });
}

async function getCommunityCommentById(id) {
  const db = getDb();
  return await db.collection("community_comments").findOne({ _id: id });
}

async function getCommunityFriendshipById(id) {
  const db = getDb();
  return await db.collection("community_friendships").findOne({ _id: id });
}

async function getVisitorProfileBySessionHash(sessionHash) {
  const db = getDb();
  return await db.collection("visitor_profiles").findOne({ session_hash: sessionHash });
}

async function getVisitorSessionByHash(sessionHash) {
  const db = getDb();
  return await db.collection("visitor_sessions").findOne({ session_hash: sessionHash });
}

// ============================================================================
// CATEGORY B: Simple SELECT with WHERE clause (.all())
// ============================================================================

async function getAllUsers() {
  const db = getDb();
  return await db.collection("users")
    .find()
    .sort({ 
      role: 1, // owner first
      created_at: 1 
    })
    .toArray();
}

async function getAllNotices() {
  const db = getDb();
  return await db.collection("notices")
    .find()
    .sort({ updated_at: -1 })
    .toArray();
}

async function getPublishedNotices() {
  const db = getDb();
  return await db.collection("notices")
    .find({ published: 1 })
    .sort({ important: -1, notice_date: -1, created_at: -1 })
    .toArray();
}

async function getAllCompanions() {
  const db = getDb();
  return await db.collection("companions")
    .find()
    .sort({ created_at: -1 })
    .toArray();
}

async function getPublishedGallery() {
  const db = getDb();
  return await db.collection("gallery")
    .find({ published: 1 })
    .sort({ created_at: -1 })
    .toArray();
}

async function getAllGallery() {
  const db = getDb();
  return await db.collection("gallery")
    .find()
    .sort({ created_at: -1 })
    .toArray();
}

async function getPublishedDonors() {
  const db = getDb();
  return await db.collection("donors")
    .find({ published: 1 })
    .sort({ created_at: -1 })
    .toArray();
}

async function getAllDonors() {
  const db = getDb();
  return await db.collection("donors")
    .find()
    .sort({ updated_at: -1 })
    .toArray();
}

async function getPublishedEvents() {
  const db = getDb();
  return await db.collection("events")
    .find({ published: 1 })
    .sort({ event_date: 1, created_at: -1 })
    .toArray();
}

async function getAllEvents() {
  const db = getDb();
  return await db.collection("events")
    .find()
    .sort({ event_date: 1, updated_at: -1 })
    .toArray();
}

async function getPublishedMusicTracks() {
  const db = getDb();
  return await db.collection("music_tracks")
    .find({ published: 1 })
    .sort({ active: -1, sort_order: 1, _id: -1 })
    .toArray();
}

async function getAllMusicTracks() {
  const db = getDb();
  return await db.collection("music_tracks")
    .find()
    .sort({ active: -1, sort_order: 1, updated_at: -1 })
    .toArray();
}

async function getPublishedTimings() {
  const db = getDb();
  return await db.collection("timings")
    .find({ published: 1 })
    .sort({ sort_order: 1, _id: 1 })
    .toArray();
}

async function getAllTimings() {
  const db = getDb();
  return await db.collection("timings")
    .find()
    .sort({ sort_order: 1, _id: 1 })
    .toArray();
}

async function getPublishedQuizQuestions() {
  const db = getDb();
  return await db.collection("quiz_questions")
    .find({ published: 1 })
    .sort({ _id: -1 })
    .toArray();
}

async function getAllQuizQuestions() {
  const db = getDb();
  return await db.collection("quiz_questions")
    .find()
    .sort({ updated_at: -1 })
    .toArray();
}

async function getPublicVisitorProfiles() {
  const db = getDb();
  return await db.collection("visitor_profiles")
    .find({ show_public: 1 })
    .sort({ joined_at: -1 })
    .limit(80)
    .toArray();
}

async function getAllDonations() {
  const db = getDb();
  return await db.collection("donations")
    .find()
    .sort({ donation_date: -1, created_at: -1 })
    .toArray();
}

async function getSuccessfulDonations() {
  const db = getDb();
  return await db.collection("donations")
    .find({ status: "SUCCESS" })
    .toArray();
}

async function getSiteSettingByKey(key) {
  const db = getDb();
  return await db.collection("site_settings").findOne({ _id: key });
}

async function getAllSiteSettings() {
  const db = getDb();
  return await db.collection("site_settings").find().toArray();
}

module.exports = {
  // SELECT by ID
  getUserById,
  getUserByLoginId,
  getNoticeById,
  getCompanionById,
  getGalleryById,
  getDonorById,
  getDonationById,
  getEventById,
  getMusicTrackById,
  getTimingById,
  getQuizQuestionById,
  getCommunityProfileById,
  getCommunityProfileBySessionHash,
  getCommunityPostById,
  getCommunityCommentById,
  getCommunityFriendshipById,
  getVisitorProfileBySessionHash,
  getVisitorSessionByHash,
  
  // SELECT all/filtered
  getAllUsers,
  getAllNotices,
  getPublishedNotices,
  getAllCompanions,
  getPublishedGallery,
  getAllGallery,
  getPublishedDonors,
  getAllDonors,
  getPublishedEvents,
  getAllEvents,
  getPublishedMusicTracks,
  getAllMusicTracks,
  getPublishedTimings,
  getAllTimings,
  getPublishedQuizQuestions,
  getAllQuizQuestions,
  getPublicVisitorProfiles,
  getAllDonations,
  getSuccessfulDonations,
  getSiteSettingByKey,
  getAllSiteSettings,
};
