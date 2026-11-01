// Abandoned Cart against a real MongoDB: which carts the scanner flags (and
// when), what the admin listing returns, and the live pushes the admin page
// refreshes on.
//
// Uses its own throwaway database - the MONGODB_URI database name with
// "-abandonedcart-test" appended - and drops it afterwards. Skipped when
// MongoDB isn't reachable.
require('dotenv').config({ quiet: true });
process.env.IS_REDIS_SERVER_ON = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Cart = require('../models/Cart');
const realtimeService = require('../services/realtimeService');
const abandonedCartService = require('../services/abandonedCartService');
const cartService = require('../services/cartService');

const id = () => new mongoose.Types.ObjectId();
const VENDOR = id();
const ALICE = id();
const BOB = id();
const PRODUCT = { productId: id(), variantId: id(), sizeId: id() };
const OTHER = { productId: id(), variantId: id(), sizeId: id() };

const masters = { isAbondonedCartFeatureOn: true };
const settings = { timeForAbondonedCartReflection: 10, abondonedCartOnlyForLoggedInUsers: true };
const minutesAgo = (n) => new Date(Date.now() - n * 60000);

const testDbUri = () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = `${uri.pathname.replace(/^\//, '') || 'test'}-abandonedcart-test`;
    return uri.toString();
};

let connected = false;
// Every push the services send to the vendor's admins, instead of a real socket.
let pushes = [];
// Every push to one customer's own sockets: [userId, module, type].
let customerPushes = [];
const originalEmitToUser = realtimeService.emitToUser;
const originalEmit = realtimeService.emitToVendorAdmins;

test.before(async () => {
    realtimeService.emitToVendorAdmins = (vendorId, event, payload) => { pushes.push(payload.type); return true; };
    realtimeService.emitToUser = (vendorId, userId, event, payload) => { customerPushes.push([userId.toString(), payload.module, payload.type]); return true; };
    try {
        await mongoose.connect(testDbUri(), { serverSelectionTimeoutMS: 3000 });
        connected = mongoose.connection.db.databaseName.endsWith('-abandonedcart-test');
    } catch (err) {
        connected = false;
    }
    if (!connected) return;
    await mongoose.connection.db.dropDatabase();
});

test.after(async () => {
    realtimeService.emitToVendorAdmins = originalEmit;
    realtimeService.emitToUser = originalEmitToUser;
    if (connected) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});

const skipUnlessDb = (t) => {
    if (!connected) t.skip('MongoDB not reachable');
    return !connected;
};

const productDoc = (line, name) => ({
    _id: line.productId, vendorId: VENDOR, name, status: 'A', taxIds: [], mainCategory: id(),
    variants: [{ _id: line.variantId, status: 'A', displayName: 'Default', sizes: [{ _id: line.sizeId, status: 'A', sizeName: 'M', sku: `SKU-${name}`, price: 100, stock: 50 }] }]
});

const cartLine = (line, productName, quantity = 1) => ({
    productId: line.productId, productName,
    variants: [{ variantId: line.variantId, variantName: 'Default', sizes: [{ sizeId: line.sizeId, sizeName: 'M', unitPrice: 100, sku: `SKU-${productName}`, quantity }] }]
});

const reset = async () => {
    const db = mongoose.connection.db;
    await Promise.all(['carts', 'products', 'users', 'websitemasters', 'companymasters', 'companysettings'].map((name) => db.collection(name).deleteMany({})));
    await db.collection('websitemasters').insertOne({ isAbondonedCartFeatureOn: true });
    await db.collection('companymasters').insertOne({ vendorId: VENDOR, isAbondonedCartFeatureOn: true });
    await db.collection('companysettings').insertOne({ vendorId: VENDOR, ...settings });
    await db.collection('products').insertMany([productDoc(PRODUCT, 'Shirt'), productDoc(OTHER, 'Cap')]);
    await db.collection('users').insertMany([
        { _id: ALICE, vendorId: VENDOR, name: 'Alice', email: 'alice@shop.test', phone_no: '9000000001', role: 'user', status: 'A' },
        { _id: BOB, vendorId: VENDOR, name: 'Bob', email: 'bob@shop.test', phone_no: '9000000002', role: 'user', status: 'A' }
    ]);
    pushes = [];
    customerPushes = [];
};

const listing = async (cs = settings) => (await abandonedCartService.fetchAbandonedCartsForAdmin(VENDOR, masters, masters, cs)).meta.data;

test('a cart is flagged only after the vendor\'s configured time, and is listed with its products', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const fresh = await Cart.create({ vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt', 2)], lastProductAddedAt: minutesAgo(5) });
    const stale = await Cart.create({ vendorId: VENDOR, userId: BOB, products: [cartLine(PRODUCT, 'Shirt', 3), cartLine(OTHER, 'Cap')], lastProductAddedAt: minutesAgo(11) });

    await abandonedCartService.scanAndFlagAbandonedCarts();

    assert.equal((await Cart.findById(fresh._id)).isAbandoned, false, '5 minutes is inside the 10 minute window');
    assert.equal((await Cart.findById(stale._id)).isAbandoned, true);
    assert.deepEqual(pushes, ['NEW']);

    const rows = await listing();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].userName, 'Bob');
    assert.equal(rows[0].itemCount, 2);
    assert.deepEqual(rows[0].items.map((item) => [item.productName, item.variantName, item.sizeName, item.quantity]), [
        ['Shirt', 'Default', 'M', 3],
        ['Cap', 'Default', 'M', 1]
    ]);
    assert.equal(rows[0].items[0].productId.toString(), PRODUCT.productId.toString(), 'ids for the Place Order hand-over');

    // A second scan does not alert again.
    await abandonedCartService.scanAndFlagAbandonedCarts();
    assert.deepEqual(pushes, ['NEW']);
});

test('the feature toggle in Company Master switches the scanner off for that vendor', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    await mongoose.connection.db.collection('companymasters').updateOne({ vendorId: VENDOR }, { $set: { isAbondonedCartFeatureOn: false } });
    const cart = await Cart.create({ vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt')], lastProductAddedAt: minutesAgo(60) });

    await abandonedCartService.scanAndFlagAbandonedCarts();
    assert.equal((await Cart.findById(cart._id)).isAbandoned, false);
    assert.deepEqual(pushes, []);
});

test('carts the old scanner could never see are flagged: no activity stamp, no isAbandoned field, and empty carts are ignored', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const db = mongoose.connection.db;
    // Written straight to the collection: products but no lastProductAddedAt / isAbandoned at all.
    const legacyId = id();
    await db.collection('carts').insertOne({ _id: legacyId, vendorId: VENDOR, userId: ALICE, status: 'A', products: [cartLine(PRODUCT, 'Shirt')], createdAt: minutesAgo(90), updatedAt: minutesAgo(90) });
    const emptyId = id();
    await db.collection('carts').insertOne({ _id: emptyId, vendorId: VENDOR, userId: BOB, status: 'A', products: [], isAbandoned: false, lastProductAddedAt: minutesAgo(90), createdAt: minutesAgo(90), updatedAt: minutesAgo(90) });

    await abandonedCartService.scanAndFlagAbandonedCarts();

    const legacy = await Cart.findById(legacyId);
    assert.equal(legacy.isAbandoned, true);
    assert.ok(legacy.lastProductAddedAt, 'given an activity time so the admin sees when it went quiet');
    assert.equal((await Cart.findById(emptyId)).isAbandoned, false, 'nothing in it to show');
    assert.equal((await listing()).length, 1);
});

test('a guest cart merged in at login starts the clock, so it can be flagged later', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    await Cart.create({ vendorId: VENDOR, guestId: 'guest-1', products: [cartLine(PRODUCT, 'Shirt')], lastProductAddedAt: minutesAgo(3) });

    const merged = await cartService.mergeGuestCartIntoUserCart(VENDOR, ALICE, 'guest-1', {}, masters, masters);
    assert.equal(merged.isSuccess, true, merged.message);

    const userCart = await Cart.findOne({ vendorId: VENDOR, userId: ALICE, status: 'A' });
    assert.equal(userCart.products.length, 1);
    assert.ok(userCart.lastProductAddedAt, 'the merge counts as products being added');

    // Once the configured time has passed it shows up like any other cart.
    await Cart.updateOne({ _id: userCart._id }, { $set: { lastProductAddedAt: minutesAgo(11) } });
    await abandonedCartService.scanAndFlagAbandonedCarts();
    assert.equal((await Cart.findById(userCart._id)).isAbandoned, true);
    assert.deepEqual(pushes, ['NEW']);
});

test('every change the customer makes restarts the clock and takes the cart off the abandoned list', async (t) => {
    if (skipUnlessDb(t)) return;
    const owner = { type: 'user', id: ALICE };
    const flaggedCart = () => Cart.create({
        vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt', 2), cartLine(OTHER, 'Cap')],
        lastProductAddedAt: minutesAgo(30), isAbandoned: true, abandonedAt: minutesAgo(20)
    });
    const actions = {
        'quantity change': () => cartService.updateCartItemQuantity(VENDOR, owner, masters, masters, settings, { ...PRODUCT, quantity: 5 }),
        'item removed': () => cartService.removeCartItem(VENDOR, owner, OTHER, masters, masters, settings),
        'discounts removed': () => cartService.removeDiscountsFromCart(VENDOR, owner, ALICE, masters, masters, settings),
        'Free Cash removed': () => cartService.removeFreeCashFromCart(VENDOR, owner, ALICE)
    };

    for (const [name, act] of Object.entries(actions)) {
        await reset();
        const cart = await flaggedCart();
        const before = Date.now();

        const result = await act();
        assert.equal(result.isSuccess, true, `${name}: ${result.message}`);

        const saved = await Cart.findById(cart._id);
        assert.equal(saved.isAbandoned, false, `${name} takes the cart off the list`);
        assert.ok(saved.lastProductAddedAt.getTime() >= before, `${name} restarts the clock`);
        assert.deepEqual(pushes, ['RECOVERED'], `${name} tells the open admin page`);
        assert.equal((await listing()).length, 0);

        // ...and it is not flagged again until the full time has passed once more.
        await abandonedCartService.scanAndFlagAbandonedCarts();
        assert.equal((await Cart.findById(cart._id)).isAbandoned, false);
    }
});

test('a cart is flagged at the moment its time is up, not at the next regular scan', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    // 10 minute window; this cart falls due in about 1.5 seconds.
    const cart = await Cart.create({ vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt')], lastProductAddedAt: new Date(Date.now() - 10 * 60000 + 1500) });

    abandonedCartService.startAbandonedCartScanner();
    try {
        await abandonedCartService.scanAndFlagAbandonedCarts();
        assert.equal((await Cart.findById(cart._id)).isAbandoned, false, 'not due yet');

        // The regular scan is 45 seconds away; the exact one fires on its own.
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const flagged = await Cart.findById(cart._id);
        assert.equal(flagged.isAbandoned, true);
        const lateByMs = flagged.abandonedAt.getTime() - (flagged.lastProductAddedAt.getTime() + 10 * 60000);
        assert.ok(lateByMs >= 0 && lateByMs < 1000, `flagged ${lateByMs}ms after its time was up`);
        assert.deepEqual(pushes, ['NEW']);
    } finally {
        abandonedCartService.stopAbandonedCartScanner();
    }
});

test('placing the order from an abandoned cart orders everything in it and empties the cart', async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const guestSettings = { ...settings, abondonedCartOnlyForLoggedInUsers: false };
    const flagged = { lastProductAddedAt: minutesAgo(30), isAbandoned: true, abandonedAt: minutesAgo(20) };
    const userCart = await Cart.create({ vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt', 2)], ...flagged });
    const guestCart = await Cart.create({ vendorId: VENDOR, guestId: 'guest-9', possibleUserId: ALICE, products: [cartLine(PRODUCT, 'Shirt', 1), cartLine(OTHER, 'Cap', 4)], ...flagged });
    const bobCart = await Cart.create({ vendorId: VENDOR, userId: BOB, products: [cartLine(OTHER, 'Cap')], ...flagged });

    // The row the admin sees: both of Alice's carts as one, the shared line added up.
    const row = (await listing(guestSettings)).find((entry) => entry.userName === 'Alice');
    assert.equal(row.source, 'COMBINED');
    assert.deepEqual(row.items.map((item) => [item.productName, item.quantity]), [['Shirt', 3], ['Cap', 4]]);

    // The order itself is the ordinary admin Place Order - stood in for here.
    const adminPlaceOrderService = require('../services/adminPlaceOrderService');
    const original = adminPlaceOrderService.placeOrderOnBehalfOfUser;
    let received = null;
    let emptiesCart = true;
    adminPlaceOrderService.placeOrderOnBehalfOfUser = async (vendorId, adminUserId, wm, cm, cs, payload) => {
        received = payload;
        if (emptiesCart) await abandonedCartService.emptyCartsAfterAdminOrder(vendorId, payload.userId, payload.abandonedCartIds, adminUserId);
        return { isSuccess: true, statusCode: 201, message: 'Order placed successfully', meta: { order: { _id: id(), orderNumber: 'T-9' } } };
    };
    const savedAddressId = id();
    try {
        // A delivery address is required: a saved one or a typed one, never both.
        const noAddress = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings);
        assert.equal(noAddress.statusCode, 400);
        const blankAddress = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings, { addressText: '   ' });
        assert.equal(blankAddress.statusCode, 400);
        const bothAddresses = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings, { addressId: savedAddressId, addressText: '12 Hill Road' });
        assert.equal(bothAddresses.statusCode, 400);
        assert.equal(received, null, 'no order is attempted without a valid address');
        assert.equal((await Cart.findById(userCart._id)).products.length > 0, true, 'the cart is left alone when the order is refused');

        // A typed address goes on the order as text (this stand-in order leaves the cart as it is).
        emptiesCart = false;
        const typed = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings, { addressText: '  12 Hill Road, Pune  ' });
        assert.equal(typed.isSuccess, true, typed.message);
        assert.equal(received.addressText, '12 Hill Road, Pune');
        assert.equal('addressId' in received, false);
        emptiesCart = true;
        received = null;

        const result = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings, { addressId: savedAddressId });
        assert.equal(result.isSuccess, true, result.message);
        assert.equal(result.meta.order.orderNumber, 'T-9');
    } finally {
        adminPlaceOrderService.placeOrderOnBehalfOfUser = original;
    }

    assert.equal(received.userId.toString(), ALICE.toString());
    assert.deepEqual(received.items.map((item) => item.quantity), [3, 4]);
    assert.equal(received.shippingAmount, 0);
    assert.equal(received.abandonedCartIds.length, 2);
    // The chosen saved address goes on the order, with no typed one beside it.
    assert.equal(received.addressId.toString(), savedAddressId.toString());
    assert.equal('addressText' in received, false);

    for (const cartId of [userCart._id, guestCart._id]) {
        const emptied = await Cart.findById(cartId);
        assert.equal(emptied.products.length, 0);
        assert.equal(emptied.isAbandoned, false);
    }
    assert.equal((await Cart.findById(bobCart._id)).products.length, 1, "another customer's cart is never touched");
    assert.deepEqual((await listing(guestSettings)).map((entry) => entry.userName), ['Bob']);
    assert.deepEqual(pushes, ['RECOVERED', 'RECOVERED']);
    // The customer's own open storefront is told to re-read its cart.
    assert.deepEqual(customerPushes, [[ALICE.toString(), 'CART', 'EMPTIED']]);

    // Once the customer has come back to it there is nothing to order.
    const gone = await abandonedCartService.placeOrderFromAbandonedCart(VENDOR, id(), userCart._id, masters, masters, guestSettings, { addressText: '12 Hill Road, Pune' });
    assert.equal(gone.statusCode, 404);
});

test("the listing prices each item at today's price in the customer's currency, leaving out what is no longer available", async (t) => {
    if (skipUnlessDb(t)) return;
    await reset();
    const db = mongoose.connection.db;
    const currencyId = id();
    await db.collection('currencymasters').insertOne({ _id: currencyId, name: 'Rupee', short_name: 'INR', symbol: 'Rs', symbol_position: 'PREFIX', decimal_places: 2, status: 'A' });
    // Today's price differs from the 100 the cart remembers, only 2 Shirts are left, and the Cap is no longer sold.
    await db.collection('products').updateOne({ _id: PRODUCT.productId }, { $set: { 'variants.0.sizes.0.price': 120.5, 'variants.0.sizes.0.stock': 2 } });
    await db.collection('products').updateOne({ _id: OTHER.productId }, { $set: { status: 'I' } });
    await Cart.create({ vendorId: VENDOR, userId: ALICE, products: [cartLine(PRODUCT, 'Shirt', 3), cartLine(OTHER, 'Cap', 2)], lastProductAddedAt: minutesAgo(30), isAbandoned: true, abandonedAt: minutesAgo(20) });

    const [row] = await listing({ ...settings, currencyId });
    assert.equal(row.currency.code, 'INR');
    assert.deepEqual(row.items.map((item) => [item.productName, item.isAvailable, item.unitPrice, item.amount]), [
        ['Shirt', true, 120.5, 361.5],
        ['Cap', false, null, null]
    ]);
    assert.equal(row.cartValue, 361.5, 'only the available items');
    assert.equal(row.hasUnavailableItems, true);
    assert.deepEqual(row.items.map((item) => [item.isOutOfStock, item.stock]), [[true, 2], [false, null]], '3 Shirts wanted, 2 in stock');
    assert.equal(row.hasOutOfStockItems, true);
    assert.equal(row.isOutOfStockOrderAllowed, false);
    const [allowed] = await listing({ ...settings, currencyId, allowOutOfStockProductsAddingForAdmin: true });
    assert.equal(allowed.isOutOfStockOrderAllowed, true);

    // Without a store currency nothing can be priced - the row still lists its products.
    const [unpriced] = await listing();
    assert.equal(unpriced.currency, null);
    assert.equal(unpriced.cartValue, null);
    assert.equal(unpriced.items.length, 2);
});
