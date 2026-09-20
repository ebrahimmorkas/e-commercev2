const test = require('node:test');
const assert = require('node:assert/strict');
const { renderInvoicePdf } = require('../services/invoicePdfService');

const invoice = (over = {}) => ({
    invoiceNumber: 'SI26/1', orderNumber: 'ORD-000001',
    orderPlacedAt: new Date('2026-09-10T10:00:00Z'), issuedAt: new Date('2026-09-10T10:05:00Z'),
    status: 'ISSUED', isTaxInvoice: true, taxLabel: 'VAT', currencyCode: 'AED', currencyDecimalPlaces: 2,
    seller: { name: 'TEST SELLER LLC', addressLines: ['Shop 1, Test Building'], region: 'Dubai', country: 'UAE', phone: '+971 4 000 0000', email: 'sales@example.test', trn: '100000000000003', logoUrl: null },
    bank: { accountHolderName: 'TEST SELLER LLC', bankName: 'Test Bank', accountNumber: 'AE000000000000000000000', branch: 'Dubai', swiftCode: 'TESTAEAAXXX' },
    declaration: null,
    buyer: { name: 'Buyer Trading LLC', contactPerson: 'A Person', addressLines: ['Al Ain'], phone: '500000000', email: 'buyer@example.test', trn: '100000000000004' },
    placeOfSupply: 'Abu Dhabi, UAE',
    lines: [{ description: 'Item one', sku: 'S1', quantity: 2, unitPrice: 50, amount: 100, taxRate: 5, taxAmount: 5, total: 105 }],
    totals: { totalQuantity: 2, subtotal: 100, discount: 0, freeCash: 0, shipping: 0, additionalCharges: 0, adjustment: 0, roundOff: 0, taxTotal: 5, grandTotal: 105 },
    taxSummary: [{ rate: 5, taxableValue: 100, taxAmount: 5 }],
    amountInWords: 'One Hundred Five UAE Dirham Only', taxAmountInWords: 'Five UAE Dirham Only',
    ...over
});

const pageCount = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

test('renders a valid one-page PDF for a small invoice', async () => {
    const buffer = await renderInvoicePdf(invoice());
    assert.equal(buffer.slice(0, 5).toString(), '%PDF-');
    assert.equal(pageCount(buffer), 1);
});

test('two copies (Original + Duplicate) make a longer document', async () => {
    const one = await renderInvoicePdf(invoice(), { copies: 1 });
    const two = await renderInvoicePdf(invoice(), { copies: 2 });
    assert.equal(pageCount(two), pageCount(one) * 2);
});

test('a long invoice runs onto more pages', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ description: `Item ${i + 1}`, sku: `S${i}`, quantity: 1, unitPrice: 10, amount: 10, taxRate: 5, taxAmount: 0.5, total: 10.5 }));
    const buffer = await renderInvoicePdf(invoice({ lines }));
    assert.ok(pageCount(buffer) >= 2);
});

test('a credit note needs the invoice to have one, and renders when it does', async () => {
    await assert.rejects(() => renderInvoicePdf(invoice(), { document: 'credit-note' }), /no credit note/i);
    const voided = invoice({
        status: 'VOID', voidedAt: new Date('2026-09-11T09:00:00Z'), voidReason: 'Cancelled by customer',
        creditNote: { number: 'CN26/1', sequence: 1, year: 2026, issuedAt: new Date('2026-09-11T09:00:00Z') }
    });
    const creditNote = await renderInvoicePdf(voided, { document: 'credit-note' });
    assert.equal(creditNote.slice(0, 5).toString(), '%PDF-');
    const cancelledInvoice = await renderInvoicePdf(voided);
    assert.equal(cancelledInvoice.slice(0, 5).toString(), '%PDF-');
});

test('round-off and adjustment rows, and a non-tax invoice, render without error', async () => {
    const buffer = await renderInvoicePdf(invoice({
        isTaxInvoice: false, bank: null,
        totals: { totalQuantity: 2, subtotal: 100, discount: 5, freeCash: 2, shipping: 10, additionalCharges: 1, adjustment: 0.01, roundOff: -0.36, taxTotal: 5, grandTotal: 108 }
    }));
    assert.equal(buffer.slice(0, 5).toString(), '%PDF-');
});
