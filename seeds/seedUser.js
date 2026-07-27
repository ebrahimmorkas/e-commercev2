// seed-user.js

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User"); // Update the path if necessary

async function seedUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");

        const vendorId = new mongoose.Types.ObjectId(
            "6a660d580c332ce960286ce0"
        );

        const email = "admin@example.com";

        // Check if the user already exists
        const existingUser = await User.findOne({
            vendorId,
            email,
        });

        if (existingUser) {
            console.log("⚠️ User already exists.");
            process.exit(0);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash("Admin@123", 10);

        // Create the user
        await User.create({
            vendorId,
            name: "Admin User",
            username: "admin",
            password: hashedPassword,
            authProvider: "local",
            googleId: null,
            phone_no: "9876543210",
            whatsapp_no: "9876543210",
            email,
            role: "admin",
            status: "A",
        });

        console.log("✅ User seeded successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding user:", error);
        process.exit(1);
    }
}

seedUser();