// End-to-end discount flow against a real MongoDB: admin create/update/status
// (discountService) and the storefront cart list/apply/re-check (cartService).
//
// Uses its own throwaway database - the MONGODB_URI database name with
// "-discount-test" appended - and drops it afterwards. Skipped when MongoDB
// isn't reachable.
require('dotenv').config({ quiet: true });
process.env.IS_REDIS_SERVER_ON = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const Discount = require('../models/Discount');
const Cart = require('../models/Cart');
const Group = require('../models/Group');
const discountService = require('../services/discountService');
const cartService = require('../services/cartService');
const { toDateKey } = require('../utils/discountSchedule');

const TZ = 'Asia/Kolkata';
const id = () => new mongoose.Types.ObjectId();
const VENDOR = id();
const OTHER_VENDOR = id();
const ADMIN = id();
const MEMBER = id();
const OUTSIDER = id();
const PRODUCT_A = id();
const PRODUCT_B = id();
const CATEGORY_A = id();
const flags = { isDiscountFeatureOn: true, isCartFeatureOn: true };

// "YYYY-MM-DD" n days from today in India.
const day = (n) => toDateKey(new Date(Date.now() + n * 86400000), TZ);

const testDbUri = () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = `${uri.pathname.replace(/^\//, '') || 'test'}-discount-test`;
    return uri.toString();
};

let connected = false;

test.before(async () => {
    try {
        await mongoose.connect(testDbUri(), { serverSelectionTimeoutMS: 3000 });
        connected = mongoose.connection.db.databaseName.endsWith('-discount-test');
    } catch (err) {
        connected = false;
    }
    if (!connected) return;
    await mongoose.connection.db.dropDatabase();

    const db = mongoose.connection.db;
    await db.collection('products').insertMany([
        { _id: PRODUCT_A, vendorId: VENDOR, name: 'Shirt', status: 'A', mainCategory: CATEGORY_A },
        { _id: PRODUCT_B, vendorId: VENDOR, name: 'Cap', status: 'A', mainCategory: id() }
    ]);
    await db.collection('users').insertMany([
        { _id: MEMBER, vendorId: VENDOR, email: 'member@shop.test', role: 'user', status: 'A' },
        { _id: OUTSIDER, vendorId: VENDOR, email: 'outsider@shop.test', role: 'user', status: 'A' },
        { _id: id(), vendorId: OTHER_VENDOR, email: 'elsewhere@shop.test', role: 'user', status: 'A' }
    ]);
});

test.after(async () => {
    if (connected) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});

const skipUnlessDb = (t) => {
    if (!connected) t.skip('MongoDB not reachable');
    return !connected;
};

const payload = (over = {}) => ({
    name: 'Sale',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS',
    startDate: day(0),
    endDate: day(5),
    timezone: TZ,
    ...over
});

const create = (over, files = {}) => discountService.createDiscount(VENDOR, ADMIN, payload(over), files, flags);

// Cart: 2 x Shirt at 100 + 1 x Cap at 50 = 250.
const makeCart = async (userId) => {
    await Cart.deleteMany({ vendorId: VENDOR, userId });
    const line = (productId, productName, unitPrice, quantity) => ({
        productId, productName,
        variants: [{ variantId: id(), variantName: 'Default', sizes: [{ sizeId: id(), sizeName: 'M', unitPrice, sku: `SKU-${productName}`, quantity }] }]
    });
    return Cart.create({
        vendorId: VENDOR, userId, status: 'A',
        products: [line(PRODUCT_A, 'Shirt', 100, 2), line(PRODUCT_B, 'Cap', 50, 1)]
    });
};

const owner = (userId) => ({ type: 'user', id: userId });
const list = (userId) => cartService.listEligibleDiscountsForCart(VENDOR, owner(userId), userId, flags, flags, null, null);
const apply = (userId, body) => cartService.applyDiscountsToCart(VENDOR, owner(userId), userId, flags, flags, body, null, null);

const clearDiscounts = () => Discount.deleteMany({});

test('dates are stored as whole days in the discount timezone', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const result = await create({ startDate: '2099-10-01', endDate: '2099-10-02' });
    assert.equal(result.isSuccess, true, result.message);
    assert.equal(result.meta.data.startDate.toISOString(), '2099-09-30T18:30:00.000Z');
    assert.equal(result.meta.data.endDate.toISOString(), '2099-10-02T18:29:59.999Z');

    const past = await create({ startDate: day(-1), endDate: day(3) });
    assert.equal(past.statusCode, 400);
    assert.match(past.message, /startDate cannot be before today/);
    const backwards = await create({ startDate: day(3), endDate: day(1) });
    assert.equal(backwards.statusCode, 400);
});

test('coupon codes: unique among live discounts, reusable once expired, live one wins', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const first = await create({ isCouponCodeDiscount: true, couponCode: 'SAVE10' });
    assert.equal(first.isSuccess, true, first.message);
    const clash = await create({ isCouponCodeDiscount: true, couponCode: 'save10' });
    assert.equal(clash.statusCode, 409);

    // Expire the first one: the code is free again.
    await Discount.updateOne({ _id: first.meta.data._id }, { $set: { endDate: new Date(Date.now() - 86400000), startDate: new Date(Date.now() - 3 * 86400000) } });
    const second = await create({ isCouponCodeDiscount: true, couponCode: 'SAVE10', discountValue: 20, name: 'New SAVE10' });
    assert.equal(second.isSuccess, true, second.message);

    await makeCart(MEMBER);
    const applied = await apply(MEMBER, { couponCode: 'save10' });
    assert.equal(applied.isSuccess, true, applied.message);
    assert.equal(applied.meta.appliedDiscounts[0].discountName, 'New SAVE10');
    assert.equal(applied.meta.appliedDiscounts[0].discountAmount, 50);

    const unknown = await apply(MEMBER, { couponCode: 'NOPE' });
    assert.equal(unknown.statusCode, 404);

    // Only an expired discount holds the code -> the shopper is told why.
    await Discount.updateOne({ _id: second.meta.data._id }, { $set: { status: 'D' } });
    const expired = await apply(MEMBER, { couponCode: 'SAVE10' });
    assert.equal(expired.isSuccess, false);
    assert.equal(expired.message, 'This discount has expired.');
});

test('re-activating a coupon discount cannot duplicate a live code', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const old = await create({ isCouponCodeDiscount: true, couponCode: 'DUP' });
    await discountService.bulkSetDiscountStatus(VENDOR, ADMIN, [old.meta.data._id], 'I');
    const fresh = await create({ isCouponCodeDiscount: true, couponCode: 'DUP' });
    assert.equal(fresh.isSuccess, true, fresh.message);

    const reactivate = await discountService.bulkSetDiscountStatus(VENDOR, ADMIN, [old.meta.data._id], 'A');
    assert.equal(reactivate.meta.failureCount, 1);
    assert.match(reactivate.meta.results[0].message, /already in use/);
    assert.equal((await Discount.findById(old.meta.data._id)).status, 'I');
});

test('the storefront list: usable, locked for members, hidden from outsiders; coupon box flag', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    await Group.deleteMany({});
    const group = await Group.create({ vendorId: VENDOR, groupType: 'USER', groupName: 'VIP', members: [MEMBER], status: 'A' });

    await create({ name: 'Storewide 10%' });
    await create({ name: 'VIP 20%', discountValue: 20, giveDiscountTo: 'USER_GROUP', userGroupIds: [group._id.toString()], discountValidAboveAmount: 300 });
    await create({ name: 'Wrong day', isMinimumDiscountQuantityDiscount: true, minimumQuantity: 1, isDiscountOpenForSpecificDays: true, specificDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].filter((d) => d !== new Date().toLocaleString('en-US', { weekday: 'long', timeZone: TZ }).toUpperCase()) });
    await create({ name: 'Future', startDate: day(2), endDate: day(4) });

    await makeCart(MEMBER);
    const member = (await list(MEMBER)).meta;
    assert.equal(member.isEnabled, true);
    assert.equal(member.hasCouponDiscounts, false, 'no coupon discount exists -> no coupon box');
    const byName = new Map(member.discounts.map((d) => [d.name, d]));
    assert.equal(byName.get('Storewide 10%').isLocked, false);
    assert.equal(byName.get('Storewide 10%').discountAmount, 25);
    assert.equal(byName.get('VIP 20%').isLocked, true);
    assert.equal(byName.get('VIP 20%').lockedReason, 'Add items worth 50 more to unlock this discount.');
    assert.equal(byName.get('Wrong day').isLocked, true);
    assert.match(byName.get('Wrong day').lockedReason, /only available on/);
    assert.equal(byName.has('Future'), false, 'a discount that has not started is not listed');
    // Usable ones come first.
    assert.equal(member.discounts[0].isLocked, false);

    await makeCart(OUTSIDER);
    const outsider = (await list(OUTSIDER)).meta;
    assert.equal(outsider.discounts.some((d) => d.name === 'VIP 20%'), false);

    // Guests are asked to log in.
    const guest = await cartService.listEligibleDiscountsForCart(VENDOR, { type: 'guest', id: 'g1' }, null, flags, flags, null, null);
    assert.equal(guest.meta.requiresLogin, true);
    // Feature off -> nothing.
    const off = await cartService.listEligibleDiscountsForCart(VENDOR, owner(MEMBER), MEMBER, { isDiscountFeatureOn: false }, flags, null, null);
    assert.equal(off.meta.isEnabled, false);

    // A coupon only for the VIP group: members get the box, outsiders don't.
    await create({ name: 'VIP code', isCouponCodeDiscount: true, couponCode: 'VIPONLY', giveDiscountTo: 'USER_GROUP', userGroupIds: [group._id.toString()] });
    assert.equal((await list(MEMBER)).meta.hasCouponDiscounts, true);
    assert.equal((await list(OUTSIDER)).meta.hasCouponDiscounts, false);
    assert.equal((await list(MEMBER)).meta.discounts.some((d) => d.name === 'VIP code'), false, 'coupon discounts are never listed');
    const outsiderCode = await apply(OUTSIDER, { couponCode: 'VIPONLY' });
    assert.equal(outsiderCode.message, 'This discount is not available for your account.');
});

test('applying: locked and uncombinable discounts are refused, eligible ones applied', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const storewide = (await create({ name: 'Storewide', isMultipleDiscountUsageOn: true })).meta.data;
    const solo = (await create({ name: 'Solo', discountType: 'FIXED_PRICE', discountValue: 30 })).meta.data;
    const locked = (await create({ name: 'Big spender', discountValidAboveAmount: 1000 })).meta.data;
    await makeCart(MEMBER);

    const refused = await apply(MEMBER, { discountIds: [locked._id] });
    assert.equal(refused.isSuccess, false);
    assert.match(refused.message, /more to unlock this discount/);

    const together = await apply(MEMBER, { discountIds: [storewide._id, solo._id] });
    assert.equal(together.statusCode, 400);
    assert.match(together.message, /"Solo" can't be combined/);

    const ok = await apply(MEMBER, { discountIds: [storewide._id] });
    assert.equal(ok.isSuccess, true, ok.message);
    assert.equal(ok.meta.cart.totalDiscountAmount, 25);
});

test('an applied discount that stops qualifying is dropped with its reason on re-check', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const d = (await create({ name: 'Storewide' })).meta.data;
    await makeCart(MEMBER);
    assert.equal((await apply(MEMBER, { discountIds: [d._id] })).isSuccess, true);

    await Discount.updateOne({ _id: d._id }, { $set: { discountValidAboveAmount: 500 } });
    const cart = await Cart.findOne({ vendorId: VENDOR, userId: MEMBER, status: 'A' });
    const lines = [{ productId: PRODUCT_A, productName: 'Shirt', quantity: 2, amount: 200 }, { productId: PRODUCT_B, productName: 'Cap', quantity: 1, amount: 50 }];
    const result = await cartService._internal.recalculateAppliedDiscounts(VENDOR, cart, lines, flags, flags);
    assert.equal(result.changed, true);
    assert.equal(result.dropped.length, 1);
    assert.match(result.dropped[0].reason, /more to unlock/);
    assert.equal(cart.totalDiscountAmount, 0);
});

test('editing keeps excel targets when no new file is uploaded', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const doc = await Discount.create({
        vendorId: VENDOR, name: 'Shirts only', discountType: 'PERCENTAGE', discountValue: 10,
        giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [PRODUCT_A],
        startDate: new Date(), endDate: new Date(Date.now() + 5 * 86400000), timezone: TZ, createdBy: ADMIN
    });
    const renamed = await discountService.updateDiscount(VENDOR, doc._id.toString(), ADMIN,
        payload({ name: 'Shirts only (renamed)', giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', startDate: toDateKey(doc.startDate, TZ) }), {}, flags);
    assert.equal(renamed.isSuccess, true, renamed.message);
    assert.deepEqual(renamed.meta.data.productIds.map(String), [PRODUCT_A.toString()]);

    const switched = await discountService.updateDiscount(VENDOR, doc._id.toString(), ADMIN,
        payload({ giveDiscountTo: 'SPECIFIC_CATEGORIES_ALL_USERS', startDate: toDateKey(doc.startDate, TZ) }), {}, flags);
    assert.equal(switched.statusCode, 400);
    assert.match(switched.message, /excelFile is required/);
});

test('an expired discount can still be edited without touching its dates', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const doc = await Discount.create({
        vendorId: VENDOR, name: 'Old', discountType: 'PERCENTAGE', discountValue: 10, giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS',
        startDate: new Date(Date.now() - 10 * 86400000), endDate: new Date(Date.now() - 5 * 86400000), timezone: TZ, createdBy: ADMIN
    });
    const result = await discountService.updateDiscount(VENDOR, doc._id.toString(), ADMIN,
        payload({ name: 'Old (renamed)', startDate: toDateKey(doc.startDate, TZ), endDate: toDateKey(doc.endDate, TZ) }), {}, flags);
    assert.equal(result.isSuccess, true, result.message);
});

test('discounts can only target active groups (an already-used group may stay)', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    await Group.deleteMany({});
    const active = await Group.create({ vendorId: VENDOR, groupType: 'PRODUCT', groupName: 'Live', members: [PRODUCT_B], status: 'A' });
    const inactive = await Group.create({ vendorId: VENDOR, groupType: 'PRODUCT', groupName: 'Paused', members: [PRODUCT_A], status: 'I' });

    const refused = await create({ giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [inactive._id.toString()] });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.message, /inactive - activate them first: Paused/);

    const made = await create({ giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [active._id.toString()], discountValidAboveAmount: 60 });
    assert.equal(made.isSuccess, true, made.message);

    // Minimum spend counts only the group's items: Cap (50) < 60 even though the cart is 250.
    await makeCart(MEMBER);
    const listed = (await list(MEMBER)).meta.discounts.find((d) => d.name === 'Sale');
    assert.equal(listed.isLocked, true);
    assert.equal(listed.appliesToWholeCart, false);
    assert.equal(listed.lockedReason, 'Add eligible items worth 10 more to unlock this discount.');

    // The group is deactivated later: the discount can still be edited.
    await Group.updateOne({ _id: active._id }, { $set: { status: 'I' } });
    const edited = await discountService.updateDiscount(VENDOR, made.meta.data._id.toString(), ADMIN,
        payload({ name: 'Sale (edited)', giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [active._id.toString()] }), {}, flags);
    assert.equal(edited.isSuccess, true, edited.message);
});

test('group members must be active when added; existing ones may stay', async (t) => {
    if (skipUnlessDb(t)) return;
    await Group.deleteMany({});
    const groupService = require('../services/groupService');
    const INACTIVE_PRODUCT = id();
    await mongoose.connection.db.collection('products').insertOne({ _id: INACTIVE_PRODUCT, vendorId: VENDOR, name: 'Old hat', status: 'I' });
    const companyMaster = { numberOfMembersPerGroup: 50, numberOfGroupsAllowed: 50, allowedGroupTypes: [] };

    const refused = await groupService.createGroup(VENDOR, ADMIN, { groupType: 'PRODUCT', groupName: 'With inactive', members: [PRODUCT_A.toString(), INACTIVE_PRODUCT.toString()] }, {}, companyMaster);
    assert.equal(refused.statusCode, 400);
    assert.match(refused.message, /Inactive records cannot be added/);

    const group = await Group.create({ vendorId: VENDOR, groupType: 'PRODUCT', groupName: 'Legacy', members: [PRODUCT_A, INACTIVE_PRODUCT], membersCount: 2, status: 'A' });
    const kept = await groupService.updateGroup(VENDOR, ADMIN, group._id.toString(), { members: [PRODUCT_A.toString(), INACTIVE_PRODUCT.toString(), PRODUCT_B.toString()] }, {}, companyMaster);
    assert.equal(kept.isSuccess, true, kept.message);
});

test('a bad excel file gets a 400 message, never a server error', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    await Group.deleteMany({});
    const group = await Group.create({ vendorId: VENDOR, groupType: 'PRODUCT', groupName: 'Caps', members: [PRODUCT_B], status: 'A' });
    const productGroupWithUsers = { giveDiscountTo: 'PRODUCT_GROUP_SPECIFIC_USERS', productGroupIds: [group._id.toString()] };

    const workbookBuffer = async (sheetName, rows) => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(sheetName);
        rows.forEach((row) => sheet.addRow(row));
        return Buffer.from(await workbook.xlsx.writeBuffer());
    };
    const attempt = async (buffer) => create(productGroupWithUsers, { excelFile: [{ buffer }] });

    // The reported case: emails typed straight into the sheet, no "Email" heading.
    const noHeading = await attempt(await workbookBuffer('Users', [['member@shop.test'], ['outsider@shop.test']]));
    assert.equal(noHeading.isSuccess, false);
    assert.equal(noHeading.statusCode, 400);
    assert.equal(noHeading.message, 'The "Users" sheet is missing the column "Email". Its first row must be the column heading(s): "Email".');

    const wrongSheet = await attempt(await workbookBuffer('Sheet1', [['Email'], ['member@shop.test']]));
    assert.equal(wrongSheet.statusCode, 400);
    assert.equal(wrongSheet.message, 'The excel file needs a sheet named "Users".');

    const empty = await attempt(await workbookBuffer('Users', [['Email']]));
    assert.equal(empty.statusCode, 400);
    assert.match(empty.message, /"Users" sheet has no rows/);

    const notExcel = await attempt(Buffer.from('email\nmember@shop.test\n'));
    assert.equal(notExcel.statusCode, 400);
    assert.equal(notExcel.message, 'The uploaded file could not be read. Please upload an Excel (.xlsx) file.');

    // Heading matched case-insensitively -> fine.
    const ok = await attempt(await workbookBuffer('Users', [['email'], ['member@shop.test']]));
    assert.equal(ok.isSuccess, true, ok.message);
    assert.equal(await Discount.countDocuments({}), 1);
});

test('the downloaded sample file, once filled in, creates the discount', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const sample = await discountService.buildTargetingSampleFile('SPECIFIC_PRODUCTS_SPECIFIC_USERS');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sample.meta.buffer);
    workbook.getWorksheet('Products').addRow(['Shirt']);
    workbook.getWorksheet('Users').addRow(['member@shop.test']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await create({ giveDiscountTo: 'SPECIFIC_PRODUCTS_SPECIFIC_USERS' }, { excelFile: [{ buffer }] });
    assert.equal(result.isSuccess, true, result.message);
    assert.deepEqual(result.meta.data.productIds.map(String), [PRODUCT_A.toString()]);
    assert.deepEqual(result.meta.data.userIds.map(String), [MEMBER.toString()]);

    // Uploaded untouched, it says what's missing instead of saving an empty discount.
    const untouched = await create({ giveDiscountTo: 'SPECIFIC_PRODUCTS_SPECIFIC_USERS' }, { excelFile: [{ buffer: sample.meta.buffer }] });
    assert.equal(untouched.statusCode, 400);
    assert.match(untouched.message, /"Products" sheet has no rows/);
});

test('excel user targeting only matches this vendor\'s active customers, once each', async (t) => {
    if (skipUnlessDb(t)) return;
    await clearDiscounts();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.addRow(['Email']);
    ['member@shop.test', 'MEMBER@shop.test', 'elsewhere@shop.test'].forEach((email) => sheet.addRow([email]));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await create({ giveDiscountTo: 'ALL_PRODUCTS_SPECIFIC_USERS' }, { excelFile: [{ buffer }] });
    assert.equal(result.isSuccess, true, result.message);
    assert.deepEqual(result.meta.data.userIds.map(String), [MEMBER.toString()]);
    // Both spellings of the member match (then count once); the other vendor's user fails.
    assert.equal(result.meta.excelReports.users.successCount, 2);
    assert.equal(result.meta.excelReports.users.failedCount, 1);
});
