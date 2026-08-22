const { getDb } = require("./mongo-client");

// ============================================================================
// CATEGORY C: COUNT and AGGREGATIONS
// ============================================================================

async function countVisitorProfiles() {
  const db = getDb();
  return await db.collection("visitor_profiles").countDocuments();
}

async function countCommunityProfiles() {
  const db = getDb();
  return await db.collection("community_profiles").countDocuments();
}

async function countTodayVisitors() {
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await db.collection("visitor_sessions").countDocuments({ first_seen: { $gte: today } });
}

async function countDeityLikes(deityKey) {
  const db = getDb();
  return await db.collection("deity_likes").countDocuments({ deity_key: deityKey });
}

async function countCommunityLikes(postId) {
  const db = getDb();
  return await db.collection("community_likes").countDocuments({ post_id: postId });
}

async function countTableRecords(tableName) {
  const db = getDb();
  return await db.collection(tableName).countDocuments();
}

async function getVerifiedDonationSummary() {
  const db = getDb();
  const result = await db.collection("donations").aggregate([
    { $match: { status: "SUCCESS" } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: "$amount" }
      }
    }
  ]).toArray();

  if (result.length === 0) return null;
  return { count: result[0].count, total: result[0].total };
}

// ============================================================================
// CATEGORY E: INSERT operations
// ============================================================================

async function insertUser(name, loginId, passwordHash, role, canManageAdmins, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("users");
  const result = await db.collection("users").insertOne({
    _id: nextId,
    name,
    login_id: loginId,
    password_hash: passwordHash,
    role,
    can_manage_admins: canManageAdmins ? 1 : 0,
    created_at: createdAt,
    last_login: null
  });
  return { insertedId: result.insertedId, lastInsertRowid: result.insertedId };
}

async function insertNotice(title, body, noticeDate, important, published, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("notices");
  const result = await db.collection("notices").insertOne({
    _id: nextId,
    title,
    body,
    notice_date: noticeDate,
    important: important ? 1 : 0,
    published: published ? 1 : 0,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertGalleryItem(imageUrl, caption, category, published, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("gallery");
  const result = await db.collection("gallery").insertOne({
    _id: nextId,
    image_url: imageUrl,
    caption,
    category,
    published: published ? 1 : 0,
    created_at: createdAt
  });
  return result;
}

async function insertCompanion(name, role, bio, photoUrl, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("companions");
  const result = await db.collection("companions").insertOne({
    _id: nextId,
    name,
    role,
    bio,
    photo_url: photoUrl,
    created_at: createdAt
  });
  return result;
}

async function insertDonor(name, published, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("donors");
  const result = await db.collection("donors").insertOne({
    _id: nextId,
    name,
    published: published ? 1 : 0,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertDonation(amount, donationDate, status, note, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("donations");
  const result = await db.collection("donations").insertOne({
    _id: nextId,
    amount,
    donation_date: donationDate,
    status,
    note,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertEvent(title, body, eventDate, published, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("events");
  const result = await db.collection("events").insertOne({
    _id: nextId,
    title,
    body,
    event_date: eventDate,
    published: published ? 1 : 0,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertMusicTrack(title, url, kind, thumbnailUrl, published, active, sortOrder, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("music_tracks");
  const result = await db.collection("music_tracks").insertOne({
    _id: nextId,
    title,
    url,
    kind,
    thumbnail_url: thumbnailUrl,
    published: published ? 1 : 0,
    active: active ? 1 : 0,
    sort_order: sortOrder,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertTiming(label, timeText, note, description, photoUrl, audioUrl, published, sortOrder, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("timings");
  const result = await db.collection("timings").insertOne({
    _id: nextId,
    label,
    time_text: timeText,
    note,
    description,
    photo_url: photoUrl,
    audio_url: audioUrl,
    published: published ? 1 : 0,
    sort_order: sortOrder,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertQuizQuestion(question, optionsJson, answerIndex, explanation, published, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("quiz_questions");
  const result = await db.collection("quiz_questions").insertOne({
    _id: nextId,
    question,
    options_json: optionsJson,
    answer_index: answerIndex,
    explanation,
    published: published ? 1 : 0,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertVisitorSession(sessionHash, firstSeen) {
  const db = getDb();
  try {
    await db.collection("visitor_sessions").insertOne({
      session_hash: sessionHash,
      first_seen: firstSeen
    });
  } catch (error) {
    // Ignore duplicate key error
  }
}

async function insertVisitorProfile(sessionHash, displayName, showPublic, joinedAt) {
  const db = getDb();
  await db.collection("visitor_profiles").updateOne(
    { session_hash: sessionHash },
    {
      $set: {
        session_hash: sessionHash,
        display_name: displayName,
        show_public: showPublic ? 1 : 0,
        joined_at: joinedAt
      }
    },
    { upsert: true }
  );
}

async function insertCommunityProfile(sessionHash, displayName, bio, createdAt, lastSeen) {
  const db = getDb();
  await db.collection("community_profiles").updateOne(
    { session_hash: sessionHash },
    {
      $set: {
        session_hash: sessionHash,
        display_name: displayName,
        bio,
        created_at: createdAt,
        last_seen: lastSeen
      }
    },
    { upsert: true }
  );
  return await db.collection("community_profiles").findOne({ session_hash: sessionHash });
}

async function insertCommunityPost(profileId, body, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("community_posts");
  const result = await db.collection("community_posts").insertOne({
    _id: nextId,
    profile_id: profileId,
    body,
    hidden: 0,
    created_at: createdAt
  });
  return result;
}

async function insertCommunityComment(postId, profileId, body, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("community_comments");
  const result = await db.collection("community_comments").insertOne({
    _id: nextId,
    post_id: postId,
    profile_id: profileId,
    body,
    hidden: 0,
    created_at: createdAt
  });
  return result;
}

async function insertCommunityFriendship(requesterId, recipientId, status, createdAt, updatedAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("community_friendships");
  const result = await db.collection("community_friendships").insertOne({
    _id: nextId,
    requester_id: requesterId,
    recipient_id: recipientId,
    status,
    created_at: createdAt,
    updated_at: updatedAt
  });
  return result;
}

async function insertDeityLike(deityKey, sessionHash, createdAt) {
  const db = getDb();
  await db.collection("deity_likes").insertOne({
    deity_key: deityKey,
    session_hash: sessionHash,
    created_at: createdAt
  });
}

async function insertCommunityLike(postId, profileId, createdAt) {
  const db = getDb();
  await db.collection("community_likes").insertOne({
    post_id: postId,
    profile_id: profileId,
    created_at: createdAt
  });
}

async function insertCommunityReport(reporterId, postId, commentId, reason, createdAt) {
  const db = getDb();
  const nextId = await getNextSequenceId("community_reports");
  await db.collection("community_reports").insertOne({
    _id: nextId,
    reporter_id: reporterId,
    post_id: postId,
    comment_id: commentId,
    reason,
    created_at: createdAt
  });
}

async function insertCommunityBlock(blockerId, blockedId, createdAt) {
  const db = getDb();
  await db.collection("community_blocks").insertOne({
    blocker_id: blockerId,
    blocked_id: blockedId,
    created_at: createdAt
  });
}

// ============================================================================
// SEQUENCE COUNTER HELPER
// ============================================================================

async function getNextSequenceId(collection) {
  const db = getDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: collection },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  return result.value ? result.value.seq : 1;
}

module.exports = {
  // COUNT
  countVisitorProfiles,
  countCommunityProfiles,
  countTodayVisitors,
  countDeityLikes,
  countCommunityLikes,
  countTableRecords,
  getVerifiedDonationSummary,
  
  // INSERT
  insertUser,
  insertNotice,
  insertGalleryItem,
  insertCompanion,
  insertDonor,
  insertDonation,
  insertEvent,
  insertMusicTrack,
  insertTiming,
  insertQuizQuestion,
  insertVisitorSession,
  insertVisitorProfile,
  insertCommunityProfile,
  insertCommunityPost,
  insertCommunityComment,
  insertCommunityFriendship,
  insertDeityLike,
  insertCommunityLike,
  insertCommunityReport,
  insertCommunityBlock,
  
  // Helpers
  getNextSequenceId,
};
