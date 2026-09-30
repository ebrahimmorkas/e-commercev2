const test = require('node:test');
const assert = require('node:assert/strict');

const validate = require('../middlewares/validate');
const { createFreeCashSchema, updateFreeCashSchema } = require('../middlewares/validations/freeCashValidations');

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
    freeCashName: 'Welcome Bonus',
    freeCashAmount: 100,
    giveFreeCashTo: 'ALL_USERS',
    startDate: '2099-10-01',
    endDate: '2099-10-05',
    ...over
});

test('a plain campaign passes and gets defaults', () => {
    const r = run(createFreeCashSchema, base());
    assert.equal(r.next, true, r.messages.join('; '));
    assert.equal(r.body.timezone, 'Asia/Kolkata');
    assert.equal(r.body.maxCashUsagePerOrder, null);
    assert.equal(r.body.validAbove, 0);
    assert.equal(r.body.canBeUsedWithOtherDiscounts, false);
});

test('amounts: must be positive, per-order cap within the amount', () => {
    assert.equal(run(createFreeCashSchema, base({ freeCashAmount: 0 })).status, 400);
    assert.equal(run(createFreeCashSchema, base({ freeCashAmount: -5 })).status, 400);
    assert.equal(run(createFreeCashSchema, base({ freeCashAmount: 'abc' })).status, 400);
    assert.equal(run(createFreeCashSchema, base({ maxCashUsagePerOrder: 0 })).status, 400);
    const tooBig = run(createFreeCashSchema, base({ maxCashUsagePerOrder: 150 }));
    assert.equal(tooBig.status, 400);
    assert.match(tooBig.messages.join(' '), /cannot be more than the Free Cash amount/);
    assert.equal(run(createFreeCashSchema, base({ maxCashUsagePerOrder: 50 })).body.maxCashUsagePerOrder, 50);
    assert.equal(run(createFreeCashSchema, base({ maxCashUsagePerOrder: '' })).body.maxCashUsagePerOrder, null);
    assert.equal(run(createFreeCashSchema, base({ validAbove: -1 })).status, 400);
});

test('dates: whole days, same day allowed, end not before start', () => {
    assert.equal(run(createFreeCashSchema, base({ startDate: '2099-10-05', endDate: '2099-10-05' })).next, true);
    const backwards = run(createFreeCashSchema, base({ startDate: '2099-10-05', endDate: '2099-10-01' }));
    assert.equal(backwards.status, 400);
    assert.match(backwards.messages.join(' '), /End date cannot be before start date/);
    assert.equal(run(createFreeCashSchema, base({ startDate: '05/10/2099' })).status, 400);
    assert.equal(run(createFreeCashSchema, base({ timezone: 'India' })).status, 400);
});

test('targeting ids: required for their option, dropped otherwise, multipart single value -> array', () => {
    assert.equal(run(createFreeCashSchema, base({ giveFreeCashTo: 'GROUPS' })).status, 400);
    assert.deepEqual(run(createFreeCashSchema, base({ giveFreeCashTo: 'GROUPS', userGroupIds: 'g1' })).body.userGroupIds, ['g1']);
    assert.equal(run(createFreeCashSchema, base({ giveFreeCashTo: 'ONLY_MAIN_CATEGORY' })).status, 400);
    const sub = run(createFreeCashSchema, base({ giveFreeCashTo: 'MAIN_CATEGORY_AND_SUB_CATEGORY', mainCategoryIds: ['m1'] }));
    assert.equal(sub.next, true, 'sub categories are optional');
    assert.equal(run(createFreeCashSchema, base({ userGroupIds: ['x'], mainCategoryIds: ['y'] })).body.userGroupIds, undefined);
});

test('multipart strings are converted', () => {
    const r = run(createFreeCashSchema, base({ freeCashAmount: '250', validAbove: '100', canBeUsedWithOtherDiscounts: 'true', notifyCustomers: 'false', giveFreeCashTo: 'SPECIFIC_USERS' }));
    assert.equal(r.next, true, r.messages.join('; '));
    assert.equal(r.body.freeCashAmount, 250);
    assert.equal(r.body.canBeUsedWithOtherDiscounts, true);
    assert.equal(r.body.notifyCustomers, false);
});

test('update: partial updates allowed, "" removes the per-order limit, unknown fields stripped', () => {
    const renameOnly = run(updateFreeCashSchema, { freeCashName: 'New name' });
    assert.equal(renameOnly.next, true, renameOnly.messages.join('; '));
    assert.equal(renameOnly.body.startDate, undefined);
    assert.equal(run(updateFreeCashSchema, { maxCashUsagePerOrder: '' }).body.maxCashUsagePerOrder, '');
    assert.equal(run(updateFreeCashSchema, { maxCashUsagePerOrder: null }).body.maxCashUsagePerOrder, null);
    assert.equal(run(updateFreeCashSchema, { status: 'D' }).status, 400);
    assert.equal(run(updateFreeCashSchema, { freeCashAmount: 0 }).status, 400);
    assert.equal(run(updateFreeCashSchema, { vendorId: 'x', freeCashName: 'ok name' }).body.vendorId, undefined);
});
