const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = "super_test_secret_key_123456789";
  process.env.JWT_REFRESH_SECRET = "super_test_refresh_secret_key_123456789";
  process.env.CLOUDINARY_CLOUD_NAME = "dummy";
  process.env.CLOUDINARY_API_KEY = "dummy";
  process.env.CLOUDINARY_API_SECRET = "dummy";
  process.env.RAZORPAY_KEY_ID = "dummy";
  process.env.RAZORPAY_KEY_SECRET = "dummy";

  mongoServer = await MongoMemoryReplSet.create({
    replSize: 1,
    replSet: { storageEngine: "wiredTiger" }
  });
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
