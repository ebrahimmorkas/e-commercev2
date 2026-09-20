const mongoose = require('mongoose');

// A tax invoice issued for one order. Everything printed on the PDF is frozen here at
// issue time - seller/bank/buyer details, every line and every total - so a later change
// to Company Settings, a product price, a tax rate or an address can never alter an
// invoice that has already been issued. The PDF itself is NOT stored: it is rendered on
// demand from this document (see invoicePdfService.js), which is deterministic.

const invoiceLineSchema = new mongoose.Schema(
    {
        description: { type: String, required: true, trim: true },
        sku: { type: String, trim: true, default: null },
        quantity: { type: Number, required: true, min: 0 },
        unitPrice: { type: Number, required: true, min: 0 },
        // quantity * unitPrice, before tax
        amount: { type: Number, required: true, min: 0 },
        // Sum of the line's tax rates (e.g. 5 for VAT 5%, 18 for CGST 9 + SGST 9)
        taxRate: { type: Number, required: true, min: 0, default: 0 },
        taxAmount: { type: Number, required: true, min: 0, default: 0 },
        total: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const invoicePartySchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: null },
        addressLines: { type: [String], default: [] },
        phone: { type: String, trim: true, default: null },
        email: { type: String, trim: true, default: null },
        trn: { type: String, trim: true, default: null }
    },
    { _id: false }
);

const invoiceSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true
        },
        orderNumber: { type: String, required: true, trim: true },
        orderPlacedAt: { type: Date, default: null },

        // e.g. "SI26/12" = prefix + 2-digit year + / + running number for that year
        invoiceNumber: { type: String, required: true, trim: true },
        sequence: { type: Number, required: true, min: 1 },
        year: { type: Number, required: true },
        issuedAt: { type: Date, required: true, default: Date.now },

        // ISSUED until the order is cancelled/rejected; then VOID, and a credit note is issued for it.
        status: { type: String, enum: ['ISSUED', 'VOID'], default: 'ISSUED', required: true },
        voidedAt: { type: Date, default: null },
        voidReason: { type: String, trim: true, default: null },
        // Full credit note raised when the invoice is voided (same lines/totals, credited back).
        creditNote: {
            type: new mongoose.Schema(
                {
                    // e.g. "CN26/1"
                    number: { type: String, required: true, trim: true },
                    sequence: { type: Number, required: true, min: 1 },
                    year: { type: Number, required: true },
                    issuedAt: { type: Date, required: true, default: Date.now }
                },
                { _id: false }
            ),
            default: undefined
        },

        // True when the seller had a TRN at issue time - the PDF then says "TAX INVOICE"
        isTaxInvoice: { type: Boolean, required: true, default: false },
        // What the tax is called on the document ("VAT", "GST", or a generic "Tax")
        taxLabel: { type: String, trim: true, default: 'Tax' },

        seller: {
            type: new mongoose.Schema(
                {
                    name: { type: String, trim: true, default: null },
                    addressLines: { type: [String], default: [] },
                    // "Emirate : Dubai" / "UAE" style lines under the address
                    region: { type: String, trim: true, default: null },
                    country: { type: String, trim: true, default: null },
                    phone: { type: String, trim: true, default: null },
                    email: { type: String, trim: true, default: null },
                    trn: { type: String, trim: true, default: null },
                    logoUrl: { type: String, trim: true, default: null }
                },
                { _id: false }
            ),
            required: true
        },

        bank: {
            type: new mongoose.Schema(
                {
                    accountHolderName: { type: String, trim: true, default: null },
                    bankName: { type: String, trim: true, default: null },
                    accountNumber: { type: String, trim: true, default: null },
                    branch: { type: String, trim: true, default: null },
                    swiftCode: { type: String, trim: true, default: null }
                },
                { _id: false }
            ),
            default: null
        },

        declaration: { type: String, trim: true, default: null },

        buyer: {
            type: new mongoose.Schema(
                {
                    ...invoicePartySchema.obj,
                    // The person, when `name` is a business (a tax-registered customer)
                    contactPerson: { type: String, trim: true, default: null }
                },
                { _id: false }
            ),
            required: true
        },
        placeOfSupply: { type: String, trim: true, default: null },

        currencyCode: { type: String, required: true, trim: true, uppercase: true },
        currencyDecimalPlaces: { type: Number, required: true, default: 2 },

        lines: { type: [invoiceLineSchema], default: [] },

        totals: {
            totalQuantity: { type: Number, required: true, default: 0 },
            subtotal: { type: Number, required: true, default: 0 },
            discount: { type: Number, required: true, default: 0 },
            freeCash: { type: Number, required: true, default: 0 },
            shipping: { type: Number, required: true, default: 0 },
            additionalCharges: { type: Number, required: true, default: 0 },
            // Whatever is needed to make the rows above add up to grandTotal exactly
            // (e.g. when discount + free cash was capped at the subtotal). Usually 0.
            adjustment: { type: Number, required: true, default: 0 },
            // Only when the vendor rounds invoices to a whole amount: the rounding added to reach grandTotal.
            roundOff: { type: Number, required: true, default: 0 },
            taxTotal: { type: Number, required: true, default: 0 },
            grandTotal: { type: Number, required: true, default: 0 }
        },

        // One row per distinct tax rate, for the tax summary table
        taxSummary: {
            type: [
                new mongoose.Schema(
                    {
                        rate: { type: Number, required: true },
                        taxableValue: { type: Number, required: true },
                        taxAmount: { type: Number, required: true }
                    },
                    { _id: false }
                )
            ],
            default: []
        },

        amountInWords: { type: String, trim: true, default: null },
        taxAmountInWords: { type: String, trim: true, default: null }
    },
    { timestamps: true }
);

// One invoice per order, and invoice numbers never repeat within a vendor.
invoiceSchema.index({ vendorId: 1, orderId: 1 }, { unique: true });
invoiceSchema.index({ vendorId: 1, invoiceNumber: 1 }, { unique: true });
// Credit note numbers are unique too (partial: most invoices never get one).
invoiceSchema.index(
    { vendorId: 1, 'creditNote.number': 1 },
    { unique: true, partialFilterExpression: { 'creditNote.number': { $type: 'string' } } }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
