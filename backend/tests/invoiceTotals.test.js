const test = require('node:test');
const assert = require('node:assert/strict');

// Requiring invoiceService pulls in mongoose models but opens no connection, so this stays a pure unit test.
const { _internal } = require('../services/invoiceService');
const { buildLinesAndTotals } = _internal;

const gst = (rate, amount) => ({ taxName: `GST ${rate}%`, taxRate: rate, taxAmount: amount });

const item = (over = {}) => ({
    productName: 'Widget', variantName: 'Blue', sizeName: 'M', sku: 'W-1',
    unitPrice: 99, quantity: 2, lineAmount: 198,
    taxBreakdown: [gst(18, 35.64)], lineTaxAmount: 35.64,
    ...over
});

const order = (over = {}) => ({
    currencyDecimalPlaces: 2,
    items: [item()],
    subtotal: 198, totalDiscountAmount: 0, totalFreeCashAmount: 0, shippingAmount: 0, additionalCharges: 0,
    totalTaxAmount: 35.64, grandTotal: 233.64,
    ...over
});

test('a simple order reconciles exactly with no adjustment', () => {
    const { totals, lines, taxLabel } = buildLinesAndTotals(order());
    assert.equal(totals.subtotal, 198);
    assert.equal(totals.taxTotal, 35.64);
    assert.equal(totals.grandTotal, 233.64);
    assert.equal(totals.adjustment, 0);
    assert.equal(totals.roundOff, 0);
    assert.equal(totals.totalQuantity, 2);
    assert.equal(taxLabel, 'GST');
    assert.equal(lines[0].description, 'Widget - Blue - M');
    assert.equal(lines[0].total, 233.64);
});

test('discount, Free Cash and shipping are rows that add up to the order total', () => {
    const { totals } = buildLinesAndTotals(order({ totalDiscountAmount: 5, totalFreeCashAmount: 10, shippingAmount: 10, grandTotal: 228.64 }));
    // 198 - 5 - 10 + 10 + 35.64
    assert.equal(totals.discount, 5);
    assert.equal(totals.freeCash, 10);
    assert.equal(totals.shipping, 10);
    assert.equal(totals.adjustment, 0);
    assert.equal(totals.grandTotal, 228.64);
});

test('a cent of rounding between the order and the printed lines goes into "adjustment", never into the total', () => {
    const { totals } = buildLinesAndTotals(order({ grandTotal: 233.65 }));
    assert.equal(totals.grandTotal, 233.65);
    assert.equal(totals.adjustment, 0.01);
});

test('when discount + Free Cash was capped at the subtotal the rows still reconcile', () => {
    // 198 subtotal, 300 of deductions capped to 198 by the cart -> payable is tax only
    const { totals } = buildLinesAndTotals(order({ totalDiscountAmount: 200, totalFreeCashAmount: 100, grandTotal: 35.64 }));
    assert.equal(totals.grandTotal, 35.64);
    const rowsSum = totals.subtotal - totals.discount - totals.freeCash + totals.shipping + totals.additionalCharges + totals.taxTotal + totals.adjustment;
    assert.equal(Math.round(rowsSum * 100) / 100, totals.grandTotal);
});

test('whole-amount round-off changes only the invoice total and shows the difference', () => {
    const { totals } = buildLinesAndTotals(order(), { roundOffToWhole: true });
    assert.equal(totals.grandTotal, 234);
    assert.equal(totals.roundOff, 0.36);
    assert.equal(totals.adjustment, 0);
    const down = buildLinesAndTotals(order({ grandTotal: 233.2 }), { roundOffToWhole: true });
    assert.equal(down.totals.grandTotal, 233);
    assert.equal(down.totals.roundOff, -0.2);
});

test('round-off is off unless asked for', () => {
    assert.equal(buildLinesAndTotals(order()).totals.roundOff, 0);
    assert.equal(buildLinesAndTotals(order(), { roundOffToWhole: false }).totals.grandTotal, 233.64);
});

test('the tax summary groups lines by rate, highest first, and zero-rated lines are kept', () => {
    const o = order({
        items: [
            item({ lineAmount: 100, taxBreakdown: [gst(18, 18)], lineTaxAmount: 18 }),
            item({ lineAmount: 200, taxBreakdown: [gst(18, 36)], lineTaxAmount: 36 }),
            item({ lineAmount: 50, taxBreakdown: [{ taxName: 'VAT 5%', taxRate: 5, taxAmount: 2.5 }], lineTaxAmount: 2.5 }),
            item({ lineAmount: 40, taxBreakdown: [], lineTaxAmount: 0 })
        ],
        subtotal: 390, totalTaxAmount: 56.5, grandTotal: 446.5
    });
    const { taxSummary, totals } = buildLinesAndTotals(o);
    assert.deepEqual(taxSummary.map((r) => r.rate), [18, 5, 0]);
    assert.deepEqual(taxSummary[0], { rate: 18, taxableValue: 300, taxAmount: 54 });
    assert.deepEqual(taxSummary[2], { rate: 0, taxableValue: 40, taxAmount: 0 });
    assert.equal(totals.taxTotal, 56.5);
});

test('composite taxes (CGST + SGST) show as one combined rate on the line', () => {
    const o = order({
        items: [item({ taxBreakdown: [{ taxName: 'CGST 9%', taxRate: 9, taxAmount: 17.82 }, { taxName: 'SGST 9%', taxRate: 9, taxAmount: 17.82 }], lineTaxAmount: 35.64 })]
    });
    const { lines } = buildLinesAndTotals(o);
    assert.equal(lines[0].taxRate, 18);
    assert.equal(lines[0].taxAmount, 35.64);
});

test('amounts are rounded to the order currency decimals', () => {
    const o = order({
        currencyDecimalPlaces: 3,
        items: [item({ unitPrice: 1.0005, quantity: 3, lineAmount: 3.0015, taxBreakdown: [], lineTaxAmount: 0 })],
        subtotal: 3.0015, totalTaxAmount: 0, grandTotal: 3.0015
    });
    const { lines, totals } = buildLinesAndTotals(o);
    assert.equal(lines[0].amount, 3.002);
    assert.equal(totals.grandTotal, 3.002);
});
