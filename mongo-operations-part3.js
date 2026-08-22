const { getDb } = require("./mongo-client");

// ============================================================================
// CATEGORY F: UPDATE operations
// ============================================================================

async function updateUserLastLogin(userId, lastLogin) {
  const db = getDb();
  await db.collection("users").updateOne({ _id: userId }, { $set: { last_login: lastLogin } });
}

async function updateUserRole(userId, role, canManageAdmins) {
  const db = getDb();
  await db.collection("users").updateOne(
    { _id: userId },
    { $set: { role, can_manage_admins: canManageAdmins ? 1 : 0 } }
  );
}

async function updateNotice(id, title, body, noticeDate, important, published, updatedAt) {
  const db = getDb();
  await db.collection("notices").updateOne(
    { _id: id },
    { $set: { title, body, notice_date: noticeDate, important: important ? 1 : 0, published: published ? 1 : 0, updated_at: updatedAt } }
  );
}

async function updateCompanion(id, name, role, bio, photoUrl) {
  const db = getDb();
  await db.collection("companions").updateOne(
    { _id: id },
    { $set: { name, role, bio, photo_url: photoUrl } }
  );
}

async function updateGalleryItem(id, imageUrl, caption, category, published) {
  const db = getDb();
  await db.collection("gallery").updateOne(
    { _id: id },
    { $set: { image_url: imageUrl, caption, category, published: published ? 1 : 0 } }
  );
}

async function updateDonor(id, name, published, updatedAt) {
  const db = getDb();
  await db.collection("donors").updateOne(
    { _id: id },
    { $set: { name, published: published ? 1 : 0, updated_at: updatedAt } }
  );
}

async function updateDonation(id, amount, donationDate, status, note, updatedAt) {
  const db = getDb();
  await db.collection("donations").updateOne(
    { _id: id },
    { $set: { amount, donation_date: donationDate, status, note, updated_at: updatedAt } }
  );
}

async function updateEvent(id, title, body, eventDate, published, updatedAt) {
  const db = getDb();
  await db.collection("events").updateOne(
    { _id: id },
    { $set: { title, body, event_date: eventDate, published: published ? 1 : 0, updated_at: updatedAt } }
  );
}

async function updateMusicTrack(id, title, url, kind, thumbnailUrl, published, active, sortOrder, updatedAt) {
  const db = getDb();
  await db.collection("music_tracks").updateOne(
    { _id: id },
    { $set: { title, url, kind, thumbnail_url: thumbnailUrl, published: published ? 1 : 0, active: active ? 1 : 0, sort_order: sortOrder, updated_at: updatedAt } }
  );
}

async function deactivateAllMusicTracks() {
  const db = getDb();
  await db.collection("music_tracks").updateMany({}, { $set: { active: 0 } });
}

async function updateTiming(id, label, timeText, note, description, photoUrl, audioUrl, published, sortOrder, updatedAt) {
  const db = getDb();
  await db.collection("timings").updateOne(
    { _id: id },
    { $set: { label, time_text: timeText, note, description, photo_url: photoUrl, audio_url: audioUrl, published: published ? 1 : 0, sort_order: sortOrder, updated_at: updatedAt } }
  );
}

async function updateQuizQuestion(id, question, optionsJson, answerIndex, explanation, published, updatedAt) {
  const db = getDb();
  await db.collection("quiz_questions").updateOne(
    { _id: id },
    { $set: { question, options_json: optionsJson, answer_index: answerIndex, explanation, published: published ? 1 : 0, updated_at: updatedAt } }
  );
}

async function updateCommunityProfileLastSeen(profileId, lastSeen) {
  const db = getDb();
  await db.collection("community_profiles").updateOne({ _id: profileId }, { $set: { last_seen: lastSeen } });
}

async function updateCommunityProfile(sessionHash, displayName, bio) {
  const db = getDb();
  await db.collection("community_profiles").updateOne(
    { session_hash: sessionHash },
    { $set: { display_name: displayName, bio } }
  );
}

async function updateCommunityFriendshipStatus(id, status, updatedAt) {
  const db = getDb();
  await db.collection("community_friendships").updateOne(
    { _id: id },
    { $set: { status, updated_at: updatedAt } }
  );
}

async function upsertSiteSetting(key, value, updatedAt) {
  const db = getDb();
  await db.collection("site_settings").updateOne(
    { _id: key },
    { $set: { key, value, updated_at: updatedAt } },
    { upsert: true }
  );
}

// ============================================================================
// CATEGORY G: DELETE operations
// ============================================================================

async function deleteUser(userId) {
  const db = getDb();
  const result = await db.collection("users").deleteOne({ _id: userId });
  return result.deletedCount > 0;
}

async function deleteNotice(id) {
  const db = getDb();
  const result = await db.collection("notices").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteCompanion(id) {
  const db = getDb();
  const result = await db.collection("companions").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteGalleryItem(id) {
  const db = getDb();
  const result = await db.collection("gallery").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteDonor(id) {
  const db = getDb();
  const result = await db.collection("donors").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteDonation(id) {
  const db = getDb();
  const result = await db.collection("donations").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteEvent(id) {
  const db = getDb();
  const result = await db.collection("events").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteMusicTrack(id) {
  const db = getDb();
  const result = await db.collection("music_tracks").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteTiming(id) {
  const db = getDb();
  const result = await db.collection("timings").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteQuizQuestion(id) {
  const db = getDb();
  const result = await db.collection("quiz_questions").deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function deleteDeityLike(deityKey, sessionHash) {
  const db = getDb();
  const result = await db.collection("deity_likes").deleteOne({ deity_key: deityKey, session_hash: sessionHash });
  return result.deletedCount > 0;
}

async function deleteCommunityLike(postId, profileId) {
  const db = getDb();
  const result = await db.collection("community_likes").deleteOne({ post_id: postId, profile_id: profileId });
  return result.deletedCount > 0;
}

async function deleteCommunityFriendships(requesterId, recipientId) {
  const db = getDb();
  await db.collection("community_friendships").deleteMany({
    $or: [
      { requester_id: requesterId, recipient_id: recipientId },
      { requester_id: recipientId, recipient_id: requesterId }
    ]
  });
}

// ============================================================================
// CATEGORY I: JOIN queries (aggregation pipelines)
// ============================================================================

async function getCommunityPostWithComments(postId, profileId) {
  const db = getDb();
  const posts = await db.collection("community_posts").aggregate([
    { $match: { _id: postId, hidden: 0 } },
    { $lookup: {
        from: "community_profiles",
        localField: "profile_id",
        foreignField: "_id",
        as: "profile_data"
      }
    },
    { $unwind: "$profile_data" },
    { $addFields: {
        display_name: "$profile_data.display_name",
        last_seen: "$profile_data.last_seen"
      }
    },
    { $project: { profile_data: 0 } }
  ]).toArray();

  if (posts.length === 0) return null;
  
  const post = posts[0];
  const comments = await db.collection("community_comments").aggregate([
    { $match: { post_id: postId, hidden: 0 } },
    { $lookup: {
        from: "community_profiles",
        localField: "profile_id",
        foreignField: "_id",
        as: "profile_data"
      }
    },
    { $unwind: "$profile_data" },
    { $project: {
        id: "$_id",
        body: 1,
        created_at: 1,
        profile_id: 1,
        display_name: "$profile_data.display_name",
        last_seen: "$profile_data.last_seen"
      }
    }
  ]).toArray();

  return { ...post, comments, likeCount: 0, liked: false };
}

async function getAllCommunityPosts(profileId) {
  const db = getDb();
  const posts = await db.collection("community_posts").aggregate([
    { $match: { hidden: 0 } },
    { $lookup: {
        from: "community_profiles",
        localField: "profile_id",
        foreignField: "_id",
        as: "profile_data"
      }
    },
    { $unwind: "$profile_data" },
    { $lookup: {
        from: "community_blocks",
        let: { profileId: "$profile_id", myId: profileId || 0 },
        pipeline: [
          { $match: {
              $expr: {
                $or: [
                  { $and: [{ $eq: ["$blocker_id", "$$myId"] }, { $eq: ["$blocked_id", "$$profileId"] }] },
                  { $and: [{ $eq: ["$blocker_id", "$$profileId"] }, { $eq: ["$blocked_id", "$$myId"] }] }
                ]
              }
            }
          }
        ],
        as: "blocks"
      }
    },
    { $match: { blocks: { $eq: [] } } },
    { $addFields: {
        display_name: "$profile_data.display_name",
        last_seen: "$profile_data.last_seen"
      }
    },
    { $sort: { created_at: -1 } },
    { $limit: 60 },
    { $project: { profile_data: 0, blocks: 0 } }
  ]).toArray();

  return posts;
}

async function getCommunityProfiles(profileId) {
  const db = getDb();
  return await db.collection("community_profiles").aggregate([
    { $match: { _id: { $ne: profileId || 0 } } },
    { $lookup: {
        from: "community_blocks",
        let: { profileId: "$_id", myId: profileId || 0 },
        pipeline: [
          { $match: {
              $expr: {
                $or: [
                  { $and: [{ $eq: ["$blocker_id", "$$myId"] }, { $eq: ["$blocked_id", "$$profileId"] }] },
                  { $and: [{ $eq: ["$blocker_id", "$$profileId"] }, { $eq: ["$blocked_id", "$$myId"] }] }
                ]
              }
            }
          }
        ],
        as: "blocks"
      }
    },
    { $match: { blocks: { $eq: [] } } },
    { $sort: { last_seen: -1 } },
    { $limit: 80 },
    { $project: { blocks: 0 } }
  ]).toArray();
}

async function getCommunityConnections(profileId) {
  const db = getDb();
  const friendIds = await db.collection("community_friendships").aggregate([
    { $match: {
        $or: [
          { requester_id: profileId, status: "ACCEPTED" },
          { recipient_id: profileId, status: "ACCEPTED" }
        ]
      }
    },
    { $project: {
        friendId: {
          $cond: [{ $eq: ["$requester_id", profileId] }, "$recipient_id", "$requester_id"]
        }
      }
    },
    { $group: { _id: "$friendId" } }
  ]).toArray();

  const ids = friendIds.map(f => f._id);
  return await db.collection("community_profiles").find({ _id: { $in: ids } }).sort({ display_name: 1 }).toArray();
}

async function getCommunityFriendshipRequests(profileId) {
  const db = getDb();
  return await db.collection("community_friendships").aggregate([
    { $match: { recipient_id: profileId, status: "PENDING" } },
    { $lookup: {
        from: "community_profiles",
        localField: "requester_id",
        foreignField: "_id",
        as: "profile"
      }
    },
    { $unwind: "$profile" },
    { $project: {
        id: "$_id",
        requesterId: "$requester_id",
        name: "$profile.display_name",
        status: 1
      }
    }
  ]).toArray();
}

async function getCommunityOutgoingRequests(profileId) {
  const db = getDb();
  return await db.collection("community_friendships").aggregate([
    { $match: { requester_id: profileId, status: "PENDING" } },
    { $lookup: {
        from: "community_profiles",
        localField: "recipient_id",
        foreignField: "_id",
        as: "profile"
      }
    },
    { $unwind: "$profile" },
    { $project: {
        id: "$_id",
        recipientId: "$recipient_id",
        name: "$profile.display_name",
        status: 1
      }
    }
  ]).toArray();
}

async function getCommunityReports() {
  const db = getDb();
  return await db.collection("community_reports").aggregate([
    { $lookup: {
        from: "community_profiles",
        localField: "reporter_id",
        foreignField: "_id",
        as: "reporter"
      }
    },
    { $unwind: "$reporter" },
    { $project: {
        id: "$_id",
        reason: 1,
        createdAt: "$created_at",
        postId: "$post_id",
        commentId: "$comment_id",
        reporterName: "$reporter.display_name"
      }
    }
  ]).toArray();
}

module.exports = {
  // UPDATE
  updateUserLastLogin,
  updateUserRole,
  updateNotice,
  updateCompanion,
  updateGalleryItem,
  updateDonor,
  updateDonation,
  updateEvent,
  updateMusicTrack,
  deactivateAllMusicTracks,
  updateTiming,
  updateQuizQuestion,
  updateCommunityProfileLastSeen,
  updateCommunityProfile,
  updateCommunityFriendshipStatus,
  upsertSiteSetting,

  // DELETE
  deleteUser,
  deleteNotice,
  deleteCompanion,
  deleteGalleryItem,
  deleteDonor,
  deleteDonation,
  deleteEvent,
  deleteMusicTrack,
  deleteTiming,
  deleteQuizQuestion,
  deleteDeityLike,
  deleteCommunityLike,
  deleteCommunityFriendships,

  // JOIN queries
  getCommunityPostWithComments,
  getAllCommunityPosts,
  getCommunityProfiles,
  getCommunityConnections,
  getCommunityFriendshipRequests,
  getCommunityOutgoingRequests,
  getCommunityReports,
};
