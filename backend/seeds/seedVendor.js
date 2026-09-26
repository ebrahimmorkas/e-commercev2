require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');

// A vendor is found by the hostname a request arrives on (vendorDetection),
// so domain must be exactly the storefront's hostname - www.hutaib.com would
// be a different vendor, so redirect www to the bare domain at the server.
//
// Safe to re-run: matched by domain and updated in place (its _id, which every
// vendor-scoped document points at, never changes). The domain itself can be
// changed later by updating this document.
const VENDOR = {
  domain: 'hutaib.com',
  email: 'morkasebrahim3@gmail.com'
};

async function seedVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    const vendor = await Vendor.findOneAndUpdate(
      { domain: VENDOR.domain },
      {
        $set: { ...VENDOR, updatedAt: new Date() },
        $setOnInsert: { isActive: true, isDeleted: false }
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true
      }
    );

    console.log(`✅ Vendor ${vendor.domain} created/updated (${vendor._id}).`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding vendor:', error);

    await mongoose.connection.close();
    process.exit(1);
  }
}

seedVendor();
