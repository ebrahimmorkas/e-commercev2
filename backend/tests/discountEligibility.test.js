const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Requiring cartService pulls in mongoose models but opens no connection, so this stays a pure unit test.
const { _internal } = require('../services/cartService');
const { resolveDiscountEligibility, findUncombinableDiscount, isDiscountLive, DISCOUNT_LOCK } = _internal;

const id = () => new mongoose.Types.ObjectId();
const USER = id();
const OTHER_USER = id();
const PRODUCT_A = id();
const PRODUCT_B = id();
const CATEGORY_A = id();
const USER_GROUP = id();
const PRODUCT_GROUP = id();
const CATEGORY_GROUP = id();
const NOW = new Date('2026-10-05T06:30:00Z'); // Monday 12:00 in India

const discount = (over = {}) => ({
    _id: id(),
    name: 'Test discount',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS',
    isOngoingDiscount: false,
    startDate: new Date('2026-10-01T00:00:00+05:30'),
    endDate: new Date('2026-10-10T23:59:59.999+05:30'),
    isDiscountForceClosed: false,
    discountValidAboveAmount: 0,
    isMinimumDiscountQuantityDiscount: false,
    minimumQuantity: null,
    isDiscountBasedOnPaymentMethods: false,
    isDiscountOpenForSpecificDays: false,
    isDiscountOpenForSpecificHours: false,
    specificDays: [],
    timezone: 'Asia/Kolkata',
    userIds: [], userGroupIds: [], productIds: [], productGroupIds: [], categoryIds: [], categoryGroupIds: [],
    firstOrderOnly: false, isDiscountUsedForFirstTime: false, firstOrderExcludedUserIds: [],
    numberOfUsersCanUseDiscount: null, usedByUserIds: [],
    isDiscountReusable: false, discountReusableNumber: null,
    isMultipleDiscountUsageOn: false,
    ...over
});

// Cart: 2 x A at 100 (category A), 1 x B at 50 = 250.
const ctx = (over = {}) => {
    const lines = [
        { productId: PRODUCT_A, productName: 'A', quantity: 2, amount: 200 },
        { productId: PRODUCT_B, productName: 'B', quantity: 1, amount: 50 }
    ];
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    return {
        userId: USER,
        now: NOW,
        lines,
        productCategoryMap: new Map([[PRODUCT_A.toString(), [CATEGORY_A]], [PRODUCT_B.toString(), [id()]]]),
        groupMap: new Map([
            [USER_GROUP.toString(), { groupType: 'USER', members: [USER] }],
            [PRODUCT_GROUP.toString(), { groupType: 'PRODUCT', members: [PRODUCT_B] }],
            [CATEGORY_GROUP.toString(), { groupType: 'CATEGORY', members: [CATEGORY_A] }]
        ]),
        usageByDiscount: new Map(),
        subtotal,
        availableForThreshold: subtotal,
        formatMoney: (amount) => `Rs ${amount}`,
        ...over
    };
};

const check = (d, c = ctx()) => resolveDiscountEligibility(discount(d), c);

test('storewide percentage and fixed discounts', () => {
    assert.deepEqual([check({}).eligible, check({}).discountAmount], [true, 25]);
    assert.equal(check({ discountType: 'FIXED_PRICE', discountValue: 40 }).discountAmount, 40);
    // A fixed discount can never exceed what it applies to.
    assert.equal(check({ discountType: 'FIXED_PRICE', discountValue: 1000 }).discountAmount, 250);
    assert.equal(check({ discountValue: 33.333 }).discountAmount, 83.33);
});

test('guests never get a discount', () => {
    assert.equal(check({}, ctx({ userId: null })).eligible, false);
});

test('closed, not started, expired and ongoing', () => {
    assert.equal(check({ isDiscountForceClosed: true, forceClosedReason: 'Paused' }).reason, 'Paused');
    assert.equal(check({ startDate: new Date('2026-10-06T00:00:00+05:30') }).reason, 'This discount has not started yet.');
    assert.equal(check({ endDate: new Date('2026-10-04T23:59:59.999+05:30') }).reason, 'This discount has expired.');
    // Last day counts in full: ends 23:59:59.999 IST on 5 Oct, now is 12:00 IST 5 Oct.
    assert.equal(check({ endDate: new Date('2026-10-05T23:59:59.999+05:30') }).eligible, true);
    assert.equal(check({ isOngoingDiscount: true, startDate: null, endDate: null }).eligible, true);
    for (const reason of ['closed', 'expired']) {
        const r = reason === 'closed' ? check({ isDiscountForceClosed: true }) : check({ endDate: new Date('2026-10-01') });
        assert.equal(r.lock, undefined, `${reason} must never be shown as locked`);
    }
});

test('payment-method and variant discounts are not usable', () => {
    assert.equal(check({ isDiscountBasedOnPaymentMethods: true }).eligible, false);
    assert.equal(check({ giveDiscountTo: 'PRODUCT_VARIANTS_ALL_USERS' }).eligible, false);
});

test('specific users and user groups', () => {
    assert.equal(check({ giveDiscountTo: 'ALL_PRODUCTS_SPECIFIC_USERS', userIds: [USER] }).eligible, true);
    const notMine = check({ giveDiscountTo: 'ALL_PRODUCTS_SPECIFIC_USERS', userIds: [OTHER_USER] });
    assert.equal(notMine.eligible, false);
    assert.equal(notMine.lock, undefined);

    assert.equal(check({ giveDiscountTo: 'USER_GROUP', userGroupIds: [USER_GROUP] }).discountAmount, 25);
    const outsider = check({ giveDiscountTo: 'USER_GROUP', userGroupIds: [USER_GROUP] }, ctx({ userId: OTHER_USER }));
    assert.equal(outsider.eligible, false);
    assert.equal(outsider.lock, undefined, 'a non-member must never even see a group discount');
    // An inactive/deleted group is not in groupMap -> nobody qualifies.
    assert.equal(check({ giveDiscountTo: 'USER_GROUP', userGroupIds: [id()] }).eligible, false);
});

test('a group discount below its minimum is shown locked to members only (the reported bug)', () => {
    const d = { giveDiscountTo: 'USER_GROUP', userGroupIds: [USER_GROUP], discountValidAboveAmount: 300 };
    const member = check(d);
    assert.equal(member.eligible, false);
    assert.equal(member.lock, DISCOUNT_LOCK.CART);
    assert.equal(member.reason, 'Add items worth Rs 50 more to unlock this discount.');
    const outsider = check(d, ctx({ userId: OTHER_USER }));
    assert.equal(outsider.lock, undefined);
});

test('product, category and group targeting take off only the matching lines', () => {
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [PRODUCT_B] }).discountAmount, 5);
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_CATEGORIES_ALL_USERS', categoryIds: [CATEGORY_A] }).discountAmount, 20);
    assert.equal(check({ giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [PRODUCT_GROUP] }).discountAmount, 5);
    assert.equal(check({ giveDiscountTo: 'CATEGORY_GROUP_ALL_USERS', categoryGroupIds: [CATEGORY_GROUP] }).discountAmount, 20);
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_PRODUCTS_SPECIFIC_USERS', productIds: [PRODUCT_B], userIds: [USER] }).discountAmount, 5);
    assert.equal(check({ giveDiscountTo: 'CATEGORY_GROUP_SPECIFIC_USERS', categoryGroupIds: [CATEGORY_GROUP], userIds: [OTHER_USER] }).eligible, false);

    const none = check({ giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [id()] });
    assert.equal(none.lock, DISCOUNT_LOCK.CART);
    assert.equal(none.reason, 'No items in your cart qualify for this discount.');
    // Fixed amount capped at the matching lines' value.
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [PRODUCT_B], discountType: 'FIXED_PRICE', discountValue: 80 }).discountAmount, 50);
});

test('minimum cart value counts the cart after Free Cash', () => {
    assert.equal(check({ discountValidAboveAmount: 250 }).eligible, true);
    const afterFreeCash = check({ discountValidAboveAmount: 250 }, ctx({ availableForThreshold: 200 }));
    assert.equal(afterFreeCash.lock, DISCOUNT_LOCK.CART);
    assert.equal(afterFreeCash.reason, 'Add items worth Rs 50 more to unlock this discount.');
});

test('minimum spend on a targeted discount counts only the items it applies to', () => {
    // Product group holds only B (50); the rest of the cart (A, 200) must not count.
    const groupDiscount = { giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [PRODUCT_GROUP], discountValidAboveAmount: 60 };
    const short = check(groupDiscount);
    assert.equal(short.eligible, false);
    assert.equal(short.lock, DISCOUNT_LOCK.CART);
    assert.equal(short.reason, 'Add eligible items worth Rs 10 more to unlock this discount.');
    assert.equal(check({ ...groupDiscount, discountValidAboveAmount: 50 }).eligible, true);

    // Same rule for specific products / categories / category groups.
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [PRODUCT_B], discountValidAboveAmount: 60 }).eligible, false);
    assert.equal(check({ giveDiscountTo: 'SPECIFIC_CATEGORIES_ALL_USERS', categoryIds: [CATEGORY_A], discountValidAboveAmount: 200 }).eligible, true);
    assert.equal(check({ giveDiscountTo: 'CATEGORY_GROUP_ALL_USERS', categoryGroupIds: [CATEGORY_GROUP], discountValidAboveAmount: 201 }).eligible, false);

    // Free Cash is shared out in proportion: 50 of Free Cash on a 250 cart -> 10 on B's 50.
    assert.equal(check({ ...groupDiscount, discountValidAboveAmount: 40 }, ctx({ availableForThreshold: 200 })).eligible, true);
    assert.equal(check({ ...groupDiscount, discountValidAboveAmount: 41 }, ctx({ availableForThreshold: 200 })).eligible, false);
});

test('the reported case: Rs 1 group product + Rs 44 other product, minimum 3', () => {
    const CURRENCY = id();
    const OTHER = id();
    const GROUP = id();
    const c = ctx({
        lines: [
            { productId: CURRENCY, productName: 'currency', quantity: 1, amount: 1 },
            { productId: OTHER, productName: 'other', quantity: 1, amount: 44 }
        ],
        subtotal: 45,
        availableForThreshold: 45,
        productCategoryMap: new Map(),
        groupMap: new Map([[GROUP.toString(), { groupType: 'PRODUCT', members: [CURRENCY] }]])
    });
    const d = { giveDiscountTo: 'PRODUCT_GROUP_ALL_USERS', productGroupIds: [GROUP], discountValidAboveAmount: 3 };
    const result = check(d, c);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'Add eligible items worth Rs 2 more to unlock this discount.');

    // Three of the Rs 1 product reach the minimum.
    c.lines[0] = { productId: CURRENCY, productName: 'currency', quantity: 3, amount: 3 };
    c.subtotal = 47;
    c.availableForThreshold = 47;
    assert.equal(check(d, c).eligible, true);
});

test('minimum quantity counts only qualifying items', () => {
    const minQty = { isMinimumDiscountQuantityDiscount: true, minimumQuantity: 3 };
    assert.equal(check(minQty).eligible, true); // 2 A + 1 B
    const onlyA = check({ ...minQty, giveDiscountTo: 'SPECIFIC_PRODUCTS_ALL_USERS', productIds: [PRODUCT_A] });
    assert.equal(onlyA.lock, DISCOUNT_LOCK.CART);
    assert.equal(onlyA.reason, 'Add 1 more qualifying item(s) to unlock this discount.');
});

test('specific days / hours lock with a reason, in the discount timezone', () => {
    const monday = check({ isDiscountOpenForSpecificDays: true, specificDays: ['MONDAY'] });
    assert.equal(monday.eligible, true);
    const tuesday = check({ isDiscountOpenForSpecificDays: true, specificDays: ['TUESDAY', 'SATURDAY'] });
    assert.equal(tuesday.lock, DISCOUNT_LOCK.SCHEDULE);
    assert.equal(tuesday.reason, 'This discount is only available on Tuesday, Saturday.');
    const evening = check({ isDiscountOpenForSpecificDays: true, specificDays: ['MONDAY'], isDiscountOpenForSpecificHours: true, specificHoursStartTime: '18:00', specificHoursEndTime: '23:00' });
    assert.equal(evening.lock, DISCOUNT_LOCK.SCHEDULE);
    // Schedule is checked only after who-may-use-it: an outsider never learns about it.
    const outsider = check({ giveDiscountTo: 'ALL_PRODUCTS_SPECIFIC_USERS', userIds: [OTHER_USER], isDiscountOpenForSpecificDays: true, specificDays: ['TUESDAY'] });
    assert.equal(outsider.lock, undefined);
});

test('usage limits: first order, customer limit, reuse count', () => {
    assert.equal(check({ firstOrderOnly: true, isDiscountUsedForFirstTime: true }).reason, 'This discount has already been claimed.');
    assert.equal(check({ firstOrderOnly: true, firstOrderExcludedUserIds: [USER] }).eligible, false);
    assert.equal(check({ firstOrderOnly: true }).eligible, true);

    assert.equal(check({ numberOfUsersCanUseDiscount: 1, usedByUserIds: [OTHER_USER] }).reason, 'This discount has reached its limit of customers.');
    // Already one of the N customers -> still allowed (reuse rules decide).
    assert.equal(check({ numberOfUsersCanUseDiscount: 1, usedByUserIds: [USER], isDiscountReusable: true, discountReusableNumber: 5 }).eligible, true);

    const d = discount();
    const used = (count) => ctx({ usageByDiscount: new Map([[d._id.toString(), count]]) });
    assert.equal(resolveDiscountEligibility(d, used(1)).reason, 'You have already used this discount.');
    const reusable = discount({ isDiscountReusable: true, discountReusableNumber: 3 });
    const usedR = (count) => ctx({ usageByDiscount: new Map([[reusable._id.toString(), count]]) });
    assert.equal(resolveDiscountEligibility(reusable, usedR(2)).eligible, true);
    assert.equal(resolveDiscountEligibility(reusable, usedR(3)).reason, 'You have already used this discount 3 times.');
    // Used-up is never shown as locked.
    assert.equal(resolveDiscountEligibility(d, used(1)).lock, undefined);
});

test('combining rule', () => {
    const solo = discount({ name: 'Solo' });
    const combinable = discount({ isMultipleDiscountUsageOn: true });
    assert.equal(findUncombinableDiscount([solo]), null);
    assert.equal(findUncombinableDiscount([combinable, discount({ isMultipleDiscountUsageOn: true })]), null);
    assert.equal(findUncombinableDiscount([combinable, solo]).name, 'Solo');
});

test('isDiscountLive (used for coupon lookup)', () => {
    const now = new Date('2026-10-05T06:30:00Z');
    assert.equal(isDiscountLive(discount(), now), true);
    assert.equal(isDiscountLive(discount({ isDiscountForceClosed: true }), now), false);
    assert.equal(isDiscountLive(discount({ endDate: new Date('2026-10-04T00:00:00Z') }), now), false);
    assert.equal(isDiscountLive(discount({ startDate: new Date('2026-10-06T00:00:00Z') }), now), false);
    assert.equal(isDiscountLive(discount({ isOngoingDiscount: true, startDate: null, endDate: null }), now), true);
});
