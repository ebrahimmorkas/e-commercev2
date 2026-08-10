require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor'); // Update the path if needed

async function seedVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const vendor = await Vendor.findOneAndUpdate(
      { domain: 'localhost' }, // Search by domain
      {
        domain: 'localhost',
        email: 'admin@localhost.com',
        isActive: true,
        isDeleted: false,
        updatedAt: new Date(),
      },
      {
        upsert: true, // Insert if not found
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log('Vendor created/updated successfully.');
    console.log(vendor);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendor:', error);
    process.exit(1);
  }
}

seedVendor();