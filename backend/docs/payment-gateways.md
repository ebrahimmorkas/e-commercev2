# Payment Gateways

## Architecture

Every vendor runs their own independent storefront on their own domain
(`vendorDetection` resolves the vendor from the request's hostname). An order
always belongs to exactly one vendor - there is no cart/order that spans
multiple vendors, so there is **no split-payment/marketplace logic anywhere**
in this integration. Each vendor:

1. Signs up for their own account directly with the gateway (PayTabs or
   Stripe), linking their own bank account on the gateway's side.
2. Hands their own API credentials to the platform owner.
3. Has those credentials stored, encrypted, in `VendorPaymentGatewayCredentials`.

When a customer pays on `vendor-b.com`, the code looks up **Vendor B's own**
credentials and calls the gateway as Vendor B - so the money lands in Vendor
B's own account. The platform never holds a shared/central merchant account.

## Supported gateways

| Gateway | Key        | Checkout style              | Adapter file                                              |
|---------|------------|------------------------------|-------------------------------------------------------------|
| PayTabs | `paytabs`  | Hosted Payment Page (redirect) | `services/providers/payment/paytabsProvider.js` |
| Stripe  | `stripe`   | Checkout Sessions (redirect)   | `services/providers/payment/stripeProvider.js`  |

Adding a new gateway: add its key to `constants/paymentGatewayConstants.js`
(`PAYMENT_GATEWAYS`), write an adapter implementing the same interface
(`createSession`, `verifyTransaction`, `extractReference` - see either
existing adapter), and register it in
`services/providers/payment/paymentProviderFactory.js`. Nothing else needs to
change - every model/enum/route that touches a gateway key derives from
`VALID_PAYMENT_GATEWAYS`.

**Confidence note:** PayTabs' Hosted Payment Page API and Stripe's Checkout
Sessions API are both built against their real public documentation. Verify
against your own account/region before relying on either in production - in
particular PayTabs' base URL differs by region.

## Environment variables

See `.env.example`. Only two are relevant to payment gateways:

- `CREDENTIALS_ENCRYPTION_KEY` - 64 hex chars (32 bytes). Encrypts every
  vendor's server key/secret key at rest (`encryptSecret`/`decryptSecret` in
  `utils/common.js`, AES-256-GCM). **Set this before storing any real vendor
  credentials** - if it's unset, a random key is generated per process
  start and every previously-saved credential becomes undecryptable on
  restart/redeploy.
- `PAYTABS_BASE_URL` - fallback API host used only when a vendor's own
  credential record doesn't specify its own `baseUrl`.

Stripe needs no environment variables - it has one fixed API host
(`https://api.stripe.com`) and every vendor's keys live in the database, not
in `.env`.

## Onboarding a vendor

No HTTP endpoint exists for this (same convention as `WebsiteMaster`/
`CompanyMaster` having no write API) - it's a platform-owner-only action via
`scripts/manageVendorPaymentGatewayCredentials.js`.

```bash
# PayTabs - needs profileId + serverKey
node scripts/manageVendorPaymentGatewayCredentials.js set <vendorId> paytabs \
  --profileId=PT123456 --serverKey=xxxxxxxx --clientKey=yyyyyyyy

# Stripe - only needs serverKey (secret key); clientKey (publishable key) is optional
node scripts/manageVendorPaymentGatewayCredentials.js set <vendorId> stripe \
  --serverKey=sk_live_xxx --clientKey=pk_live_xxx

# Once you've personally confirmed a real test payment works for that vendor:
node scripts/manageVendorPaymentGatewayCredentials.js activate <vendorId> paytabs
node scripts/manageVendorPaymentGatewayCredentials.js activate <vendorId> stripe

# Inspect what's saved (never prints the actual secret, only whether one is set):
node scripts/manageVendorPaymentGatewayCredentials.js view <vendorId> stripe
```

`gateway` defaults to `paytabs` if omitted. Credentials stay `isActive: false`
(refused by `paymentService.initiateOnlinePayment`) until explicitly
activated - re-saving a vendor's credentials resets `isActive` back to
`false`, since changed credentials haven't been reconfirmed working yet.

### Stripe-specific: webhook setup

Stripe requires each vendor to register their own webhook endpoint in
**their own** Stripe Dashboard (Developers → Webhooks), pointing at:

```
https://<vendor-domain>/api/payments/callback/stripe
```

This is a one-time manual step per vendor on Stripe's side - there is no API
call in this codebase that registers it for them.

### PayTabs-specific

The callback URL is passed automatically on every `initiate` call
(`https://<vendor-domain>/api/payments/callback/paytabs`) - no per-vendor
dashboard setup needed on PayTabs' side.

## The three-layer feature gate

Same AND-of-three-layers pattern used everywhere else in this codebase:

1. `WebsiteMaster.isPaymentGatewayFeatureOn` / `isCODFeatureOn` - global
   platform kill switch (you).
2. `CompanyMaster.isPaymentGatewayFeatureOn` / `isCODFeatureOn` /
   `paymentGateway` - per-vendor entitlement + which gateway they're
   assigned (you, admin-only, no write API - mirrors `emailService`).
3. `CompanySettings.isPaymentGatewayFeatureOn` - the **vendor's own** on/off
   switch for online payment at checkout (e.g. their subscription with you
   lapsed and they want to hide the option themselves). Editable by the
   vendor through the existing `PUT /api/company-settings/update-company-settings`
   endpoint. Does not affect COD.

`WebsiteMaster.mainPaymentGateway`, when non-null, force-overrides every
vendor's own `CompanyMaster.paymentGateway` selection (same convention as
`mainEmailService`).

## Checkout flow (`/api/payments`)

| Method | Path                     | Who        | What |
|--------|--------------------------|------------|------|
| POST   | `/:orderId/initiate`     | customer   | Creates a hosted checkout session, returns `redirectUrl` |
| POST   | `/:orderId/cod`          | customer   | Marks the order for Cash on Delivery instead |
| GET    | `/:orderId/status`       | customer   | Polls current payment status (useful right after the gateway redirect, since the webhook may land slightly later) |
| POST   | `/callback/:gateway`     | gateway    | Webhook/IPN - never trusts the payload alone, always re-queries the gateway server-to-server before marking an order paid |

## Commission ledger (related, not gateway-specific)

If `CompanyMaster.isCommissionFeatureOn` is on for a vendor, every order
placed (regardless of payment method) generates a `CommissionLedgerEntry` -
bookkeeping only, does not move money. See `services/commissionService.js`
and `scripts/manageCommissionLedger.js`.

## Known gaps / not yet built

- No refund integration (`OrderReturn`/`OrderExchange` approval doesn't call
  either gateway's refund API yet).
- No "mark COD order as paid" endpoint - COD orders stay `payment.status:
  PENDING` indefinitely in this codebase.
- PayTabs Marketplace/split payments were deliberately NOT used (see
  Architecture above) - if you ever need true split payments across
  multiple recipients in one transaction, that's a different, more involved
  integration than what's built here.
