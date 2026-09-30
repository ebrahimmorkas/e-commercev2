// End-to-end Free Cash flow against a real MongoDB: admin create/update
// (freeCashService) and the storefront cart list/apply (cartService).
//
// Uses its own throwaway database - the MONGODB_URI database name with
// "-freecash-test" appended - and drops it afterwards. Skipped when MongoDB
// isn't reachable.
require('dotenv').config({ quiet: true });
process.env.IS_REDIS_SERVER_ON = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const FreeCash = require('../models/FreeCash');
const UserFreeCash = require('../models/UserFreeCash');
const Cart = require('../models/Cart');
const Group = require('../models/Group');
const freeCashService = require('../services/freeCashService');
const cartService = require('../services/cartService');
const { toDateKey } = require('../utils/discountSchedule');

const TZ = 'Asia/Kolkata';
const id = () => new mongoose.Types.ObjectId();
const VENDOR = id();
const OTHER_VENDOR = id();
const ADMIN = id();
const ALICE = id();
const BOB = id();
const CAROL = id();
const INACTIVE_USER = id();
const PRODUCT_A = id();
const PRODUCT_B = id();
const CATEGORY_A = id();

const masters = {
    isFreeCashFeatureOn: true,
    isDiscountFeatureOn: true,
    isFreeCashGivingToAllUsersFunctionalityAllowed: true,
    isFreeCashGivingToSpecificUsersAllowed: true,
    isFreeCashGivingToGroupsAllowed: true,
    isFreeCashGivingToSpecificCategoryAllowed: true,
    isFreeCashGivingToNestedSubCategoryAllowed: true,
    isFreeCashRefundFeatureOn: true,
    freeCashOptions: []
};
const settings = {
    isFreeCashFeatureOn: true,
    isFreeCashStackingAllowed: true,
    isMultipleFreeCashUsageAllowed: true,
    returnFreeCashOnOrderReturn: true,
    refundWholeFreeCashAmount: true
};

const day = (n) => toDateKey(new Date(Date.now() + n * 86400000), TZ);

const testDbUri = () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = `${uri.pathname.replace(/^\//, '') || 'test'}-freecash-test`;
    return uri.toString();
};

let connected = false;

test.before(async () => {
    try {
        await mongoose.connect(testDbUri(), { serverSelectionTimeoutMS: 3000 });
        connected = mongoose.connection.db.databaseName.endsWith('-freecash-test');
    } catch (err) {
        connected = false;
    }
    if (!connected) return;
    await mongoose.connection.db.dropDatabase();
    await UserFreeCash.createIndexes();

    const db = mongoose.connection.db;
    await db.collection('products').insertMany([
        { _id: PRODUCT_A, vendorId: VENDOR, name: 'Shirt', status: 'A', mainCategory: CATEGORY_A },
        { _id: PRODUCT_B, vendorId: VENDOR, name: 'Cap', status: 'A', mainCategory: id() }
    ]);
    await db.collection('categories').insertOne({ _id: CATEGORY_A, vendorId: VENDOR, categoryName: 'Shirts', status: 'A', parent_category_id: null });
    await db.collection('users').insertMany([
        { _id: ALICE, vendorId: VENDOR, username: 'alice', phone_no: '9000000001', whatsapp_no: '8000000001', email: 'alice@shop.test', role: 'user', status: 'A' },
        { _id: BOB, vendorId: VENDOR, username: 'bob', phone_no: '9000000002', whatsapp_no: '8000000002', email: 'bob@shop.test', role: 'user', status: 'A' },
        { _id: CAROL, vendorId: VENDOR, username: 'carol', phone_no: '9000000003', whatsapp_no: '8000000003', email: 'carol@shop.test', role: 'user', status: 'A' },
        { _id: INACTIVE_USER, vendorId: VENDOR, username: 'gone', phone_no: '9000000004', whatsapp_no: '8000000004', email: 'gone@shop.test', role: 'user', status: 'I' },
        { _id: id(), vendorId: OTHER_VENDOR, username: 'elsewhere', phone_no: '9000000005', whatsapp_no: '8000000005', email: 'elsewhere@shop.test', role: 'user', status: 'A' }
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

const reset = async () => {
    await FreeCash.deleteMany({});
    await UserFreeCash.deleteMany({});
    await Group.deleteMany({});
};

const payload = (over = {}) => ({
    freeCashName: 'Welcome',
    freeCashAmount: 100,
    giveFreeCashTo: 'ALL_USERS',
    startDate: day(0),
    endDate: day(5),
    timezone: TZ,
    validAbove: 0,
    ...over
});

const create = (over, files = {}, cs = settings) => freeCashService.createFreeCash(VENDOR, ADMIN, payload(over), files, masters, masters, cs);
const update = (fcId, over, files = {}) => freeCashService.updateFreeCash(VENDOR, fcId.toString(), ADMIN, over, files, masters, masters, { companySettingsData: settings });

const usersExcel = async (emails) => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Users');
    sheet.addRow(['Email']);
    emails.forEach((e) => sheet.addRow([e]));
    return { excelFile: [{ buffer: Buffer.from(await wb.xlsx.writeBuffer()) }] };
};

// Cart: 2 x Shirt at 100 (category Shirts) + 1 x Cap at 50 = 250.
const makeCart = async (userId, discounts = []) => {
    await Cart.deleteMany({ vendorId: VENDOR, userId });
    const line = (productId, productName, unitPrice, quantity) => ({
        productId, productName,
        variants: [{ variantId: id(), variantName: 'Default', sizes: [{ sizeId: id(), sizeName: 'M', unitPrice, sku: `SKU-${productName}`, quantity }] }]
    });
    return Cart.create({
        vendorId: VENDOR, userId, status: 'A',
        products: [line(PRODUCT_A, 'Shirt', 100, 2), line(PRODUCT_B, 'Cap', 50, 1)],
        discounts,
        totalDiscountAmount: discounts.reduce((s, d) => s + d.discountAmount, 0)
    });
};

const owner = (userId) => ({ type: 'user', id: userId });
const list = (userId) => cartService.listEligibleFreeCashForCart(VENDOR, owner(userId), userId, masters, masters, settings, null);
const grantsOf = (fcId) => UserFreeCash.find({ vendorId: VENDOR, freeCashId: fcId }).lean();

test('dates are whole days in the campaign timezone; one-day campaigns work', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const result = await create({ startDate: '2099-10-01', endDate: '2099-10-01' });
    assert.equal(result.isSuccess, true, result.message);
    assert.equal(result.meta.data.startDate.toISOString(), '2099-09-30T18:30:00.000Z');
    assert.equal(result.meta.data.endDate.toISOString(), '2099-10-01T18:29:59.999Z');
    assert.equal(result.meta.data.timezone, TZ);

    assert.match((await create({ startDate: day(-1) })).message, /startDate cannot be before today/);
    assert.match((await create({ freeCashAmount: 0 })).message, /greater than 0/);
    assert.match((await create({ maxCashUsagePerOrder: 0 })).message, /greater than 0/);
});

test('specific users by excel: active customers of this store only, one grant each', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const files = await usersExcel(['alice@shop.test', 'ALICE@shop.test', 'gone@shop.test', 'elsewhere@shop.test', 'bob@shop.test']);
    const result = await create({ giveFreeCashTo: 'SPECIFIC_USERS' }, files);
    assert.equal(result.isSuccess, true, result.message);
    assert.equal(result.meta.issuedCount, 2);
    const grants = await grantsOf(result.meta.data._id);
    assert.deepEqual(grants.map((g) => g.userId.toString()).sort(), [ALICE.toString(), BOB.toString()].sort());
    assert.equal(result.meta.excelReports.users.failedCount, 2);
});

test('editing a specific-users campaign: keep without a file, sync with a new file', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const made = (await create({ giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['alice@shop.test', 'bob@shop.test']))).meta.data;

    // Rename only, no file: customers kept, nothing issued or revoked.
    const renamed = await update(made._id, { freeCashName: 'Renamed', giveFreeCashTo: 'SPECIFIC_USERS' });
    assert.equal(renamed.isSuccess, true, renamed.message);
    assert.equal(renamed.meta.data.giveToUsers.length, 2);
    assert.equal(renamed.meta.issuedCount, 0);
    assert.equal(renamed.meta.revokedCount, 0);

    // New list: Bob stays, Carol added, Alice removed.
    const changed = await update(made._id, { giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['bob@shop.test', 'carol@shop.test']));
    assert.equal(changed.isSuccess, true, changed.message);
    assert.equal(changed.meta.issuedCount, 1);
    assert.equal(changed.meta.revokedCount, 1);
    const byUser = new Map((await grantsOf(made._id)).map((g) => [g.userId.toString(), g]));
    assert.equal(byUser.get(ALICE.toString()).isRevoked, true);
    assert.equal(byUser.get(BOB.toString()).isRevoked, false);
    assert.equal(byUser.get(CAROL.toString()).isRevoked, false);

    // Alice put back: her grant is restored, not duplicated.
    const back = await update(made._id, { giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['alice@shop.test', 'bob@shop.test', 'carol@shop.test']));
    assert.equal(back.meta.issuedCount, 1);
    const grants = await grantsOf(made._id);
    assert.equal(grants.length, 3);
    assert.equal(grants.find((g) => g.userId.toString() === ALICE.toString()).isRevoked, false);
});

test('a used balance is never taken back by an edit', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const made = (await create({ giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['alice@shop.test', 'bob@shop.test']))).meta.data;
    await UserFreeCash.updateOne({ freeCashId: made._id, userId: ALICE }, { $set: { usedAmount: 100, remainingAmount: 0, isCashUsed: true } });
    const changed = await update(made._id, { giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['bob@shop.test']));
    assert.equal(changed.meta.revokedCount, 0);
    const alice = (await grantsOf(made._id)).find((g) => g.userId.toString() === ALICE.toString());
    assert.equal(alice.isRevoked, false);
    assert.equal(alice.usedAmount, 100);
});

test('groups: only active groups and active members; later joiners get it at cart time', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const paused = await Group.create({ vendorId: VENDOR, groupType: 'USER', groupName: 'Paused', members: [ALICE], status: 'I' });
    assert.match((await create({ giveFreeCashTo: 'GROUPS', userGroupIds: [paused._id.toString()] })).message, /inactive - activate them first: Paused/);

    const vip = await Group.create({ vendorId: VENDOR, groupType: 'USER', groupName: 'VIP', members: [ALICE, INACTIVE_USER], status: 'A' });
    const made = await create({ giveFreeCashTo: 'GROUPS', userGroupIds: [vip._id.toString()] });
    assert.equal(made.isSuccess, true, made.message);
    assert.equal(made.meta.issuedCount, 1, 'the inactive member gets nothing');

    // Bob joins afterwards: he gets it the first time his cart lists Free Cash.
    await Group.updateOne({ _id: vip._id }, { $addToSet: { members: BOB } });
    await makeCart(BOB);
    const bobList = (await list(BOB)).meta.freeCash;
    assert.deepEqual(bobList.map((f) => f.freeCashName), ['Welcome']);
    // Carol isn't in the group.
    await makeCart(CAROL);
    assert.deepEqual((await list(CAROL)).meta.freeCash, []);
});

test('changing the amount only affects grants issued afterwards', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const vip = await Group.create({ vendorId: VENDOR, groupType: 'USER', groupName: 'VIP', members: [ALICE], status: 'A' });
    const made = (await create({ giveFreeCashTo: 'GROUPS', userGroupIds: [vip._id.toString()] })).meta.data;
    const updated = await update(made._id, { freeCashAmount: 300 });
    assert.equal(updated.isSuccess, true, updated.message);
    await Group.updateOne({ _id: vip._id }, { $addToSet: { members: BOB } });
    await makeCart(BOB);
    await list(BOB);
    const byUser = new Map((await grantsOf(made._id)).map((g) => [g.userId.toString(), g]));
    assert.equal(byUser.get(ALICE.toString()).amount, 100);
    assert.equal(byUser.get(BOB.toString()).amount, 300);
});

test('lazy grants can not be issued twice, even by simultaneous requests', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const made = (await create({})).meta.data;
    await makeCart(ALICE);
    await Promise.all([list(ALICE), list(ALICE), list(ALICE), list(ALICE)]);
    assert.equal((await grantsOf(made._id)).length, 1);
});

test('the cart list: usable ones with what they save, locked ones with why', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    await create({ freeCashName: 'Small', freeCashAmount: 30 });
    await create({ freeCashName: 'Big spender', freeCashAmount: 50, validAbove: 400 });
    await create({ freeCashName: 'Shirts only', freeCashAmount: 500, giveFreeCashTo: 'ONLY_MAIN_CATEGORY', mainCategoryIds: [CATEGORY_A.toString()] });
    await makeCart(ALICE);

    const items = new Map((await list(ALICE)).meta.freeCash.map((f) => [f.freeCashName, f]));
    assert.equal(items.get('Small').isLocked, false);
    assert.equal(items.get('Small').applicableAmount, 30);
    assert.equal(items.get('Big spender').isLocked, true);
    assert.equal(items.get('Big spender').lockedReason, 'Add items worth 150 more to unlock this Free Cash.');
    // Category campaign: capped at the category's items (2 x 100).
    assert.equal(items.get('Shirts only').applicableAmount, 200);
    assert.equal(items.get('Shirts only').isCategoryRestricted, true);

    // With a discount on the cart, a non-combinable one is locked with the reason.
    await makeCart(ALICE, [{ discountId: id(), discountName: 'Sale', discountAmount: 25 }]);
    const withDiscount = new Map((await list(ALICE)).meta.freeCash.map((f) => [f.freeCashName, f]));
    assert.equal(withDiscount.get('Small').isLocked, true);
    assert.match(withDiscount.get('Small').lockedReason, /cannot be combined with an active discount/);
});

test('return refund: a grant gets back its share of the returned items', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const made = (await create({ giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['alice@shop.test']))).meta.data;
    const grant = await UserFreeCash.findOneAndUpdate(
        { freeCashId: made._id, userId: ALICE },
        { $set: { usedAmount: 100, remainingAmount: 0, isCashUsed: true } },
        { new: true }
    );
    const cart = await makeCart(ALICE);
    cart.freeCash = [{ freeCashId: made._id, userFreeCashId: grant._id, freeCashName: 'Welcome', canBeUsedWithOtherDiscounts: false, amountApplied: 100 }];
    cart.totalFreeCashAmount = 100;
    await cart.save();

    // Order placed in a currency at 2x the store's: every order amount is doubled.
    const order = { _id: id(), cartId: cart._id, subtotal: 500, totalFreeCashAmount: 200, currencySymbol: '$', exchangeRate: 2, orderNumber: 'T-1', userId: ALICE };
    const orderReturn = { _id: id(), totalRefundAmount: 250 }; // half of the order
    await cartService.refundFreeCashForReturn(VENDOR, order, orderReturn, masters, masters, settings, ADMIN);

    const after = await UserFreeCash.findById(grant._id).lean();
    assert.equal(after.remainingAmount, 50, 'half of the 100 (store currency) comes back');
    assert.equal(after.usedAmount, 50);
    assert.equal(after.isCashUsed, false);
});

test('revoke for one customer, picked by email', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const made = (await create({ giveFreeCashTo: 'SPECIFIC_USERS' }, await usersExcel(['alice@shop.test', 'bob@shop.test']))).meta.data;
    const revoke = (email) => freeCashService.revokeFreeCashForUser(VENDOR, email, made._id.toString(), ADMIN, { companyMasterData: masters, websiteMasterData: masters, companySettingsData: settings });

    const done = await revoke('ALICE@Shop.Test');
    assert.equal(done.isSuccess, true, done.message);
    assert.equal(done.message, 'Free Cash revoked for alice@shop.test.');
    const byUser = new Map((await grantsOf(made._id)).map((g) => [g.userId.toString(), g]));
    assert.equal(byUser.get(ALICE.toString()).isRevoked, true);
    assert.equal(byUser.get(BOB.toString()).isRevoked, false, 'only that customer');

    assert.equal((await revoke('alice@shop.test')).message, 'alice@shop.test has no unused balance of this Free Cash to revoke.');
    assert.equal((await revoke('carol@shop.test')).message, 'carol@shop.test has no unused balance of this Free Cash to revoke.');
    assert.match((await revoke('nobody@shop.test')).message, /No customer with the email "nobody@shop.test" was found/);
    // Another store's customer with a valid email is never matched.
    assert.equal((await revoke('elsewhere@shop.test')).statusCode, 404);
    // A regex-looking email is matched literally.
    assert.equal((await revoke('.*@shop.test')).statusCode, 404);
});

test('sample file: a Users sheet with the Email heading', async () => {
    const sample = await freeCashService.buildUsersSampleFile();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(sample.meta.buffer);
    assert.deepEqual(wb.worksheets.map((ws) => ws.name), ['Users']);
    assert.deepEqual(wb.getWorksheet('Users').getRow(1).values.filter(Boolean), ['Email']);
    assert.equal(sample.meta.fileName, 'free-cash-sample-users.xlsx');
});
