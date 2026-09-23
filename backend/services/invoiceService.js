const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const counterService = require('./counterService');
const emailService = require('./emailService');
const invoicePdfService = require('./invoicePdfService');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { amountInWords } = require('../utils/amountInWords');
const { EMAIL_MODULES } = require('../constants/emailModuleConstants');

const DEFAULT_INVOICE_PREFIX = 'SI';
const CREDIT_NOTE_PREFIX = 'CN';
const FEATURE_FLAG = 'isPDFDownloadableFeatureOn';

const roundTo = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round((Number(value) || 0) * factor) / factor;
};

// "VAT 5%" / "GST 18%" tax names -> the label for the tax columns. Anything else stays generic.
const deriveTaxLabel = (taxNames) => {
    const joined = taxNames.join(' ');
    if (/vat/i.test(joined)) return 'VAT';
    if (/gst/i.test(joined)) return 'GST';
    return 'Tax';
};

const buildAddressLines = (snapshot) => {
    if (!snapshot) return [];
    const streetLine = [snapshot.floor ? `Floor ${snapshot.floor}` : null, snapshot.roomNo, snapshot.building].filter(Boolean).join(', ');
    const cityLine = [snapshot.cityName, [snapshot.stateName, snapshot.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [streetLine, snapshot.addressInWords, cityLine, snapshot.countryName].filter(Boolean);
};

const buildSeller = async (companySettingsData) => {
    try {
        const settings = companySettingsData || {};
        const [state, country] = await Promise.all([
            settings.storeStateId ? StateMaster.findById(settings.storeStateId).select('state_name').lean() : null,
            settings.storeCountryId ? CountryMaster.findById(settings.storeCountryId).select('country_name').lean() : null
        ]);

        return {
            name: settings.companyName || settings.adminName || null,
            addressLines: [
                settings.adminAddress,
                [settings.adminCity, settings.adminPincode].filter(Boolean).join(' ')
            ].filter(Boolean),
            region: state?.state_name || settings.adminState || null,
            country: country?.country_name || null,
            phone: settings.adminPhoneNumber || null,
            email: settings.adminEmail || null,
            trn: settings.taxRegistrationNumber || null,
            logoUrl: settings.companyLogo?.url || null
        };
    } catch (err) {
        throw err;
    }
};

const buildBank = (companySettingsData) => {
    const settings = companySettingsData || {};
    const hasAnyBankDetail = settings.bankName || settings.bankAccountNumber || settings.bankAccountHolderName;
    if (!hasAnyBankDetail) return null;
    return {
        accountHolderName: settings.bankAccountHolderName || null,
        bankName: settings.bankName || null,
        accountNumber: settings.bankAccountNumber || null,
        branch: settings.branchName || null,
        swiftCode: settings.swiftCode || null
    };
};

const buildBuyer = async (order) => {
    try {
        if (order.isWalkInCustomer) {
            const walkIn = order.walkInCustomer || {};
            return {
                name: walkIn.name || 'Walk-in Customer',
                addressLines: walkIn.address ? [walkIn.address] : [],
                phone: walkIn.phone || null,
                email: walkIn.email || null,
                trn: null,
                contactPerson: null
            };
        }

        const user = order.userId
            ? await User.findById(order.userId).select('name email phone_no isTaxRegistered businessFullName trn').lean()
            : null;
        const snapshot = order.billingAddressSnapshot || order.shippingAddressSnapshot;
        const addressLines = snapshot ? buildAddressLines(snapshot) : (order.adminEnteredAddress ? [order.adminEnteredAddress] : []);

        // A customer who registered as tax registered is invoiced under their business name
        // and TRN, with themself as the contact person.
        const isBusiness = !!(user?.isTaxRegistered && user.businessFullName);
        return {
            name: isBusiness ? user.businessFullName : (user?.name || 'Customer'),
            addressLines,
            phone: user?.phone_no || null,
            email: user?.email || null,
            trn: isBusiness ? (user.trn || null) : null,
            contactPerson: isBusiness ? (user.name || null) : null
        };
    } catch (err) {
        throw err;
    }
};

// Turns the order's frozen line items/totals into invoice lines and reconciled totals.
const buildLinesAndTotals = (order, { roundOffToWhole = false } = {}) => {
    const decimals = order.currencyDecimalPlaces ?? 2;
    const round = (value) => roundTo(value, decimals);

    const taxNames = new Set();
    const lines = order.items.map((item) => {
        (item.taxBreakdown || []).forEach((tax) => taxNames.add(tax.taxName));
        const taxRate = roundTo((item.taxBreakdown || []).reduce((sum, tax) => sum + tax.taxRate, 0), 4);
        const taxAmount = round(item.lineTaxAmount || 0);
        return {
            description: [item.productName, item.variantName, item.sizeName].filter(Boolean).join(' - '),
            sku: item.sku || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: round(item.lineAmount),
            taxRate,
            taxAmount,
            total: round(item.lineAmount + taxAmount)
        };
    });

    // Group the tax summary by rate.
    const byRate = new Map();
    lines.forEach((line) => {
        const row = byRate.get(line.taxRate) || { rate: line.taxRate, taxableValue: 0, taxAmount: 0 };
        row.taxableValue = round(row.taxableValue + line.amount);
        row.taxAmount = round(row.taxAmount + line.taxAmount);
        byRate.set(line.taxRate, row);
    });
    const taxSummary = [...byRate.values()].sort((a, b) => b.rate - a.rate);

    // The printed tax total is the sum of the printed lines, so the invoice is internally
    // consistent. The order's own figures can differ from that by a rounding cent; whatever is
    // needed to land exactly on what the customer was charged goes into `adjustment`.
    const taxTotal = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const subtotal = round(order.subtotal);
    const discount = round(order.totalDiscountAmount || 0);
    const freeCash = round(order.totalFreeCashAmount || 0);
    const shipping = round(order.shippingAmount || 0);
    const additionalCharges = round(order.additionalCharges || 0);
    const exactGrandTotal = round(order.grandTotal);
    const adjustment = round(exactGrandTotal - (subtotal - discount - freeCash + shipping + additionalCharges + taxTotal));

    // Optional whole-amount rounding (vendor setting): the rounding is shown as its own row and the
    // invoice total becomes the rounded figure. The order itself still holds the exact amount.
    const grandTotal = roundOffToWhole ? Math.round(exactGrandTotal) : exactGrandTotal;
    const roundOff = round(grandTotal - exactGrandTotal);

    return {
        lines,
        taxSummary,
        taxLabel: deriveTaxLabel([...taxNames]),
        totals: {
            totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
            subtotal, discount, freeCash, shipping, additionalCharges, adjustment, roundOff, taxTotal, grandTotal
        }
    };
};

/**
 * Everything on an invoice that comes from the ORDER (buyer, place of supply, lines, totals, tax
 * summary, amounts in words). The seller/bank/declaration are deliberately not here: they are
 * frozen when the invoice is issued. Shared by issuing and by refreshing after an order edit so
 * the two can never disagree about how an order becomes an invoice.
 * @param {Object} seller - the invoice's seller block (only region/country are read, for place of supply)
 */
const buildOrderDerivedInvoiceFields = async (order, { seller, companySettingsData }) => {
    try {
        const buyer = await buildBuyer(order);
        const { lines, taxSummary, taxLabel, totals } = buildLinesAndTotals(order, {
            roundOffToWhole: companySettingsData?.invoiceRoundOffToWhole === true
        });

        const shipping = order.shippingAddressSnapshot;
        const placeOfSupply = shipping
            ? [shipping.stateName, shipping.countryName].filter(Boolean).join(', ')
            : [seller?.region, seller?.country].filter(Boolean).join(', ') || null;

        return {
            buyer,
            placeOfSupply,
            lines,
            totals,
            taxSummary,
            taxLabel,
            amountInWords: amountInWords(totals.grandTotal, order.currencyCode, order.currencyDecimalPlaces),
            taxAmountInWords: amountInWords(totals.taxTotal, order.currencyCode, order.currencyDecimalPlaces)
        };
    } catch (err) {
        throw err;
    }
};

const isInvoiceFeatureOn = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        return await common.checkFeatureOnOrOff(vendorId, websiteMasterData, companyMasterData, FEATURE_FLAG, FEATURE_FLAG);
    } catch (err) {
        throw err;
    }
};

/**
 * Issues (or returns the already-issued) invoice for an order. Idempotent: one invoice per order.
 * Gated by isPDFDownloadableFeatureOn (WebsiteMaster AND CompanyMaster).
 */
const issueInvoiceForOrder = async (order, { companySettingsData, companyMasterData, websiteMasterData }) => {
    try {
        const vendorId = order.vendorId;

        const featureCheck = await isInvoiceFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) return featureCheck;

        const existing = await Invoice.findOne({ vendorId, orderId: order._id });
        if (existing) return common.returnResult(true, 200, 'Invoice already issued', { invoice: existing });

        if (order.cancelledAt) {
            return common.returnResult(false, 409, 'This order was cancelled, so no invoice can be issued for it.');
        }

        if (!order.items || order.items.length === 0) {
            // Orders from before line items were stored have nothing to invoice.
            return common.returnResult(false, 409, 'An invoice is not available for this order.');
        }

        const issuedAt = new Date();
        const year = issuedAt.getFullYear();
        const seller = await buildSeller(companySettingsData);
        const { buyer, placeOfSupply, lines, totals, taxSummary, taxLabel, amountInWords: totalInWords, taxAmountInWords } =
            await buildOrderDerivedInvoiceFields(order, { seller, companySettingsData });

        const sequence = await counterService.getNextSequenceValue(vendorId, `invoiceNumber:${year}`);
        const prefix = (companySettingsData?.invoicePrefix || DEFAULT_INVOICE_PREFIX).toUpperCase();

        try {
            const invoice = await Invoice.create({
                vendorId,
                orderId: order._id,
                orderNumber: order.orderNumber,
                orderPlacedAt: order.orderPlacedAt || order.createdAt || null,
                invoiceNumber: `${prefix}${String(year).slice(-2)}/${sequence}`,
                sequence,
                year,
                issuedAt,
                isTaxInvoice: !!seller.trn,
                taxLabel,
                seller,
                bank: buildBank(companySettingsData),
                declaration: companySettingsData?.invoiceDeclaration || null,
                buyer,
                placeOfSupply,
                currencyCode: order.currencyCode,
                currencyDecimalPlaces: order.currencyDecimalPlaces ?? 2,
                lines,
                totals,
                taxSummary,
                amountInWords: totalInWords,
                taxAmountInWords
            });
            logger.logInfo(1, 0, 'Invoice issued', { vendorId, orderId: order._id, invoiceNumber: invoice.invoiceNumber });
            return common.returnResult(true, 201, 'Invoice issued', { invoice });
        } catch (err) {
            // Two requests raced to invoice the same order - the unique {vendorId, orderId} index
            // let only one through; hand back the winner. (The loser's counter value is skipped.)
            if (err.code === 11000) {
                const winner = await Invoice.findOne({ vendorId, orderId: order._id });
                if (winner) return common.returnResult(true, 200, 'Invoice already issued', { invoice: winner });
            }
            throw err;
        }
    } catch (err) {
        throw err;
    }
};

/**
 * Emails the customer their invoice PDF (attachment) when the vendor has switched
 * CompanySettings.emailInvoiceOnOrderPlaced on. Everything the email service already enforces
 * applies (email feature on, attachments allowed for the vendor, "pdf" an allowed extension,
 * size limit); a refusal is only logged. Returns null when nothing was attempted.
 */
const emailInvoiceToCustomer = async (order, invoice, { companySettingsData, companyMasterData, websiteMasterData }) => {
    try {
        if (companySettingsData?.emailInvoiceOnOrderPlaced !== true) return null;

        const user = order.isWalkInCustomer || !order.userId ? null : await User.findById(order.userId).select('email').lean();
        const to = order.isWalkInCustomer ? order.walkInCustomer?.email : user?.email;
        if (!to) {
            logger.logInfo(0, 1, 'Invoice email skipped - the customer has no email address', { orderId: order._id });
            return null;
        }

        const buffer = await invoicePdfService.renderInvoicePdf(invoice, { copies: companySettingsData.invoicePrintDuplicateCopy === true ? 2 : 1 });
        const decimals = invoice.currencyDecimalPlaces ?? 2;
        const amount = `${invoice.currencyCode} ${invoice.totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
        const sellerName = invoice.seller.name || 'our store';
        const kind = invoice.isTaxInvoice ? 'tax invoice' : 'invoice';
        const greeting = `Hello ${invoice.buyer.contactPerson || invoice.buyer.name || ''}`.trim();
        const safeNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '-');

        const text = `${greeting},\n\nThank you for your order ${order.orderNumber}. Your ${kind} ${invoice.invoiceNumber} for ${amount} is attached to this email as a PDF.\n\nRegards,\n${sellerName}`;
        const html = `<p>${greeting},</p><p>Thank you for your order ${order.orderNumber}. Your ${kind} ${invoice.invoiceNumber} for ${amount} is attached to this email as a PDF.</p><p>Regards,<br>${sellerName}</p>`;

        const result = await emailService.sendEmail({
            vendorId: order.vendorId,
            module: EMAIL_MODULES.ORDER,
            to,
            subject: `Your ${kind} ${invoice.invoiceNumber} for order ${order.orderNumber}`,
            text,
            html,
            attachments: [{ filename: `Invoice-${safeNumber}.pdf`, content: buffer, mimeType: 'application/pdf', size: buffer.length }],
            userId: order.userId || order.placedByAdminId || undefined,
            companyMasterData,
            websiteMasterData,
            companySettingsData,
            // Built-in wording (no vendor template), so the template content rules don't apply.
            isDefaultTemplate: true
        });
        if (!result.isSuccess) {
            logger.logInfo(0, 1, 'Invoice email was not sent', { orderId: order._id, reason: result.message });
        }
        return result;
    } catch (err) {
        throw err;
    }
};

/**
 * Same as issueInvoiceForOrder but never throws - for the moment an order is placed, where a
 * problem with the invoice must not fail (or hide) an order that was already saved. If it
 * fails here, the invoice is simply issued on the first download instead. A newly issued
 * invoice is then emailed to the customer in the background (if the vendor turned that on), so
 * a slow mail server never delays the order confirmation.
 */
const tryIssueInvoiceForOrder = async (order, context) => {
    let issued = null;
    try {
        issued = await issueInvoiceForOrder(order, context);
    } catch (err) {
        logger.logWarning('invoiceService: could not issue invoice while placing order', { orderId: order._id, error: err });
        return null;
    }

    if (issued.isSuccess && issued.statusCode === 201) {
        emailInvoiceToCustomer(order, issued.meta.invoice, context).catch((err) => {
            logger.logWarning('invoiceService: invoice email failed', { orderId: order._id, error: err });
        });
    }
    return issued;
};

/**
 * Voids the order's invoice and raises a full credit note against it - called when an order is
 * cancelled or rejected. Nothing to do if the order never got an invoice, or it is already void.
 * Deliberately NOT behind the feature flag: an invoice that exists must be corrected even if the
 * PDF feature was switched off afterwards.
 */
const voidInvoiceForOrder = async (order, reason) => {
    try {
        const invoice = await Invoice.findOne({ vendorId: order.vendorId, orderId: order._id });
        if (!invoice || invoice.status === 'VOID') {
            return common.returnResult(true, 200, 'No invoice to void');
        }

        const now = new Date();
        const year = now.getFullYear();
        const sequence = await counterService.getNextSequenceValue(order.vendorId, `creditNoteNumber:${year}`);

        // Only flips an ISSUED invoice, so two racing cancellations can't both raise a credit note.
        const voided = await Invoice.findOneAndUpdate(
            { _id: invoice._id, status: 'ISSUED' },
            {
                $set: {
                    status: 'VOID',
                    voidedAt: now,
                    voidReason: reason || 'Order cancelled',
                    creditNote: { number: `${CREDIT_NOTE_PREFIX}${String(year).slice(-2)}/${sequence}`, sequence, year, issuedAt: now }
                }
            },
            { new: true }
        );
        if (voided) {
            logger.logInfo(1, 0, 'Invoice voided and credit note issued', { orderId: order._id, invoiceNumber: voided.invoiceNumber, creditNote: voided.creditNote.number });
        }
        return common.returnResult(true, 200, 'Invoice voided', { invoice: voided || invoice });
    } catch (err) {
        throw err;
    }
};

/** Never throws - a cancellation must not fail because of a problem with the invoice. */
const tryVoidInvoiceForOrder = (order, reason) =>
    voidInvoiceForOrder(order, reason).catch((err) => {
        logger.logWarning('invoiceService: could not void invoice for cancelled order', { orderId: order._id, error: err });
        return null;
    });

/**
 * Brings an order's ISSUED invoice back in line with the order after the order was edited
 * (products added, shipping price set/changed, delivery address changed). Invoices are issued when
 * the order is placed, and those edits are only allowed while the order is unpaid and open, so the
 * invoice is updated in place: same number, bumped `revision`. Without this the customer would
 * download (and a later credit note would reverse) figures from before the edit.
 * Only the order-derived fields change; the seller details stay as they were when it was issued.
 * Not behind the feature flag, for the same reason as voiding: an invoice that exists must stay correct.
 * Nothing to do if there is no invoice, it is void, or the order was cancelled.
 * @param {Object} [context]
 * @param {Object} [context.companySettingsData] - loaded from the DB when the caller has none to hand
 */
const refreshInvoiceForOrder = async (order, { companySettingsData } = {}) => {
    try {
        const { vendorId } = order;
        const invoice = await Invoice.findOne({ vendorId, orderId: order._id });
        if (!invoice || invoice.status !== 'ISSUED' || order.cancelledAt || !order.items || order.items.length === 0) {
            return common.returnResult(true, 200, 'No invoice to refresh');
        }

        const settings = companySettingsData || await CompanySettings.findOne({ vendorId }).lean();
        const fields = await buildOrderDerivedInvoiceFields(order, { seller: invoice.seller, companySettingsData: settings });

        // Only touches an ISSUED invoice, so a cancellation that voided it meanwhile is never overwritten.
        const refreshed = await Invoice.findOneAndUpdate(
            { _id: invoice._id, status: 'ISSUED' },
            { $set: { ...fields, lastRevisedAt: new Date() }, $inc: { revision: 1 } },
            { returnDocument: 'after' }
        );
        if (!refreshed) {
            return common.returnResult(true, 200, 'No invoice to refresh');
        }

        logger.logInfo(1, 0, 'Invoice refreshed after order edit', { vendorId, orderId: order._id, invoiceNumber: refreshed.invoiceNumber, revision: refreshed.revision });
        return common.returnResult(true, 200, 'Invoice refreshed', { invoice: refreshed });
    } catch (err) {
        throw err;
    }
};

/** Never throws - an order edit must not fail because of a problem with the invoice. */
const tryRefreshInvoiceForOrder = (order, context) =>
    refreshInvoiceForOrder(order, context).catch((err) => {
        logger.logWarning('invoiceService: could not refresh invoice after order edit', { orderId: order._id, error: err });
        return null;
    });

/** What the order screens need to know: is there an invoice, what number, is it void, is there a credit note. */
const getInvoiceSummaryForOrder = async (vendorId, orderId) => {
    try {
        const invoice = await Invoice.findOne({ vendorId, orderId }).select('invoiceNumber status creditNote').lean();
        if (!invoice) return null;
        return { invoiceNumber: invoice.invoiceNumber, status: invoice.status, creditNoteNumber: invoice.creditNote?.number || null };
    } catch (err) {
        throw err;
    }
};

/**
 * The PDF for one order: the invoice (issued first if it doesn't exist yet - older orders, or the
 * feature was off when the order was placed) or, with document 'credit-note', the credit note of a
 * cancelled order.
 * @param {string|null} userId - set for a customer download: they may only get their own orders' documents
 * @param {{ document?: 'invoice'|'credit-note' }} [options]
 */
const getInvoicePdfForOrder = async (vendorId, orderId, userId, context, { document = 'invoice' } = {}) => {
    try {
        const featureCheck = await isInvoiceFeatureOn(vendorId, context.websiteMasterData, context.companyMasterData);
        if (!featureCheck.isSuccess) return featureCheck;

        const orderFilter = { _id: orderId, vendorId, status: { $ne: 'D' } };
        if (userId) orderFilter.userId = userId;
        const order = await Order.findOne(orderFilter);
        if (!order) return common.returnResult(false, 404, 'Order not found.');

        const copies = context.companySettingsData?.invoicePrintDuplicateCopy === true ? 2 : 1;

        if (document === 'credit-note') {
            const invoice = await Invoice.findOne({ vendorId, orderId: order._id });
            if (!invoice || !invoice.creditNote?.number) {
                return common.returnResult(false, 404, 'There is no credit note for this order.');
            }
            const buffer = await invoicePdfService.renderInvoicePdf(invoice, { document: 'credit-note', copies });
            const safeNumber = invoice.creditNote.number.replace(/[^A-Za-z0-9._-]/g, '-');
            return common.returnResult(true, 200, 'Credit note generated', { buffer, filename: `CreditNote-${safeNumber}.pdf` });
        }

        const issued = await issueInvoiceForOrder(order, context);
        if (!issued.isSuccess) return issued;

        const { invoice } = issued.meta;
        const buffer = await invoicePdfService.renderInvoicePdf(invoice, { copies });
        const safeNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '-');
        return common.returnResult(true, 200, 'Invoice generated', { buffer, filename: `Invoice-${safeNumber}.pdf` });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    issueInvoiceForOrder,
    tryIssueInvoiceForOrder,
    emailInvoiceToCustomer,
    voidInvoiceForOrder,
    tryVoidInvoiceForOrder,
    refreshInvoiceForOrder,
    tryRefreshInvoiceForOrder,
    getInvoiceSummaryForOrder,
    getInvoicePdfForOrder,
    // Exposed for unit tests only.
    _internal: { buildLinesAndTotals }
};
