const paymentGatewayConfig = require('../../../config/paymentGatewayConfig');

const defaults = paymentGatewayConfig.paytabs;

// PayTabs' documented Hosted Payment Page endpoints. Built against public
// PayTabs API docs without live credentials (scaffolded per project owner's
// instruction) - verify field names/response shape against the actual
// PayTabs account/region before going live.
const REQUEST_PATH = '/payment/request';
const QUERY_PATH = '/payment/query';

// Every call takes `credentials` - a specific VENDOR's own profileId/
// serverKey/clientKey/baseUrl (paymentService resolves which vendor before
// calling in). Each vendor has their own separate PayTabs merchant account
// (linked to their own bank account on PayTabs' side), so there's no
// platform-wide credential set and no split/marketplace logic here - every
// order already belongs to exactly one vendor.

// Creates a PayTabs Hosted Payment Page session for one PaymentTransaction
// attempt, under the given vendor's own PayTabs account. Returns a redirect
// URL the customer's browser is sent to.
const createSession = async ({ order, transaction, returnUrl, callbackUrl, credentials }) => {
    try {
        const body = {
            profile_id: credentials.profileId,
            tran_type: 'sale',
            tran_class: 'ecom',
            cart_id: transaction.gatewayReferenceId,
            cart_currency: transaction.currencyCode,
            cart_amount: transaction.amount,
            cart_description: `Order ${order.orderNumber}`,
            paypage_lang: 'en',
            customer_details: {
                name: order.shippingAddressSnapshot?.addressName || 'Customer',
                email: undefined,
                street1: order.shippingAddressSnapshot?.building,
                city: order.shippingAddressSnapshot?.cityName,
                state: order.shippingAddressSnapshot?.stateName,
                country: order.shippingAddressSnapshot?.countryName,
                zip: order.shippingAddressSnapshot?.pincode
            },
            hide_shipping: true,
            return: returnUrl,
            callback: callbackUrl
        };

        const baseUrl = credentials.baseUrl || defaults.defaultBaseUrl;

        const response = await fetch(`${baseUrl}${REQUEST_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': credentials.serverKey
            },
            body: JSON.stringify(body)
        });

        const raw = await response.json();

        if (!response.ok || !raw.redirect_url) {
            return {
                isSuccess: false,
                message: raw?.message || 'PayTabs did not return a payment session.',
                raw
            };
        }

        return {
            isSuccess: true,
            redirectUrl: raw.redirect_url,
            gatewayTransactionRef: raw.tran_ref || null,
            raw
        };
    } catch (err) {
        throw err;
    }
};

// Server-to-server confirmation of what actually happened for a transaction,
// under the given vendor's own PayTabs account - PayTabs' recommended
// practice is to never trust the IPN/return payload alone, always re-query
// using the server key before marking an order paid. `order` is accepted
// for interface parity with other providers (e.g. Stripe needs it to
// convert a smallest-currency-unit amount back to decimal) but unused here -
// PayTabs already returns cart_amount as a plain decimal.
const verifyTransaction = async ({ tranRef, cartId, credentials }) => {
    try {
        const body = {
            profile_id: credentials.profileId,
            tran_ref: tranRef || undefined,
            cart_id: tranRef ? undefined : cartId
        };

        const baseUrl = credentials.baseUrl || defaults.defaultBaseUrl;

        const response = await fetch(`${baseUrl}${QUERY_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': credentials.serverKey
            },
            body: JSON.stringify(body)
        });

        const raw = await response.json();

        if (!response.ok) {
            return { isSuccess: false, isPaid: false, message: raw?.message || 'PayTabs query failed.', raw };
        }

        // PayTabs response_status: 'A' = Authorised/Captured (success), others = declined/pending/error.
        const isPaid = raw?.payment_result?.response_status === 'A';

        return {
            isSuccess: true,
            isPaid,
            transactionRef: raw?.tran_ref || tranRef || null,
            amount: raw?.cart_amount,
            currencyCode: raw?.cart_currency,
            statusMessage: raw?.payment_result?.response_message,
            raw
        };
    } catch (err) {
        throw err;
    }
};

// Pulls the fields we need to look up our own PaymentTransaction out of a
// PayTabs callback (IPN) or return-redirect payload - both carry the same
// cart_id/tran_ref pair.
const extractReference = (payload) => {
    return {
        cartId: payload?.cart_id || null,
        tranRef: payload?.tran_ref || null
    };
};

module.exports = {
    createSession,
    verifyTransaction,
    extractReference
};
