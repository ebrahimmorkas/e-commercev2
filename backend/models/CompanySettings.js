const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },
  // The vendor's own base/fallback currency - shown to guests and to any
  // logged-in user whose own country has no CurrencyMaster configured.
  // A logged-in user's own country's currency takes precedence over this
  // when resolving what to charge/display (see resolveOrderCurrency in
  // orderService.js).
  currencyId: {
    type: mongoose.Types.ObjectId,
    ref: 'CurrencyMaster',
    default: null
  },
  // The vendor's own country/state/city (admin Company Settings > General,
  // dropdowns off CompanyMaster.allowedCountries). Used as the tax location
  // whenever the delivery location is unknown: walk-in orders, admin orders
  // with a typed-in address, and storefront estimates for a guest with no
  // location (services/taxCalculationService.js). When the country is null
  // those orders get no tax at all.
  storeCountryId: {
    type: mongoose.Types.ObjectId,
    ref: 'CountryMaster',
    default: null
  },
  storeStateId: {
    type: mongoose.Types.ObjectId,
    ref: 'StateMaster',
    default: null
  },
  storeCityId: {
    type: mongoose.Types.ObjectId,
    ref: 'CityMaster',
    default: null
  },
  // Personal Information
  adminName: {
    type: String,
    required: [true, 'Admin name is required'],
    trim: true
  },
  adminWhatsappNumber: {
    type: String,
    trim: true
  },
  adminPhoneNumber: {
    type: String,
    trim: true
  },
  adminAddress: {
    type: String,
    trim: true
  },
  adminCity: {
    type: String,
    trim: true
  },
  adminState: {
    type: String,
    trim: true
  },
  adminPincode: {
    type: String,
    trim: true
  },
  adminEmail: {
    type: String,
    required: [true, 'Admin email is required'],
    trim: true,
    lowercase: true
  },
  companyName: {
    type: String,
    trim: true,
    default: ''
  },
  companyLogo: {
    url: {
      type: String,
      default: null
    },
    imageAssetId: {
      type: mongoose.Types.ObjectId,
      ref: 'ImageAsset',
      default: null
    }
  },
  instagramId: {
    type: String,
    trim: true
  },
  facebookId: {
    type: String,
    trim: true
  },
  paymentScanner: {
    url: {
      type: String,
      default: null
    },
    imageAssetId: {
      type: mongoose.Types.ObjectId,
      ref: 'ImageAsset',
      default: null
    }
  },

  // Start of Bank Transfer
  // Gated together with paymentScanner above by
  // CompanyMaster.showPaymentQRCodeAndBankDetails (+
  // WebsiteMaster.isShowingPaymentQRCodeAndBankDetailsFeatureOn) - see
  // companySettingsService.js.
  bankAccountHolderName: {
    type: String,
    trim: true,
    default: null
  },
  bankName: {
    type: String,
    trim: true,
    default: null
  },
  bankAccountNumber: {
    type: String,
    trim: true,
    default: null
  },
  ifscCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  branchName: {
    type: String,
    trim: true,
    default: null
  },
  swiftCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  bankAccountType: {
    type: String,
    enum: ['SAVINGS', 'CURRENT'],
    default: null
  },
  // GPay / UPI-style number customers can pay to - gated on its own by
  // CompanyMaster.showGpayNumber (+ WebsiteMaster.isShowingGpayNumberFeatureOn).
  gpayNumber: {
    type: String,
    trim: true,
    default: null
  },
  // End of Bank Transfer

  // Gated by CompanyMaster.isShowingPartnerCertificateFeatureOn (+
  // WebsiteMaster.isShowingPartnerCertificateFeatureOn) - see
  // companySettingsService.js.
  partnerCertificate: {
    url: {
      type: String,
      default: null
    },
    imageAssetId: {
      type: mongoose.Types.ObjectId,
      ref: 'ImageAsset',
      default: null
    }
  },

  // The vendor's downloadable catalogue (PDF), shown as a storefront navbar
  // icon. Gated by CompanyMaster.isCatalogueDownloadFeatureOn (vendor-level only;
  // no WebsiteMaster switch). Stored via fileUploadService as a FileAsset.
  catalogue: {
    fileAssetId: {
      type: mongoose.Types.ObjectId,
      ref: 'FileAsset',
      default: null
    },
    originalName: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: null
    },
    uploadedAt: {
      type: Date,
      default: null
    }
  },

  // Policies (stored as HTML from React Quill)
  privacyPolicy: {
    type: String,
    default: ''
  },
  cancelPolicy: {
    type: String,
    default: ''
  },
  termsAndConditions: {
    type: String,
    default: ''
  },
  aboutUs: {
    type: String,
    default: ''
  },
  returnRefundPolicy: {
    type: String,
    default: ''
  },
  // How the storefront shows a policy's content when a customer clicks it -
  // the vendor's own choice, read by the client Footer (client/features/
  // companySettings). 'PAGE' navigates to a dedicated URL (e.g.
  // /privacy-policy); 'MODAL' opens it in a popup on the current page.
  policyDisplayMode: {
    type: String,
    enum: ['PAGE', 'MODAL'],
    default: 'PAGE'
  },

  // Start of Storefront Contact Us
  // Deliberately separate from adminEmail/adminPhoneNumber/adminAddress
  // above - those are the admin's own contact details, used internally for
  // order/system notifications, and are NOT meant to be public. These are
  // what the storefront footer's Contact Us section shows customers -
  // independent values the vendor fills in on purpose for public display.
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  contactPhoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  contactAddress: {
    type: String,
    trim: true,
    default: ''
  },
  // End of Storefront Contact Us

  createdBy: {
    userID: mongoose.Types.ObjectId,
    vendorID: mongoose.Types.ObjectId,
  },
  updatedBy: {
    userID: mongoose.Types.ObjectId,
    vendorID: mongoose.Types.ObjectId,
  },

  // Start of Announcements
  showAnnouncements: {
    type: Boolean,
    default: true
  },
  isAnnouncementRotationOn: {
    type: Boolean,
    default: false
  },
  // End of Announcements

  // Start of Banner
  showBanners: {
    type: Boolean,
    default: false
  },
  isBannerRotationOn: {
    type: Boolean,
    default: false
  },
  // End of Banner

  // Start of Customer Signup
  // Vendor's own on/off choice: when true, the storefront register form shows an
  // optional "I am tax registered" checkbox that reveals Business Full Name + TRN
  // inputs. Off by default so existing vendors' signup is unchanged. Read by the
  // public GET /api/auth/registration-config and enforced in authController.register.
  isTaxRegistrationOnSignupEnabled: {
    type: Boolean,
    default: false
  },
  // End of Customer Signup

  // Start of Location
  // Vendor's own choice ("Make City Optional", Company Settings > General).
  // false (default) = a city is required wherever a location is entered:
  // customer signup, the admin's Add User / Edit Customer, a delivery agent's
  // location and a customer's delivery address. true = the city may be left
  // empty in all of those (country and state stay required). Enforced in
  // userLocationService / addressService, not at the schema level.
  isCityOptional: {
    type: Boolean,
    default: false
  },
  // End of Location

  // Start of Invoice (PDF tax invoice issued when an order is placed - see invoiceService.js)
  // The seller's own Tax Registration Number, printed in the invoice header. A vendor
  // without one gets a plain "INVOICE" instead of a "TAX INVOICE".
  taxRegistrationNumber: {
    type: String,
    trim: true,
    default: null
  },
  // Start of every invoice number, e.g. 'SI' -> SI26/1 (prefix + 2-digit year + / + running
  // number). Blank falls back to 'SI'.
  invoicePrefix: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 10,
    default: 'SI'
  },
  // Text printed above the signature line, e.g. "We declare that this invoice shows the
  // actual price of the goods described...". Blank = a sensible default.
  invoiceDeclaration: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },
  // Print two labelled copies ("Original" and "Duplicate") in the same PDF, like a Tally invoice.
  invoicePrintDuplicateCopy: {
    type: Boolean,
    default: false
  },
  // Round each invoice's grand total to a whole amount and show the difference as a "Round off"
  // row. Off = exact amount. NOTE: online payments still charge the exact order amount, so turn
  // this on only when payment is collected against the invoice total (cash / bank transfer).
  invoiceRoundOffToWhole: {
    type: Boolean,
    default: false
  },
  // Email the customer their invoice PDF (as an attachment) right after they place an order.
  // Needs the email feature + attachments allowed for the vendor (see emailService.js).
  emailInvoiceOnOrderPlaced: {
    type: Boolean,
    default: false
  },
  // End of Invoice

  // Start of product
  showReviewsToCustomers: {
      type: Boolean,
      default: true
  },
  isProductCodeAutoGenerated: {
    type: Boolean,
    default: true
  },
  isVariantCodeAutoGenerated: {
    type: Boolean,
    default: true
  },
  isSizeCodeAutoGenerated: {
    type: Boolean,
    default: true
  },
  shouldProductsBeHiddenWhenLocationsAreExcluded: {
    type: Boolean,
    default: true
  },
  // Vendor's own choice: when true, cloning a product carries over each
  // size's current stock value onto the clone. When false (default), every
  // cloned size starts at 0 stock - avoids double-counting one physical
  // batch of inventory across two product documents until the vendor
  // manually sets the clone's own stock. See cloneProduct in
  // productService.js.
  isStockCloningAllowed: {
    type: Boolean,
    default: false
  },
  // Low stock alert email to adminEmail. Only takes effect while
  // isReceivingLowStockAlertFeatureOn is on in WebsiteMaster AND CompanyMaster
  // - see services/lowStockAlertService.js.
  receiveLowStockAlert: {
    type: Boolean,
    default: false
  },
  // One threshold for every product size: the alert goes out when a size's
  // stock drops to this number or below (5 = emailed when stock becomes 5).
  // Also the Inventory module's low stock indicator while the alert is on.
  lowStockAlertThreshold: {
    type: Number,
    min: 0,
    default: null
  },
  // End of product

  // Start of Brand
  // When true, a size's resolved brand display is its brandShortName -
  // falling back to brandName whenever the selected brand has no short
  // name set (never surfaced as null/empty). When false, brandName is
  // always shown. See resolveBrandDisplayName in brandMasterService.js.
  useShortNameForBrand: {
    type: Boolean,
    default: false
  },
  // End of Brand

  // Stat of Cart
  allowOutOfStockProductsAdding: {
    type: Boolean,
    default: false
  },
  // End of Cart

  // Start of Return/Exchange
  // Only meaningful when isReturnFeatureOn/isExchangeFeatureOn (WebsiteMaster
  // + CompanyMaster) are both on for this vendor. When OFF, a customer can
  // only request a return/exchange for the whole order at once (auto-limited
  // to whichever items are still within their own product-level return/
  // exchange window - see orderReturnService/orderExchangeService).
  fewItemsReturnOnly: {
    type: Boolean,
    default: false
  },
  fewItemsExchangeOnly: {
    type: Boolean,
    default: false
  },
  // End of Return/Exchange

  // Start of Order
  isOrderCancellationAllowed: {
    type: Boolean,
    default: false
  },
  // The step codes below all refer to steps of the vendor's assigned
  // workflow (CompanyMaster.orderSteps -> OrderStepMaster.steps[].code);
  // companySettingsService checks that when they are saved. A code that is no
  // longer in the workflow (the platform assigned a different one) is ignored.
  //
  // Once an order's current step reaches this step, a customer can no longer
  // cancel it themselves. null = no cutoff - cancellable at any step before
  // the workflow's last step.
  orderCancellationNotAllowedAfterStep: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  // When an order reaches this step its payment is marked PAID. null = the
  // workflow's last step.
  markPaymentCompletedAtStep: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  // The one transition a delivery agent may make (from -> the step right
  // after it). Both or neither. Only usable while
  // CompanyMaster.isOrderStatusUpdationAllowedByDeliveryAgents is on; without
  // it, no delivery agent can be assigned to an order.
  deliveryAgentFromStep: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  deliveryAgentToStep: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  isOrderNumberAutoGenerated: {
    type: Boolean,
    default: true
  },
  // End of Order

  // Start of Email
  // "From" address used when sending email through emailService.js. Falls
  // back to adminEmail when unset - see sendEmail in emailService.js.
  senderEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  // Always cc'd/bcc'd in addition to whatever the calling module passes -
  // see sendEmail in emailService.js.
  ccList: {
    type: [String],
    default: []
  },
  bccList: {
    type: [String],
    default: []
  },
  // The vendor's own email account - every email of the vendor is sent
  // through it (there is no platform fallback: without it nothing is sent).
  // See services/emailProviders/vendorSmtpProvider.js. Saved only after the
  // server accepted the sign-in; the password is stored encrypted
  // (common.encryptSecret) and never returned by the API. Managed through its
  // own endpoints, never through create/update.
  emailAccount: {
    host: { type: String, trim: true, default: null },
    port: { type: Number, min: 1, max: 65535, default: null },
    // SSL (usually 465), STARTTLS (usually 587) or NONE.
    security: { type: String, enum: ['SSL', 'STARTTLS', 'NONE'], default: 'SSL' },
    username: { type: String, trim: true, default: null },
    encryptedPassword: { type: String, default: null },
    // The From address - the account's own address unless the server allows another.
    fromEmail: { type: String, trim: true, lowercase: true, default: null },
    fromName: { type: String, trim: true, maxlength: 100, default: null },
    verifiedAt: { type: Date, default: null }
  },
  // Whether the platform's DefaultEmailTemplateMaster is sent when the vendor
  // has no template assigned for a module (or, with step-wise order
  // templates on, no template for the Order module at all). false = send
  // nothing in that case. See resolveTemplateForModule.
  useDefaultEmailTemplate: {
    type: Boolean,
    default: true
  },
  // Files the vendor keeps ready to attach to emails (Company Settings >
  // Email). Uploading them here doesn't attach them to anything - whether an
  // email includes them is chosen per email/template (a later step).
  // Gated by isAddingOfAttachmentAllowed; count/size/extensions come from
  // CompanyMaster (numberOfAttachmentsAllowed, attachmentSizeAllowed,
  // allowedAttachmentExtensions). Added/removed through their own endpoints,
  // never through create/update.
  emailAttachments: {
    type: [{
      fileAssetId: { type: mongoose.Types.ObjectId, ref: 'FileAsset', required: true },
      url: { type: String, required: true },
      originalName: { type: String, trim: true },
      // The file name the customer sees; originalName when not given.
      displayName: { type: String, trim: true, maxlength: 150 },
      mimeType: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date, default: Date.now }
    }],
    default: []
  },
  // Images to show inside an email's body. Each has a short name (unique per
  // vendor) so a template can place it, e.g. {{image:logo}}. Gated by
  // isAddingOfImageAllowed; count/size/extensions from CompanyMaster
  // (numberOfImageAllowed, imageSizeAllowed, allowedImageExtensions).
  emailImages: {
    type: [{
      imageAssetId: { type: mongoose.Types.ObjectId, ref: 'ImageAsset', required: true },
      name: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
      url: { type: String, required: true },
      originalName: { type: String, trim: true },
      mimeType: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date, default: Date.now }
    }],
    default: []
  },
  // End of Email

  // Start of Discount and Free Cash emails (Company Settings > "Discount and
  // Free Cash" tab - see services/promotionEmailService.js).
  // TARGETED = only the customers a discount / Free Cash is given to (its
  // specific users or user groups); ALL = every active customer of the store
  // when it isn't user-targeted.
  discountEmailRecipients: {
    type: String,
    enum: ['TARGETED', 'ALL'],
    default: 'TARGETED'
  },
  // How many days before a discount's end date the "Discount Expiring Soon" email goes out.
  discountExpiryReminderDays: {
    type: Number,
    min: 1,
    max: 60,
    default: 3
  },
  freeCashEmailRecipients: {
    type: String,
    enum: ['TARGETED', 'ALL'],
    default: 'TARGETED'
  },
  // How many days before a Free Cash's end date the "Free Cash Expiring Soon" email goes out.
  freeCashExpiryReminderDays: {
    type: Number,
    min: 1,
    max: 60,
    default: 3
  },
  // End of Discount and Free Cash emails

  // Start of Email Template
  // Which of the vendor's EmailTemplateMaster templates each module sends.
  // At most one entry per template (enforced in emailTemplateMasterService,
  // not at the schema level).
  //   stepCodes empty     - "whole module" entry; at most one per module.
  //                         The only kind used while step-wise order
  //                         templates are off.
  //   stepCodes non-empty - Order module only: this template is sent for
  //                         these order step codes. Only used while
  //                         isDifferentEmailTemplatesForOrderStepsOn is on;
  //                         kept (but ignored) when it's turned off.
  // See resolveTemplateForModule for how these are consumed.
  emailTemplateAssignments: {
    type: [{
      module: { type: String, required: true, trim: true },
      templateId: { type: mongoose.Types.ObjectId, ref: 'EmailTemplateMaster', required: true },
      stepCodes: { type: [String], default: [] }
    }],
    default: []
  },
  // End of Email Template

  // Start of Payment
  // The vendor's own on/off switch for online payment at checkout - sits
  // BELOW WebsiteMaster.isPaymentGatewayFeatureOn + CompanyMaster.
  // isPaymentGatewayFeatureOn (the admin-level "has this vendor paid for/
  // been granted this feature" gate, checked in paymentController). This one
  // is the vendor's own choice - e.g. their gateway subscription lapsed and
  // they want to hide online payment and fall back to COD without waiting
  // on the platform admin. Same "show" toggle convention as
  // showAnnouncements/showBanners/showReviewsToCustomers above - checked in
  // paymentService.initiateOnlinePayment, not at the schema level.
  isPaymentGatewayFeatureOn: {
    type: Boolean,
    default: true
  },
  // The vendor's own on/off switch for Cash on Delivery - sits BELOW
  // WebsiteMaster.isCODFeatureOn + CompanyMaster.isCODFeatureOn. COD is offered
  // at checkout only when all three are on (see paymentService).
  isCODFeatureOn: {
    type: Boolean,
    default: true
  },
  // End of Payment

  // Start of Free Cash
  // The vendor's own show/hide toggle for Free Cash on the storefront - sits
  // BELOW WebsiteMaster.isFreeCashFeatureOn + CompanyMaster.isFreeCashFeatureOn
  // (the admin-level entitlement gate). Same dual-meaning naming convention as
  // isPaymentGatewayFeatureOn above.
  isFreeCashFeatureOn: {
    type: Boolean,
    default: false
  },
  // When true, a new Free Cash issued to a user does NOT expire any
  // still-active Free Cash already held by that user - all of them remain
  // usable/visible together. When false, issuing a new one immediately
  // expires every other active Free Cash that user already holds for this
  // vendor (isCashExpired set true on those UserFreeCash records), regardless
  // of which FreeCash campaign they came from.
  isFreeCashStackingAllowed: {
    type: Boolean,
    default: false
  },
  // Only meaningful when isFreeCashStackingAllowed is true - whether a
  // customer can apply more than one distinct UserFreeCash grant on the same
  // order at once.
  isMultipleFreeCashUsageAllowed: {
    type: Boolean,
    default: false
  },
  // When true, a UserFreeCash grant's leftover remainingAmount stays usable
  // across multiple separate orders (tracked via cashUsageHistory). When
  // false, the first time a grant is used at all, any leftover balance is
  // forfeited (remainingAmount zeroed, isCashUsed set true) instead of being
  // carried forward.
  isStoringRemainingFreeCashAmountAllowed: {
    type: Boolean,
    default: false
  },
  // Whether returning an order gives the Free Cash that was used on it back
  // to the user (as remainingAmount on the original UserFreeCash grant).
  // refundWholeFreeCashAmount / amountToRefund are only meaningful when
  // this is true.
  returnFreeCashOnOrderReturn: {
    type: Boolean,
    default: false
  },
  // true = refund 100% of the Free Cash amount that was used on the
  // returned order/items (amountToRefund is then not applicable). false =
  // refund only a partial percentage, given by amountToRefund. Only
  // meaningful when returnFreeCashOnOrderReturn is true.
  refundWholeFreeCashAmount: {
    type: Boolean,
    default: false
  },
  // Percentage (0-100) of the used Free Cash amount to refund on a return.
  // Only applicable when returnFreeCashOnOrderReturn is true AND
  // refundWholeFreeCashAmount is false - null otherwise.
  amountToRefund: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  // End of Free Cash

  // Start of Abandoned Cart
  // Minutes of inactivity (measured from the cart's lastProductAddedAt,
  // reset every time a product is added) after which an active cart is
  // flagged abandoned and reflected to the admin. See abandonedCartService.js.
  timeForAbondonedCartReflection: {
    type: Number,
    default: 30,
    min: 1
  },
  // When true, only logged-in users' abandoned carts are shown to the admin
  // (Pass 2 will also track guest carts - this flag decides whether those
  // are surfaced alongside, or excluded in favor of logged-in users only).
  abondonedCartOnlyForLoggedInUsers: {
    type: Boolean,
    default: true
  }
  // End of Abandoned Cart
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanySettings', companySettingsSchema);