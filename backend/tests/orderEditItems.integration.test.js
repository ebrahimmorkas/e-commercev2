// Edit Order - changing the quantity of / removing products already on a
// placed order (orderEditService.updateOrderItems), against a real MongoDB:
// stock, totals, the cart copy, and the customer's discount / Free Cash being
// re-checked and given back.
//
// Uses its own throwaway database - the MONGODB_URI database name with
// "-orderedit-test" appended - and drops it afterwards. Skipped when MongoDB
// isn't reachable.
require('dotenv').config({ quiet: true });
process.env.IS_REDIS_SERVER_ON = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const DiscountUsage = require('../models/DiscountUsage');
const UserFreeCash = require('../models/UserFreeCash');
const orderEditService = require('../services/orderEditService');
const cartService = require('../services/cartService');
const discountUsageService = require('../services/discountUsageService');

const id = () => new mongoose.Types.ObjectId();
const VENDOR = id();
const ADMIN = id();
const ALICE = id();
const SHIRT = { productId: id(), variantId: id(), sizeId: id() };
const CAP = { productId: id(), variantId: id(), sizeId: id() };
const DISCOUNT = id();
const FREE_CASH = id();
const GRANT = id();
const ORDER = id();

const masters = {};
const settingsOff = { allowOutOfStockProductsAddingForAdmin: false };
const settingsOn = { allowOutOfStockProductsAddingForAdmin: true };

const testDbUri = () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = `${uri.pathname.replace(/^\//, '') || 'test'}-orderedit-test`;
    return uri.toString();
};

let connected = false;

test.before(async () => {
    try {
        await mongoose.connect(testDbUri(), { serverSelectionTimeoutMS: 3000 });
        connected = mongoose.connection.db.databaseName.endsWith('-orderedit-test');
    } catch (err) {
        connected = false;
    }
    if (!connected) return;
    await mongoose.connection.db.dropDatabase();
});

test.after(async () => {
    if (connected) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});

const skipUnlessDb = (t) => {
    if (!connected) t.skip('MongoDB not reachable');
    return !connected;
};

const productDoc = (line, name, price, stock) => ({
    _id: line.productId, vendorId: VENDOR, name, status: 'A', taxIds: [], mainCategory: id(),
    variants: [{ _id: line.variantId, status: 'A', displayName: 'Default', sizes: [{ _id: line.sizeId, status: 'A', sizeName: 'M', sku: `SKU-${name}`, price, stock }] }]
});

const orderItem = (line, productName, unitPrice, quantity, stockDeductedQuantity = null) => ({
    ...line, productName, variantName: 'Default', sizeName: 'M', sku: `SKU-${productName}`,
    unitPrice, quantity, lineAmount: unitPrice * quantity, taxBreakdown: [], lineTaxAmount: 0, stockDeductedQuantity
});

const orderDoc = (over = {}) => ({
    _id: ORDER, vendorId: VENDOR, userId: ALICE, orderNumber: 'T-1', status: 'A',
    orderStepMasterId: id(), currentStepId: id(), currentStepCode: 'ACCEPTED', currentStepName: 'Accepted', currentStepSequence: 1,
    isFinalized: false, cancelledAt: null, isPlacedByAdmin: false, isWalkInCustomer: false,
    totalTaxAmount: 0, totalDiscountAmount: 0, totalFreeCashAmount: 0, shippingAmount: 20,
    currencyId: id(), currencyCode: 'INR', currencySymbol: 'Rs', currencySymbolPosition: 'PREFIX', currencyDecimalPlaces: 2, exchangeRate: 1,
    payment: { status: 'PENDING', amount: 0 },
    createdAt: new Date(), updatedAt: new Date(),
    ...over
});

// Storefront order: 5 x Shirt at 100 + 2 x Cap at 50 = 600, a 10% discount
// valid above 300 (60) and 40 of Free Cash valid above 150; shipping 20.
// Stock left after the order: Shirt 10, Cap 3.
const seedStorefrontOrder = async () => {
    const db = mongoose.connection.db;
    await Promise.all(['products', 'orders', 'carts', 'discounts', 'discountusages', 'freecashes', 'userfreecashes'].map((name) => db.collection(name).deleteMany({})));

    await db.collection('products').insertMany([productDoc(SHIRT, 'Shirt', 100, 10), productDoc(CAP, 'Cap', 50, 3)]);
    await db.collection('discounts').insertOne({
        _id: DISCOUNT, vendorId: VENDOR, name: 'Ten percent', status: 'A', discountType: 'PERCENTAGE', discountValue: 10,
        giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS', discountValidAboveAmount: 300, isOngoingDiscount: true,
        numberOfUsersCanUseDiscount: 5, usedByUserIds: [ALICE], totalUsageCount: 1, totalDiscountGiven: 60
    });
    await db.collection('discountusages').insertOne({
        vendorId: VENDOR, discountId: DISCOUNT, userId: ALICE, orderId: ORDER, discountName: 'Ten percent', discountAmount: 60, usedDate: new Date(), status: 'A'
    });
    await db.collection('freecashes').insertOne({
        _id: FREE_CASH, vendorId: VENDOR, freeCashName: 'Welcome', status: 'A', giveFreeCashTo: 'ALL_USERS', validAbove: 150,
        canBeUsedWithOtherDiscounts: true, startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000)
    });
    await db.collection('userfreecashes').insertOne({
        _id: GRANT, vendorId: VENDOR, freeCashId: FREE_CASH, userId: ALICE, amount: 100, usedAmount: 40, remainingAmount: 60,
        issuedDate: new Date(), isCashUsed: false, isCashExpired: false, isRevoked: false, status: 'A',
        cashUsageHistory: [{ amountUsed: 40, remainingAmount: 60, usedDate: new Date(), orderId: ORDER }], cashRefundHistory: [], revokeHistory: []
    });

    const cartLine = (line, productName, unitPrice, quantity) => ({
        productId: line.productId, productName,
        variants: [{ variantId: line.variantId, variantName: 'Default', sizes: [{ sizeId: line.sizeId, sizeName: 'M', unitPrice, sku: `SKU-${productName}`, quantity, isCheckedOut: true }] }]
    });
    const cart = await Cart.create({
        vendorId: VENDOR, userId: ALICE, status: 'D',
        products: [cartLine(SHIRT, 'Shirt', 100, 5), cartLine(CAP, 'Cap', 50, 2)],
        discounts: [{ discountId: DISCOUNT, discountName: 'Ten percent', discountAmount: 60 }],
        totalDiscountAmount: 60,
        freeCash: [{ freeCashId: FREE_CASH, userFreeCashId: GRANT, freeCashName: 'Welcome', canBeUsedWithOtherDiscounts: true, amountApplied: 40 }],
        totalFreeCashAmount: 40
    });

    await db.collection('orders').insertOne(orderDoc({
        cartId: cart._id,
        items: [orderItem(SHIRT, 'Shirt', 100, 5), orderItem(CAP, 'Cap', 50, 2)],
        subtotal: 600, totalDiscountAmount: 60, totalFreeCashAmount: 40, grandTotal: 520
    }));
    return cart;
};

const stockOf = async (line) => {
    const product = await Product.findById(line.productId).lean();
    return product.variants[0].sizes[0].stock;
};
const cartSize = async (cartId, line) => {
    const cart = await Cart.findById(cartId).lean();
    return cart.products.find((p) => p.productId.toString() === line.productId.toString()).variants[0].sizes[0];
};
const change = (line, quantity) => ({ ...line, quantity });
const update = (items, settings = settingsOff) => orderEditService.updateOrderItems(VENDOR, ADMIN, ORDER, { items, applyBulkPricing: false }, masters, masters, settings);
const preview = (items, settings = settingsOff) => orderEditService.previewOrderItemChanges(VENDOR, ORDER, { items, applyBulkPricing: false }, masters, masters, settings);

test('decreasing a quantity gives stock back, keeps the saved price and lowers a discount that still qualifies', async (t) => {
    if (skipUnlessDb(t)) return;
    const cart = await seedStorefrontOrder();

    // The preview works it out without saving anything.
    const previewed = await preview([change(SHIRT, 4)]);
    assert.equal(previewed.isSuccess, true, previewed.message);
    assert.equal(previewed.meta.updated.grandTotal, 430);
    assert.equal((await Order.findById(ORDER)).grandTotal, 520);
    assert.equal(await stockOf(SHIRT), 10);

    const result = await update([change(SHIRT, 4)]);
    assert.equal(result.isSuccess, true, result.message);

    const order = await Order.findById(ORDER).lean();
    assert.equal(order.items[0].quantity, 4);
    assert.equal(order.items[0].unitPrice, 100);
    assert.equal(order.items[0].stockDeductedQuantity, 4, 'the changed line now holds its own stock');
    assert.equal(order.items[1].stockDeductedQuantity, null, 'the untouched line is still held through the cart');
    assert.equal(order.subtotal, 500);
    assert.equal(order.totalDiscountAmount, 50, '10% of the smaller order');
    assert.equal(order.totalFreeCashAmount, 40);
    assert.equal(order.grandTotal, 430);
    assert.equal(order.updatedBy.toString(), ADMIN.toString());

    assert.equal(await stockOf(SHIRT), 11);
    assert.equal((await cartSize(cart._id, SHIRT)).quantity, 4, 'returns/exchanges read the cart copy');
    assert.equal((await DiscountUsage.findOne({ orderId: ORDER })).discountAmount, 50);
    assert.equal((await Discount.findById(DISCOUNT)).totalDiscountGiven, 50);
    assert.equal((await UserFreeCash.findById(GRANT)).remainingAmount, 60, 'Free Cash still qualifies - untouched');
});

test('a discount and Free Cash the smaller order no longer qualifies for come off and are given back', async (t) => {
    if (skipUnlessDb(t)) return;
    const cart = await seedStorefrontOrder();

    // 1 x Shirt = 100: below the discount's 300 and the Free Cash's 150.
    const result = await update([change(SHIRT, 1), change(CAP, 0)]);
    assert.equal(result.isSuccess, true, result.message);
    assert.deepEqual(result.meta.promotionChanges.map((c) => [c.type, c.isRemoved]), [['DISCOUNT', true], ['FREE_CASH', true]]);

    const order = await Order.findById(ORDER).lean();
    assert.equal(order.items.length, 1);
    assert.equal(order.subtotal, 100);
    assert.equal(order.totalDiscountAmount, 0);
    assert.equal(order.totalFreeCashAmount, 0);
    assert.equal(order.grandTotal, 120, 'products 100 + shipping 20');

    assert.equal(await stockOf(SHIRT), 14);
    assert.equal(await stockOf(CAP), 5);
    assert.equal((await cartSize(cart._id, CAP)).isCheckedOut, false, 'a removed line is no longer part of the order');

    // The customer can use both again.
    const discount = await Discount.findById(DISCOUNT).lean();
    assert.equal(discount.totalUsageCount, 0);
    assert.equal(discount.totalDiscountGiven, 0);
    assert.deepEqual(discount.usedByUserIds, []);
    assert.equal((await DiscountUsage.findOne({ orderId: ORDER })).status, 'D');
    assert.equal((await discountUsageService.countUsageByUser(VENDOR, ALICE, [DISCOUNT])).size, 0, 'the use no longer counts against them');

    const grant = await UserFreeCash.findById(GRANT).lean();
    assert.equal(grant.remainingAmount, 100);
    assert.equal(grant.usedAmount, 0);
    assert.equal(grant.cashRefundHistory.length, 1);
    assert.equal(grant.cashRefundHistory[0].orderId.toString(), ORDER.toString());

    const savedCart = await Cart.findById(cart._id).lean();
    assert.equal(savedCart.discounts.length, 0);
    assert.equal(savedCart.freeCash.length, 0);

    // Cancelling later gives each line's stock back exactly once.
    const owned = new Set(order.items.filter((item) => item.stockDeductedQuantity !== null).map((item) => cartService.orderLineKey(item)));
    await cartService.restoreStockForOrder(cart._id, owned);
    assert.equal(await stockOf(SHIRT), 14, 'held by the order, not given back from the cart');
    assert.equal(await stockOf(CAP), 5, 'removed line is not given back a second time');
});

test("increasing a quantity charges today's price and only goes over the stock when the admin setting allows it", async (t) => {
    if (skipUnlessDb(t)) return;
    const cart = await seedStorefrontOrder();
    await Product.updateOne({ _id: SHIRT.productId }, { $set: { 'variants.0.sizes.0.price': 120 } });

    // 5 -> 8 needs 3 of the 10 in stock; discounts are not re-checked on an increase.
    const result = await update([change(SHIRT, 8)]);
    assert.equal(result.isSuccess, true, result.message);
    let order = await Order.findById(ORDER).lean();
    assert.equal(order.items[0].unitPrice, 120);
    assert.equal(order.items[0].lineAmount, 960);
    assert.equal(order.items[0].stockDeductedQuantity, 8);
    assert.equal(order.subtotal, 1060);
    assert.equal(order.totalDiscountAmount, 60);
    assert.equal(order.grandTotal, 980);
    assert.equal(await stockOf(SHIRT), 7);
    const size = await cartSize(cart._id, SHIRT);
    assert.equal(size.quantity, 8);
    assert.equal(size.unitPrice, 120);

    // 8 -> 20 needs 12, only 7 left.
    const refused = await update([change(SHIRT, 20)]);
    assert.equal(refused.isSuccess, false);
    assert.equal(refused.statusCode, 400);
    assert.match(refused.message, /only 7 more in stock/);
    assert.equal(await stockOf(SHIRT), 7);

    const allowed = await update([change(SHIRT, 20)], settingsOn);
    assert.equal(allowed.isSuccess, true, allowed.message);
    assert.equal(allowed.meta.warnings.length, 1);
    order = await Order.findById(ORDER).lean();
    assert.equal(order.items[0].quantity, 20);
    assert.equal(order.items[0].stockDeductedQuantity, 15, 'only what was really taken');
    assert.equal(await stockOf(SHIRT), 0);

    // Taking the unbacked units off again gives nothing back; going below what is held does.
    const reduced = await update([change(SHIRT, 10)], settingsOn);
    assert.equal(reduced.isSuccess, true, reduced.message);
    assert.equal(await stockOf(SHIRT), 5);
    assert.equal((await Order.findById(ORDER).lean()).items[0].stockDeductedQuantity, 10);
});

test('an order keeps at least one product, and only its own lines can be changed', async (t) => {
    if (skipUnlessDb(t)) return;
    await seedStorefrontOrder();

    const all = await update([change(SHIRT, 0), change(CAP, 0)]);
    assert.equal(all.statusCode, 400);
    assert.match(all.message, /at least one product/);

    const same = await update([change(SHIRT, 5)]);
    assert.equal(same.statusCode, 400);

    const stranger = await update([change({ productId: id(), variantId: id(), sizeId: id() }, 2)]);
    assert.equal(stranger.statusCode, 400);

    await Order.updateOne({ _id: ORDER }, { $set: { 'payment.status': 'PAID' } });
    const paid = await update([change(SHIRT, 4)]);
    assert.equal(paid.statusCode, 409);

    const order = await Order.findById(ORDER).lean();
    assert.equal(order.items.length, 2);
    assert.equal(order.grandTotal, 520);
    assert.equal(await stockOf(SHIRT), 10);
});

test('an admin-placed order: its own discount never exceeds what the products are worth', async (t) => {
    if (skipUnlessDb(t)) return;
    const db = mongoose.connection.db;
    await Promise.all(['products', 'orders'].map((name) => db.collection(name).deleteMany({})));
    await db.collection('products').insertMany([productDoc(SHIRT, 'Shirt', 100, 10), productDoc(CAP, 'Cap', 50, 3)]);
    // 2 x Shirt + 2 x Cap = 300, the admin took 150 off; COD amount due 150.
    await db.collection('orders').insertOne(orderDoc({
        userId: null, isPlacedByAdmin: true, isWalkInCustomer: true, shippingAmount: 0,
        items: [orderItem(SHIRT, 'Shirt', 100, 2, 2), orderItem(CAP, 'Cap', 50, 2, 2)],
        subtotal: 300, totalDiscountAmount: 150, adminDiscountAmount: 150, grandTotal: 150,
        payment: { status: 'PENDING', amount: 150 }
    }));

    const result = await update([change(SHIRT, 0)]);
    assert.equal(result.isSuccess, true, result.message);
    const order = await Order.findById(ORDER).lean();
    assert.equal(order.subtotal, 100);
    assert.equal(order.totalDiscountAmount, 100);
    assert.equal(order.adminDiscountAmount, 100);
    assert.equal(order.grandTotal, 0);
    assert.equal(order.payment.amount, 0, 'the amount due follows the total');
    assert.equal(await stockOf(SHIRT), 12);
});
