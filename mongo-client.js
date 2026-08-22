const { MongoClient } = require("mongodb");

let mongoClient;
let mongoDb;

async function connectMongo() {
  if (mongoDb) return mongoDb; // Already connected

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  mongoClient = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db("mandirdb");
    console.log("✅ MongoDB connected");
    
    // Initialize collections and indexes
    await initializeCollections(mongoDb);
    
    return mongoDb;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
}

async function initializeCollections(db) {
  const collections = [
    "users",
    "notices",
    "companions",
    "gallery",
    "site_settings",
    "donors",
    "visitor_sessions",
    "visitor_profiles",
    "donations",
    "events",
    "music_tracks",
    "timings",
    "quiz_questions",
    "deity_likes",
    "community_profiles",
    "community_friendships",
    "community_posts",
    "community_likes",
    "community_comments",
    "community_reports",
    "community_blocks",
    "counters"
  ];

  for (const name of collections) {
    try {
      await db.createCollection(name);
      console.log(`  ✓ Created collection: ${name}`);
    } catch (error) {
      // Collection already exists, that's fine
      if (!error.message.includes("already exists")) {
        console.warn(`  ⚠ ${name}: ${error.message}`);
      }
    }
  }

  // Create indexes for performance and uniqueness
  await createIndexes(db);
}

async function createIndexes(db) {
  const indexMap = {
    users: [{ key: { login_id: 1 }, options: { unique: true } }],
    site_settings: [{ key: { key: 1 }, options: { unique: true } }],
    visitor_sessions: [{ key: { session_hash: 1 }, options: { unique: true } }],
    visitor_profiles: [{ key: { session_hash: 1 }, options: { unique: true } }],
    gallery: [{ key: { created_at: -1 } }],
    music_tracks: [
      { key: { active: -1, sort_order: 1 } },
      { key: { created_at: -1 } }
    ],
    timings: [{ key: { sort_order: 1 } }],
    quiz_questions: [{ key: { created_at: -1 } }],
    deity_likes: [{ key: { deity_key: 1, session_hash: 1 }, options: { unique: true } }],
    community_profiles: [
      { key: { session_hash: 1 }, options: { unique: true } },
      { key: { last_seen: -1 } }
    ],
    community_friendships: [
      { key: { requester_id: 1, recipient_id: 1 }, options: { unique: true } },
      { key: { status: 1 } }
    ],
    community_posts: [{ key: { created_at: -1 } }],
    community_comments: [{ key: { post_id: 1, created_at: -1 } }],
    community_likes: [{ key: { post_id: 1, profile_id: 1 }, options: { unique: true } }],
    community_blocks: [{ key: { blocker_id: 1, blocked_id: 1 }, options: { unique: true } }],
  };

  for (const [collName, indexes] of Object.entries(indexMap)) {
    const coll = db.collection(collName);
    for (const index of indexes) {
      try {
        await coll.createIndex(index.key, index.options || {});
      } catch (error) {
        // Index may already exist
      }
    }
  }

  console.log("  ✓ Indexes created");
}

async function closeMongo() {
  if (mongoClient) {
    await mongoClient.close();
    mongoDb = null;
    mongoClient = null;
    console.log("✅ MongoDB disconnected");
  }
}

function getDb() {
  if (!mongoDb) {
    throw new Error("MongoDB not initialized. Call connectMongo() first.");
  }
  return mongoDb;
}

module.exports = {
  connectMongo,
  closeMongo,
  getDb,
};
