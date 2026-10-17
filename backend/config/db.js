const mongoose = require("mongoose");

const connectDB = async () => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected:", connection.connection.host);
    console.log("📦 Database:", connection.connection.name);

    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;