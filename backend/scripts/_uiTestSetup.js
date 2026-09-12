require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VENDOR_ID = '6a63443e263b29b8e59374eb';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');
    const WebsiteMaster = require('../models/WebsiteMaster');
    const CompanyMaster = require('../models/CompanyMaster');
    const CompanySettings = require('../models/CompanySettings');
    const Cart = require('../models/Cart');

    await WebsiteMaster.updateOne({}, { $set: { isAbondonedCartFeatureOn: true } });
    await CompanyMaster.updateOne({ vendorId: VENDOR_ID }, { $set: { isAbondonedCartFeatureOn: true } });
    await CompanySettings.updateOne({ vendorId: VENDOR_ID }, { $set: { timeForAbondonedCartReflection: 30, abondonedCartOnlyForLoggedInUsers: false } });

    // Test admin (known password, for logging into the browser UI)
    await User.deleteOne({ username: 'uitestadmin' });
    const hashedPassword = await bcrypt.hash('UiTest@1234', Number(process.env.SALT_ROUNDS) || 10);
    const admin = await User.create({
        vendorId: VENDOR_ID,
        name: 'UI Test Admin',
        username: 'uitestadmin',
        phone_no: '9000000001',
        email: 'uitestadmin@test.com',
        password: hashedPassword,
        role: 'admin',
        country: 'India',
        state: 'TestState',
        city: 'TestCity',
        status: 'A'
    });
    console.log('Created test admin:', admin._id.toString());

    // Two shopper users to own the two abandoned carts
    await User.deleteMany({ username: { $in: ['uishopper1', 'uishopper2'] } });
    const shopper1 = await User.create({
        vendorId: VENDOR_ID, name: 'Riya Sharma', username: 'uishopper1',
        phone_no: '9111111111', email: 'riya.sharma@test.com', role: 'user',
        country: 'India', state: 'Maharashtra', city: 'Mumbai', status: 'A'
    });
    const shopper2 = await User.create({
        vendorId: VENDOR_ID, name: 'Arjun Mehta', username: 'uishopper2',
        phone_no: '9222222222', email: 'arjun.mehta@test.com', role: 'user',
        country: 'India', state: 'Karnataka', city: 'Bengaluru', status: 'A'
    });

    await Cart.deleteMany({ userId: { $in: [shopper1._id, shopper2._id] } });
    await Cart.deleteMany({ possibleUserId: { $in: [shopper1._id, shopper2._id] } });

    const productLine = (productId, productName, variantId, variantName, sizeId, sizeName, unitPrice, sku, quantity) => ({
        productId, productName,
        variants: [{ variantId, variantName, sizes: [{ sizeId, sizeName, unitPrice, sku, quantity, labelValue: sizeName[0], isCheckedOut: false }] }]
    });

    const now = new Date();
    const fortyMinAgo = new Date(now.getTime() - 40 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Cart 1: logged-in user, confirmed contact info
    await Cart.create({
        vendorId: VENDOR_ID,
        userId: shopper1._id,
        products: [productLine('6a82e2c8a8e1770d96e32205', 'Premium Denim Jacket', '6a82e2c8a8e1770d96e32206', 'Blue', '6a82e2c8a8e1770d96e32207', 'Small', 2799, 'JCKT-BLUE-S', 1)],
        lastProductAddedAt: fortyMinAgo,
        isAbandoned: true,
        abandonedAt: fifteenMinAgo,
        status: 'A'
    });

    // Cart 2: guest cart with possibleUserId hint, unconfirmed contact info
    await Cart.create({
        vendorId: VENDOR_ID,
        guestId: 'ui-test-guest-' + Date.now(),
        possibleUserId: shopper2._id,
        products: [productLine('6a853d66e9eb0043571d7712', 'Classic Cotton Tee', '6a853d66e9eb0043571d7713', 'Red', '6a853d66e9eb0043571d7714', 'Medium', 499, 'TEE-RED-M', 2)],
        lastProductAddedAt: fortyMinAgo,
        isAbandoned: true,
        abandonedAt: fifteenMinAgo,
        status: 'A'
    });

    console.log('Created 2 abandoned cart fixtures (LOGGED_IN + GUEST_KNOWN).');
    await mongoose.disconnect();
})().catch((err) => { console.error('SETUP FAILED', err); process.exit(1); });
