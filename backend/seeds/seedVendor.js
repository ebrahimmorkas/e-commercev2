require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor'); // Update the path if needed

// Override for a deployed environment, e.g. SEED_VENDOR_DOMAIN=my-api.onrender.com
const VENDOR_DOMAIN = (process.env.SEED_VENDOR_DOMAIN || 'localhost').toLowerCase();
const VENDOR_EMAIL = process.env.SEED_VENDOR_EMAIL || `admin@${VENDOR_DOMAIN}`;

async function seedVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const vendor = await Vendor.findOneAndUpdate(
      { domain: VENDOR_DOMAIN }, // Search by domain
      {
        domain: VENDOR_DOMAIN,
        email: VENDOR_EMAIL,
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