const mongoose = require("mongoose");
const connectDB = async () => {
  try {
    const c = await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB:", c.connection.host);
  } catch (e) { console.error("❌ DB:", e.message); process.exit(1); }
};
module.exports = connectDB;
