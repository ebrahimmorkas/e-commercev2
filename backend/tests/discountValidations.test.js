const test = require('node:test');
const assert = require('node:assert/strict');

const validate = require('../middlewares/validate');
const { createDiscountSchema, updateDiscountSchema } = require('../middlewares/validations/discountValidations');

// Runs the real validate() middleware and reports what the route would see.
const run = (schema, body) => {
    const req = { body };
    const out = { status: null, payload: null, next: false };
    const res = {
        headersSent: false,
        status(code) { out.status = code; return this; },
        json(payload) { out.payload = payload; return this; }
    };
    validate(schema, 'body')(req, res, () => { out.next = true; });
    return { ...out, body: req.body, messages: (out.payload?.errors || []).map((e) => e.message) };
};

const base = (over = {}) => ({
    name: 'Diwali Sale',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    giveDiscountTo: 'ALL_PRODUCTS_ALL_USERS',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    ...over
});

test('a plain scheduled discount passes and gets defaults', () => {
    const r = run(createDiscountSchema, base());
    assert.equal(r.next, true, r.messages.join('; '));
    assert.equal(r.body.timezone, 'Asia/Kolkata');
    assert.equal(r.body.autoApply, false);
    assert.equal(r.body.discountValidAboveAmount, 0);
    assert.equal(r.body.numberOfUsersCanUseDiscount, null);
});

test('multipart string values are converted to real booleans/numbers/arrays', () => {
    const r = run(createDiscountSchema, base({
        discountValue: '12.5',
        isCouponCodeDiscount: 'true',
        couponCode: 'save10',
        isDiscountOpenForSpecificDays: 'true',
        specificDays: 'monday', // a single repeated multipart field arrives as a string
        isMultipleDiscountUsageOn: 'false',
        precedence: '3',
        notifyCustomers: 'true'
    }));
    assert.equal(r.next, true, r.messages.join('; '));
    assert.equal(r.body.isCouponCodeDiscount, true);
    assert.equal(r.body.couponCode, 'SAVE10');
    assert.equal(r.body.discountValue, 12.5);
    assert.deepEqual(r.body.specificDays, ['MONDAY']);
    assert.equal(r.body.isMultipleDiscountUsageOn, false);
    assert.equal(r.body.precedence, 3);
    assert.equal(r.body.notifyCustomers, true);
});

test('required fields and value ranges', () => {
    assert.equal(run(createDiscountSchema, base({ name: '  ' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountValue: 0 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountValue: -5 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountValue: 'abc' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountValue: 101 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountType: 'FIXED_PRICE', discountValue: 500 })).next, true);
    assert.equal(run(createDiscountSchema, base({ discountType: 'BOGO' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ giveDiscountTo: 'EVERYONE' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ discountValidAboveAmount: -1 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ precedence: 1.5 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ numberOfUsersCanUseDiscount: 0 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ numberOfUsersCanUseDiscount: '' })).body.numberOfUsersCanUseDiscount, null);
});

test('variant targeting is rejected as not supported', () => {
    const r = run(createDiscountSchema, base({ giveDiscountTo: 'PRODUCT_VARIANTS_ALL_USERS' }));
    assert.equal(r.status, 400);
    assert.match(r.messages.join(' '), /not supported yet/);
});

test('dates: required unless ongoing, YYYY-MM-DD, end not before start', () => {
    assert.equal(run(createDiscountSchema, base({ startDate: undefined })).status, 400);
    assert.equal(run(createDiscountSchema, base({ endDate: '05/10/2026' })).status, 400);
    const backwards = run(createDiscountSchema, base({ startDate: '2026-10-05', endDate: '2026-10-01' }));
    assert.equal(backwards.status, 400);
    assert.match(backwards.messages.join(' '), /End date cannot be before start date/);
    assert.equal(run(createDiscountSchema, base({ startDate: '2026-10-05', endDate: '2026-10-05' })).next, true);

    const ongoing = run(createDiscountSchema, base({ isOngoingDiscount: true }));
    assert.equal(ongoing.next, true);
    assert.equal(ongoing.body.startDate, undefined);
    assert.equal(ongoing.body.endDate, undefined);
});

test('only one of ongoing / minimum quantity / coupon', () => {
    const r = run(createDiscountSchema, base({ isOngoingDiscount: true, isCouponCodeDiscount: true, couponCode: 'ABC' }));
    assert.equal(r.status, 400);
    assert.match(r.messages.join(' '), /only one of Ongoing, Minimum Quantity or Coupon Code/);
});

test('minimum quantity rules', () => {
    assert.equal(run(createDiscountSchema, base({ isMinimumDiscountQuantityDiscount: true })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isMinimumDiscountQuantityDiscount: true, minimumQuantity: 0 })).status, 400);
    const ok = run(createDiscountSchema, base({ isMinimumDiscountQuantityDiscount: true, minimumQuantity: '3' }));
    assert.equal(ok.next, true);
    assert.equal(ok.body.minimumQuantity, 3);
    // Sent for a non-min-qty discount -> dropped.
    assert.equal(run(createDiscountSchema, base({ minimumQuantity: 3 })).body.minimumQuantity, undefined);
});

test('coupon code rules', () => {
    assert.equal(run(createDiscountSchema, base({ isCouponCodeDiscount: true })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isCouponCodeDiscount: true, couponCode: 'AB' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isCouponCodeDiscount: true, couponCode: 'NO SPACES' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isCouponCodeDiscount: true, couponCode: 'X'.repeat(31) })).status, 400);
    const autoApplied = run(createDiscountSchema, base({ isCouponCodeDiscount: true, couponCode: 'WELCOME', autoApply: true }));
    assert.equal(autoApplied.status, 400);
    assert.match(autoApplied.messages.join(' '), /cannot be auto-applied/);
    assert.equal(run(createDiscountSchema, base({ couponCode: 'IGNORED' })).body.couponCode, undefined);
});

test('specific days and hours rules', () => {
    const scheduled = run(createDiscountSchema, base({ isDiscountOpenForSpecificDays: true, specificDays: ['MONDAY'] }));
    assert.equal(scheduled.status, 400);
    assert.match(scheduled.messages.join(' '), /Minimum Quantity or Coupon Code/);

    const coupon = { isCouponCodeDiscount: true, couponCode: 'WEEKEND' };
    assert.equal(run(createDiscountSchema, base({ ...coupon, isDiscountOpenForSpecificDays: true })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...coupon, isDiscountOpenForSpecificDays: true, specificDays: ['FUNDAY'] })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...coupon, isDiscountOpenForSpecificDays: true, specificDays: ['MONDAY', 'MONDAY'] })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...coupon, isDiscountOpenForSpecificHours: true, specificHoursStartTime: '10:00', specificHoursEndTime: '12:00' })).status, 400);

    const days = { ...coupon, isDiscountOpenForSpecificDays: true, specificDays: ['FRIDAY'], isDiscountOpenForSpecificHours: true };
    assert.equal(run(createDiscountSchema, base({ ...days, specificHoursStartTime: '10:00' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...days, specificHoursStartTime: '25:00', specificHoursEndTime: '12:00' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...days, specificHoursStartTime: '10:00', specificHoursEndTime: '10:00' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ ...days, specificHoursStartTime: '22:00', specificHoursEndTime: '02:00' })).next, true); // overnight
});

test('timezone must be a real IANA zone', () => {
    assert.equal(run(createDiscountSchema, base({ timezone: 'India' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ timezone: 'America/New_York' })).body.timezone, 'America/New_York');
    assert.equal(run(createDiscountSchema, base({ timezone: '' })).body.timezone, 'Asia/Kolkata');
});

test('group ids are required for group targeting and dropped otherwise', () => {
    assert.equal(run(createDiscountSchema, base({ giveDiscountTo: 'USER_GROUP' })).status, 400);
    assert.equal(run(createDiscountSchema, base({ giveDiscountTo: 'USER_GROUP', userGroupIds: [] })).status, 400);
    assert.equal(run(createDiscountSchema, base({ giveDiscountTo: 'USER_GROUP', userGroupIds: ['a', 'a'] })).status, 400);
    const ok = run(createDiscountSchema, base({ giveDiscountTo: 'USER_GROUP', userGroupIds: 'encodedGroupId' }));
    assert.equal(ok.next, true);
    assert.deepEqual(ok.body.userGroupIds, ['encodedGroupId']);
    assert.equal(run(createDiscountSchema, base({ userGroupIds: ['x'] })).body.userGroupIds, undefined);
    assert.equal(run(createDiscountSchema, base({ giveDiscountTo: 'PRODUCT_GROUP_SPECIFIC_USERS' })).status, 400);
});

test('payment methods, reuse and first-order rules', () => {
    assert.equal(run(createDiscountSchema, base({ isDiscountBasedOnPaymentMethods: true })).status, 400);
    assert.deepEqual(run(createDiscountSchema, base({ isDiscountBasedOnPaymentMethods: true, discountOnPaymentMethods: ['upi'] })).body.discountOnPaymentMethods, ['UPI']);
    assert.equal(run(createDiscountSchema, base({ isDiscountReusable: true })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isDiscountReusable: true, discountReusableNumber: 0 })).status, 400);
    assert.equal(run(createDiscountSchema, base({ isDiscountReusable: true, discountReusableNumber: 3 })).next, true);
    const both = run(createDiscountSchema, base({ firstOrderOnly: true, isDiscountReusable: true, discountReusableNumber: 3 }));
    assert.equal(both.status, 400);
    assert.match(both.messages.join(' '), /first-order-only discount cannot also be reusable/);

    const limitAndFirstOrder = run(createDiscountSchema, base({ firstOrderOnly: true, numberOfUsersCanUseDiscount: 5 }));
    assert.equal(limitAndFirstOrder.status, 400);
    assert.match(limitAndFirstOrder.messages.join(' '), /either First order only or a maximum number of customers/);
    assert.equal(run(createDiscountSchema, base({ firstOrderOnly: true, numberOfUsersCanUseDiscount: '' })).next, true);
    assert.equal(run(createDiscountSchema, base({ numberOfUsersCanUseDiscount: 5 })).next, true);
});

test('unknown fields are stripped; status only on update', () => {
    const created = run(createDiscountSchema, base({ vendorId: 'x', totalUsageCount: 99, status: 'I' }));
    assert.equal(created.next, true);
    assert.equal(created.body.vendorId, undefined);
    assert.equal(created.body.totalUsageCount, undefined);
    assert.equal(created.body.status, undefined);
    assert.equal(run(updateDiscountSchema, base({ status: 'I' })).body.status, 'I');
    assert.equal(run(updateDiscountSchema, base({ status: 'D' })).status, 400);
});
