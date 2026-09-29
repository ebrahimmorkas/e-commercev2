const User = require('../models/User');
const Group = require('../models/Group');
const FreeCash = require('../models/FreeCash');
const emailService = require('./emailService');
const emailTemplateMasterService = require('./emailTemplateMasterService');
const currencyService = require('./currencyService');
const { EMAIL_MODULES, PROMOTION_EMAIL_FLAGS } = require('../constants/emailModuleConstants');
const logger = require('../utils/logger');

/*
|--------------------------------------------------------------------------
| DISCOUNT & FREE CASH CUSTOMER EMAILS
|--------------------------------------------------------------------------
| Who gets them:
|   - A user-targeted discount (specific users / user groups) or Free Cash
|     (specific users / groups) emails exactly those customers.
|   - Anything else (all users, products, categories) emails every active
|     customer of the store - but only when Company Settings says so
|     (discountEmailRecipients / freeCashEmailRecipients = 'ALL'; the
|     default 'TARGETED' sends nothing for those).
| Each email has its own WebsiteMaster AND CompanyMaster switch
| (PROMOTION_EMAIL_FLAGS). Amounts are shown in each customer's own
| currency (their account's country, converted like the storefront does);
| Free Cash Used/Refunded use the order's locked currency instead.
|
| Sends to many customers run in the background after the admin's request
| has already been answered, one customer at a time. If the email quota or
| the email feature stops a send, the rest are skipped and it's logged.
| Nothing here ever throws into the caller's flow: the discount/Free Cash
| change itself has already been saved.
*/

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday',
    FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday'
};

// "28 Sep 2026" - same format as the order emails.
const formatEmailDate = (date) => {
    try {
        if (!date) return '';
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return '';
        return `${String(d.getUTCDate()).padStart(2, '0')} ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    } catch (err) {
        throw err;
    }
};

const yesNo = (value) => (value ? 'Yes' : 'No');

const isFlagOn = (flag, websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true;
    } catch (err) {
        throw err;
    }
};

// Runs a send after the current request has been answered. A promise-level
// .catch (not a try/catch block) so a failure is only ever logged.
const runInBackground = (label, task) => {
    try {
        setImmediate(() => {
            task().catch((err) => logger.logWarning(`${label} - background email send failed`, { err }));
        });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| MONEY
|--------------------------------------------------------------------------
*/

const plainMoney = (amount) => (Math.round((Number(amount) || 0) * 100) / 100).toFixed(2);

// A store-currency amount -> text in the customer's own currency. Cached per
// country for the length of one send, since many customers share one.
const buildCustomerMoneyFormatter = async (countryId, companyMasterData, companySettingsData, cache) => {
    try {
        const key = countryId ? String(countryId) : 'none';
        if (cache && cache.has(key)) return cache.get(key);
        const result = await currencyService.resolveCustomerCurrency({ countryId, companyMasterData, companySettingsData });
        const formatter = result.isSuccess ? currencyService.buildMoneyFormatter(result.meta) : plainMoney;
        if (cache) cache.set(key, formatter);
        return formatter;
    } catch (err) {
        throw err;
    }
};

// A store-currency amount -> text in an order's own (locked) currency.
const buildOrderMoneyFormatter = (order) => {
    try {
        if (!order || !order.currencySymbol) return null;
        return currencyService.buildMoneyFormatter({
            currency: {
                short_name: order.currencyCode,
                symbol: order.currencySymbol,
                symbol_position: order.currencySymbolPosition,
                decimal_places: order.currencyDecimalPlaces
            },
            exchangeRate: order.exchangeRate || 1
        });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| VARIABLES
|--------------------------------------------------------------------------
*/

const describeAppliesTo = (giveDiscountTo) => {
    try {
        const value = String(giveDiscountTo || '');
        if (value.startsWith('SPECIFIC_PRODUCTS') || value.startsWith('PRODUCT_GROUP')) return 'Selected products';
        if (value.startsWith('SPECIFIC_CATEGORIES') || value.startsWith('CATEGORY_GROUP')) return 'Selected categories';
        if (value.startsWith('PRODUCT_VARIANTS')) return 'Selected product variants';
        return 'All products';
    } catch (err) {
        throw err;
    }
};

// See DISCOUNT_VARIABLES in constants/emailVariableConstants.js.
const buildDiscountTokens = (discount, money) => {
    try {
        return {
            discountName: discount.name || '',
            discountDescription: discount.description || '',
            discountValue: discount.discountType === 'PERCENTAGE' ? `${discount.discountValue}%` : money(discount.discountValue),
            couponCode: discount.isCouponCodeDiscount ? discount.couponCode || '' : '',
            startDate: formatEmailDate(discount.startDate) || 'Now',
            endDate: formatEmailDate(discount.endDate) || 'No end date',
            minimumOrderAmount: discount.discountValidAboveAmount > 0 ? money(discount.discountValidAboveAmount) : '',
            minimumQuantity: discount.isMinimumDiscountQuantityDiscount && discount.minimumQuantity ? String(discount.minimumQuantity) : '',
            validDays: discount.isDiscountOpenForSpecificDays ? (discount.specificDays || []).map((d) => DAY_LABELS[d] || d).join(', ') : '',
            validHours: discount.isDiscountOpenForSpecificHours && discount.specificHoursStartTime
                ? `${discount.specificHoursStartTime} - ${discount.specificHoursEndTime}`
                : '',
            firstOrderOnly: yesNo(discount.firstOrderOnly),
            paymentMethods: discount.isDiscountBasedOnPaymentMethods ? (discount.discountOnPaymentMethods || []).join(', ') : '',
            appliesTo: describeAppliesTo(discount.giveDiscountTo)
        };
    } catch (err) {
        throw err;
    }
};

// See FREE_CASH_VARIABLES. `grant` (UserFreeCash) is null for a campaign
// that isn't user-targeted - the campaign's own amount is used then.
const buildFreeCashTokens = (freeCash, grant, money) => {
    try {
        const amount = grant ? grant.amount : freeCash.freeCashAmount;
        const remaining = grant ? grant.remainingAmount : freeCash.freeCashAmount;
        return {
            freeCashName: freeCash.freeCashName || '',
            freeCashAmount: money(amount),
            remainingAmount: money(remaining),
            maxUsagePerOrder: freeCash.maxCashUsagePerOrder != null ? money(freeCash.maxCashUsagePerOrder) : '',
            minimumOrderAmount: freeCash.validAbove > 0 ? money(freeCash.validAbove) : '',
            startDate: formatEmailDate(freeCash.startDate),
            endDate: formatEmailDate(freeCash.endDate),
            canCombineWithDiscounts: yesNo(freeCash.canBeUsedWithOtherDiscounts)
        };
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| RECIPIENTS
|--------------------------------------------------------------------------
*/

const isUserTargetedDiscount = (discount) => {
    try {
        const value = String(discount.giveDiscountTo || '');
        return value === 'USER_GROUP' || value.endsWith('_SPECIFIC_USERS');
    } catch (err) {
        throw err;
    }
};

const isUserTargetedFreeCash = (freeCash) => {
    try {
        return ['SPECIFIC_USERS', 'GROUPS'].includes(freeCash.giveFreeCashTo);
    } catch (err) {
        throw err;
    }
};

// Members of the vendor's active USER groups.
const resolveUserGroupMembers = async (vendorId, groupIds) => {
    try {
        if (!Array.isArray(groupIds) || groupIds.length === 0) return [];
        const groups = await Group.find({ _id: { $in: groupIds }, vendorId, groupType: 'USER', status: 'A' }).select('members').lean();
        return groups.flatMap((g) => g.members || []);
    } catch (err) {
        throw err;
    }
};

// The customers a user-targeted discount is for (its users + its groups' members).
const resolveDiscountTargetUserIds = async (vendorId, discount) => {
    try {
        if (!isUserTargetedDiscount(discount)) return [];
        const members = await resolveUserGroupMembers(vendorId, discount.userGroupIds);
        return [...new Set([...(discount.userIds || []), ...members].map(String))];
    } catch (err) {
        throw err;
    }
};

// 'ALL' = every active customer; otherwise a list of user ids (may be empty).
const resolveDiscountRecipients = async (vendorId, discount, companySettingsData) => {
    try {
        if (isUserTargetedDiscount(discount)) return resolveDiscountTargetUserIds(vendorId, discount);
        return companySettingsData?.discountEmailRecipients === 'ALL' ? 'ALL' : [];
    } catch (err) {
        throw err;
    }
};

const resolveFreeCashRecipients = (freeCash, companySettingsData) => {
    try {
        if (isUserTargetedFreeCash(freeCash)) return (freeCash.giveToUsers || []).map(String);
        return companySettingsData?.freeCashEmailRecipients === 'ALL' ? 'ALL' : [];
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| SENDING
|--------------------------------------------------------------------------
*/

// Emails `recipients` ('ALL' or user ids) of the vendor with `module`'s
// template. buildTokens(customer, money) returns the module's variables for
// one customer (customerName is added here). moneyFormatter, when given,
// is used for every customer instead of their own currency.
// Returns { sent, skipped, stoppedReason }.
const sendToCustomers = async ({
    vendorId, module, recipients, buildTokens, moneyFormatter = null,
    companyMasterData, websiteMasterData, companySettingsData, userId = null
}) => {
    try {
        const outcome = { sent: 0, skipped: 0, stoppedReason: null };
        const flag = PROMOTION_EMAIL_FLAGS[module];
        if (!isFlagOn(flag, websiteMasterData, companyMasterData)) {
            logger.logInfo(0, 1, 'Email switched off for this vendor - skipping notification', { vendorId, module, featureFlag: flag });
            outcome.stoppedReason = 'switched off';
            return outcome;
        }
        if (recipients !== 'ALL' && (!Array.isArray(recipients) || recipients.length === 0)) {
            return outcome;
        }

        const templateResult = await emailTemplateMasterService.resolveTemplateForModule(
            vendorId, module, companyMasterData, companySettingsData, websiteMasterData, null
        );
        if (!templateResult.isSuccess) {
            logger.logInfo(0, 1, 'No email template to send - skipping notification', { vendorId, module, reason: templateResult.message });
            outcome.stoppedReason = templateResult.message;
            return outcome;
        }
        const { template, isDefault } = templateResult.meta;
        // Read once for the whole send: CC/BCC choices, attachments and images.
        const extras = await emailTemplateMasterService.buildTemplateEmailExtras({
            vendorId, template, isDefault, companyMasterData, websiteMasterData, companySettingsData, cache: new Map()
        });
        const stripImageTokens = (str) => String(str || '').replace(/\{\{\s*image:[a-z0-9_-]+\s*\}\}/gi, '');

        const filter = { vendorId, role: 'user', status: 'A', email: { $nin: [null, ''] } };
        if (recipients !== 'ALL') filter._id = { $in: recipients };

        const moneyCache = new Map();
        const cursor = User.find(filter).select('name email country').lean().cursor();
        for (let customer = await cursor.next(); customer; customer = await cursor.next()) {
            const money = moneyFormatter || await buildCustomerMoneyFormatter(customer.country, companyMasterData, companySettingsData, moneyCache);
            const tokens = { customerName: customer.name || '', ...buildTokens(customer, money) };

            const result = await emailService.sendEmail({
                vendorId,
                module,
                to: customer.email,
                cc: extras.cc,
                bcc: extras.bcc,
                includeCompanyCc: extras.includeCompanyCc,
                includeCompanyBcc: extras.includeCompanyBcc,
                subject: stripImageTokens(emailService.renderTemplateString(template.subject, tokens)),
                html: extras.renderImages(emailService.renderTemplateString(template.htmlBody, tokens)),
                text: template.textBody ? stripImageTokens(emailService.renderTemplateString(template.textBody, tokens)) : undefined,
                attachments: extras.attachments,
                images: extras.images,
                userId,
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                isDefaultTemplate: isDefault
            }).catch((err) => {
                logger.logWarning('Promotion email threw while sending', { vendorId, module, err });
                return null;
            });

            if (result && result.isSuccess) {
                outcome.sent += 1;
            } else {
                outcome.skipped += 1;
                // Quota used up / email turned off: no point trying the rest.
                if (result && result.statusCode === 403) {
                    outcome.stoppedReason = result.message;
                    await cursor.close();
                    break;
                }
            }
        }

        logger.logInfo(outcome.sent, outcome.skipped, 'Promotion emails sent', { vendorId, module, ...outcome });
        return outcome;
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| DISCOUNT EVENTS
|--------------------------------------------------------------------------
*/

// "Discount Available": a new or re-activated discount (all of its
// recipients), or - on an edit - only the customers just added to it
// (previousTargetUserIds = its targeted customers before the edit).
const notifyDiscountAvailable = ({ vendorId, discount, previousTargetUserIds = null, companyMasterData, websiteMasterData, companySettingsData, userId }) => {
    try {
        runInBackground('notifyDiscountAvailable', async () => {
            let recipients = await resolveDiscountRecipients(vendorId, discount, companySettingsData);
            if (previousTargetUserIds) {
                const before = new Set(previousTargetUserIds.map(String));
                recipients = recipients === 'ALL' ? [] : recipients.filter((id) => !before.has(id));
            }
            await sendToCustomers({
                vendorId,
                module: EMAIL_MODULES.DISCOUNT_AVAILABLE,
                recipients,
                buildTokens: (customer, money) => buildDiscountTokens(discount, money),
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                userId
            });
        });
    } catch (err) {
        throw err;
    }
};

// "Discount Expiring Soon" - awaited (the reminder job runs in the background already).
const sendDiscountExpiringSoon = async ({ vendorId, discount, companyMasterData, websiteMasterData, companySettingsData }) => {
    try {
        return await sendToCustomers({
            vendorId,
            module: EMAIL_MODULES.DISCOUNT_EXPIRING_SOON,
            recipients: await resolveDiscountRecipients(vendorId, discount, companySettingsData),
            buildTokens: (customer, money) => buildDiscountTokens(discount, money),
            companyMasterData,
            websiteMasterData,
            companySettingsData
        });
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| FREE CASH EVENTS
|--------------------------------------------------------------------------
*/

// "Free Cash Credited": a new or re-activated campaign. User-targeted
// campaigns email the customers it was given to; others follow the
// freeCashEmailRecipients setting.
const notifyFreeCashCredited = ({ vendorId, freeCash, companyMasterData, websiteMasterData, companySettingsData, userId }) => {
    try {
        runInBackground('notifyFreeCashCredited', async () => {
            await sendToCustomers({
                vendorId,
                module: EMAIL_MODULES.FREE_CASH_CREDITED,
                recipients: resolveFreeCashRecipients(freeCash, companySettingsData),
                buildTokens: (customer, money) => buildFreeCashTokens(freeCash, null, money),
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                userId
            });
        });
    } catch (err) {
        throw err;
    }
};

// One email per grant (UserFreeCash) - Revoked / Expired / Expiring Soon.
// Grants are grouped per campaign so each campaign's details are loaded once.
const sendPerGrant = async ({ vendorId, module, grants, companyMasterData, websiteMasterData, companySettingsData, userId = null }) => {
    try {
        const byCampaign = new Map();
        for (const grant of grants) {
            const key = String(grant.freeCashId);
            if (!byCampaign.has(key)) byCampaign.set(key, []);
            byCampaign.get(key).push(grant);
        }

        const totals = { sent: 0, skipped: 0 };
        for (const [freeCashId, campaignGrants] of byCampaign) {
            const freeCash = await FreeCash.findOne({ _id: freeCashId, vendorId }).lean();
            if (!freeCash) continue;
            const grantByUser = new Map(campaignGrants.map((g) => [String(g.userId), g]));
            const outcome = await sendToCustomers({
                vendorId,
                module,
                recipients: [...grantByUser.keys()],
                buildTokens: (customer, money) => buildFreeCashTokens(freeCash, grantByUser.get(String(customer._id)), money),
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                userId
            });
            totals.sent += outcome.sent;
            totals.skipped += outcome.skipped;
            if (outcome.stoppedReason) break;
        }
        return totals;
    } catch (err) {
        throw err;
    }
};

const notifyFreeCashRevoked = ({ vendorId, grants, companyMasterData, websiteMasterData, companySettingsData, userId }) => {
    try {
        if (!grants || grants.length === 0) return;
        runInBackground('notifyFreeCashRevoked', () => sendPerGrant({
            vendorId, module: EMAIL_MODULES.FREE_CASH_REVOKED, grants, companyMasterData, websiteMasterData, companySettingsData, userId
        }));
    } catch (err) {
        throw err;
    }
};

// A newer Free Cash replaced these grants (Free Cash stacking is off).
const notifyFreeCashExpired = ({ vendorId, grants, companyMasterData, websiteMasterData, companySettingsData, userId }) => {
    try {
        if (!grants || grants.length === 0) return;
        runInBackground('notifyFreeCashExpired', () => sendPerGrant({
            vendorId, module: EMAIL_MODULES.FREE_CASH_EXPIRED, grants, companyMasterData, websiteMasterData, companySettingsData, userId
        }));
    } catch (err) {
        throw err;
    }
};

// Awaited - called from the reminder job, which runs in the background already.
const sendFreeCashExpiringSoonForGrants = async ({ vendorId, grants, companyMasterData, websiteMasterData, companySettingsData }) => {
    try {
        return await sendPerGrant({
            vendorId, module: EMAIL_MODULES.FREE_CASH_EXPIRING_SOON, grants, companyMasterData, websiteMasterData, companySettingsData
        });
    } catch (err) {
        throw err;
    }
};

// Reminder for a campaign that isn't user-targeted (no grants) - every
// active customer, when freeCashEmailRecipients is 'ALL'.
const sendFreeCashExpiringSoonToAll = async ({ vendorId, freeCash, companyMasterData, websiteMasterData, companySettingsData }) => {
    try {
        return await sendToCustomers({
            vendorId,
            module: EMAIL_MODULES.FREE_CASH_EXPIRING_SOON,
            recipients: companySettingsData?.freeCashEmailRecipients === 'ALL' ? 'ALL' : [],
            buildTokens: (customer, money) => buildFreeCashTokens(freeCash, null, money),
            companyMasterData,
            websiteMasterData,
            companySettingsData
        });
    } catch (err) {
        throw err;
    }
};

// "Free Cash Used" / "Free Cash Refunded" for one grant on one order, in the
// order's currency. amount = what was used / refunded.
const notifyFreeCashOrderEvent = ({ vendorId, module, grant, order, amount, companyMasterData, websiteMasterData, companySettingsData, userId }) => {
    try {
        runInBackground('notifyFreeCashOrderEvent', async () => {
            const freeCash = await FreeCash.findOne({ _id: grant.freeCashId, vendorId }).lean();
            if (!freeCash) return;
            const amountKey = module === EMAIL_MODULES.FREE_CASH_USED ? 'amountUsed' : 'amountRefunded';
            await sendToCustomers({
                vendorId,
                module,
                recipients: [String(grant.userId)],
                moneyFormatter: buildOrderMoneyFormatter(order),
                buildTokens: (customer, money) => ({
                    ...buildFreeCashTokens(freeCash, grant, money),
                    [amountKey]: money(amount),
                    orderNumber: order.orderNumber || ''
                }),
                companyMasterData,
                websiteMasterData,
                companySettingsData,
                userId
            });
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    formatEmailDate,
    resolveDiscountTargetUserIds,
    notifyDiscountAvailable,
    sendDiscountExpiringSoon,
    notifyFreeCashCredited,
    notifyFreeCashRevoked,
    notifyFreeCashExpired,
    notifyFreeCashOrderEvent,
    sendFreeCashExpiringSoonForGrants,
    sendFreeCashExpiringSoonToAll,
    isUserTargetedFreeCash
};
