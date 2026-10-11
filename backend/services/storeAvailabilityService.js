const common = require('../utils/common');
const {
    STORE_STATUS_FLAG,
    STORE_STATUS_PRIORITY,
    STORE_STATUS_MESSAGE,
    STORE_OPEN_MESSAGE,
    STORE_API_PREFIX,
    STORE_STATUS_EXEMPT_PATHS
} = require('../constants/storeAvailabilityConstants');

// Which closed-store page (if any) applies to this vendor. A flag being on in
// EITHER model is enough: WebsiteMaster closes every vendor, CompanyMaster
// closes just this one. Reads the data ensureVendorDataCached already put on
// the request - no DB call.
const resolveStoreStatus = (websiteMasterData, companyMasterData) => {
    try {
        const website = websiteMasterData || {};
        const company = companyMasterData || {};

        const status = STORE_STATUS_PRIORITY.find((candidate) => {
            const flag = STORE_STATUS_FLAG[candidate];
            return website[flag] === true || company[flag] === true;
        });

        return status || null;
    } catch (err) {
        throw err;
    }
};

// The few public details the closed-store pages show - nothing here is more
// than the storefront already shows an anonymous visitor.
const buildStoreInfo = (companySettingsData) => {
    try {
        const settings = companySettingsData || {};

        return {
            companyName: settings.companyName || null,
            companyLogoUrl: (settings.companyLogo && settings.companyLogo.url) || null,
            contactEmail: settings.contactEmail || null,
            contactPhoneNumber: settings.contactPhoneNumber || null
        };
    } catch (err) {
        throw err;
    }
};

const getStoreAvailability = (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const status = resolveStoreStatus(websiteMasterData, companyMasterData);
        const message = status ? STORE_STATUS_MESSAGE[status] : STORE_OPEN_MESSAGE;

        return common.returnResult(true, 200, message, {
            status,
            store: buildStoreInfo(companySettingsData)
        });
    } catch (err) {
        throw err;
    }
};

// Whether a request is refused while the store is closed: every API call
// except the exempt ones (see STORE_STATUS_EXEMPT_PATHS).
const isPathBlockedWhenClosed = (path) => {
    try {
        const requestPath = String(path || '');
        if (!requestPath.startsWith(STORE_API_PREFIX)) return false;

        // An exempt path matches itself and anything under it - never a
        // sibling that merely starts with the same text (e.g.
        // /get-company-settings must not exempt /get-company-settings-admin).
        const isExempt = STORE_STATUS_EXEMPT_PATHS.some((exemptPath) => {
            const exemptFolder = exemptPath.endsWith('/') ? exemptPath : `${exemptPath}/`;
            return requestPath === exemptPath || requestPath.startsWith(exemptFolder);
        });

        return !isExempt;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    resolveStoreStatus,
    getStoreAvailability,
    isPathBlockedWhenClosed
};
