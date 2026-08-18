const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const runMigration = async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/lyvo";
  console.log(`🔌 Connecting to database: ${uri}`);
  await mongoose.connect(uri);
  
  console.log("⚙️ Running automated database migrations...");
  
  // Fetch generic collection model to run dynamic migrations
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  
  const res = await User.updateMany(
    { passwordHistory: { $exists: false } },
    { $set: { passwordHistory: [] } }
  );
  
  console.log(`✅ Updated ${res.modifiedCount} users to initialize passwordHistory`);
  console.log("🎉 Migration sequence completed successfully");
  await mongoose.disconnect();
};

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
