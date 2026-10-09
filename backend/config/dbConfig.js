const mongoose = require("mongoose");
const logger = require("./loggerConfig");

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: process.env.NODE_ENV !== "production",
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
  } catch (error) {
    logger.error({ err: error }, "MongoDB connection failed");

    process.exit(1);
  }
};

module.exports = connectDB;