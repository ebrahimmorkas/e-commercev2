const paymentGatewayConfig = require('../../../config/paymentGatewayConfig');

const defaults = paymentGatewayConfig.stripe;

// Stripe's Checkout Sessions API - public, stable, well-documented (unlike
// PayTabs Marketplace elsewhere in this codebase, this one's contract is
// verified against Stripe's actual docs, not guessed).
const SESSIONS_PATH = '/v1/checkout/sessions';

// Every call takes `credentials` - a specific VENDOR's own Stripe secret/
// publishable key (paymentService resolves which vendor before calling in).
// Each vendor has their own separate Stripe account, same as PayTabs - no
// Stripe Connect/split logic here, every order already belongs to exactly
// one vendor.

// Stripe's API takes application/x-www-form-urlencoded bodies with bracket
// notation for nested objects/arrays (e.g. line_items[0][quantity]=1) - no
// JSON. This flattens a plain JS object/array into that shape.
const flattenForm = (value, prefix, pairs) => {
    if (value === undefined || value === null) {
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => flattenForm(item, `${prefix}[${index}]`, pairs));
    } else if (typeof value === 'object' && !(value instanceof Date)) {
        for (const [key, nested] of Object.entries(value)) {
            flattenForm(nested, prefix ? `${prefix}[${key}]` : key, pairs);
        }
    } else {
        pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
    }
};

const toFormBody = (obj) => {
    const pairs = [];
    flattenForm(obj, '', pairs);
    return pairs.join('&');
};

// Stripe amounts are always integers in the currency's smallest unit (cents
// for AED/USD/etc). This project doesn't currently distinguish zero-decimal
// currencies (e.g. JPY) - it uses order.currencyDecimalPlaces (the same
// snapshot Order already carries) for the conversion either direction,
// which is correct for every currency this project's CurrencyMaster is
// actually configured with 2 decimal places for.
const toSmallestUnit = (amount, decimalPlaces) => Math.round(amount * (10 ** decimalPlaces));
const fromSmallestUnit = (amount, decimalPlaces) => amount / (10 ** decimalPlaces);

// Creates a Stripe Checkout Session for one PaymentTransaction attempt,
// under the given vendor's own Stripe account. Returns a redirect URL the
// customer's browser is sent to.
const createSession = async ({ order, transaction, returnUrl, callbackUrl, credentials }) => {
    try {
        // Stripe wants separate success/cancel URLs where PayTabs takes one
        // "return" URL - both point at the same frontend result page here,
        // with Stripe's session id templated onto the success case so the
        // frontend/status endpoint can reference it immediately.
        const body = {
            mode: 'payment',
            client_reference_id: transaction.gatewayReferenceId,
            success_url: `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}&status=cancelled`,
            line_items: [{
                price_data: {
                    currency: transaction.currencyCode.toLowerCase(),
                    product_data: {
                        name: `Order ${order.orderNumber}`
                    },
                    unit_amount: toSmallestUnit(transaction.amount, order.currencyDecimalPlaces)
                },
                quantity: 1
            }]
        };

        const baseUrl = credentials.baseUrl || defaults.defaultBaseUrl;

        const response = await fetch(`${baseUrl}${SESSIONS_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${credentials.serverKey}`
            },
            body: toFormBody(body)
        });

        const raw = await response.json();

        if (!response.ok || !raw.url) {
            return {
                isSuccess: false,
                message: raw?.error?.message || 'Stripe did not return a checkout session.',
                raw
            };
        }

        return {
            isSuccess: true,
            redirectUrl: raw.url,
            gatewayTransactionRef: raw.id || null,
            raw
        };
    } catch (err) {
        throw err;
    }
};

// Server-to-server confirmation of what actually happened for a transaction,
// under the given vendor's own Stripe account - re-fetches the Checkout
// Session by id (never trusts the webhook payload's own fields alone),
// mirroring the same verification stance as paytabsProvider.js. `order` is
// required here (unlike PayTabs) to convert Stripe's smallest-currency-unit
// amount_total back to a plain decimal comparable to transaction.amount.
const verifyTransaction = async ({ tranRef, credentials, order }) => {
    try {
        if (!tranRef) {
            return { isSuccess: false, isPaid: false, message: 'Missing Stripe checkout session id.' };
        }

        const baseUrl = credentials.baseUrl || defaults.defaultBaseUrl;

        const response = await fetch(`${baseUrl}${SESSIONS_PATH}/${encodeURIComponent(tranRef)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.serverKey}`
            }
        });

        const raw = await response.json();

        if (!response.ok) {
            return { isSuccess: false, isPaid: false, message: raw?.error?.message || 'Stripe query failed.', raw };
        }

        const isPaid = raw.payment_status === 'paid';
        const decimalPlaces = order?.currencyDecimalPlaces ?? 2;

        return {
            isSuccess: true,
            isPaid,
            transactionRef: raw.id || tranRef,
            amount: raw.amount_total != null ? fromSmallestUnit(raw.amount_total, decimalPlaces) : undefined,
            currencyCode: raw.currency ? raw.currency.toUpperCase() : undefined,
            statusMessage: raw.payment_status,
            raw
        };
    } catch (err) {
        throw err;
    }
};

// Only checkout-session-related event types carry the client_reference_id/
// session id this app needs - every other Stripe event type (a vendor's
// dashboard may be set to send all events) is ignored here, which
// paymentService surfaces as a harmless "missing cart reference" no-op.
const RELEVANT_EVENT_TYPES = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired'
];

// Pulls the fields we need to look up our own PaymentTransaction out of a
// Stripe webhook event payload.
const extractReference = (payload) => {
    if (!RELEVANT_EVENT_TYPES.includes(payload?.type)) {
        return { cartId: null, tranRef: null };
    }
    const sessionObject = payload?.data?.object;
    return {
        cartId: sessionObject?.client_reference_id || null,
        tranRef: sessionObject?.id || null
    };
};

module.exports = {
    createSession,
    verifyTransaction,
    extractReference
};
