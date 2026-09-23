const TaxMaster = require('../models/TaxMaster');

const round2 = (value) => Math.round(value * 100) / 100;
const round4 = (value) => Math.round(value * 10000) / 10000;

// Name every manually-entered tax line carries (it has no TaxMaster behind it).
const MANUAL_TAX_NAME = 'Manual tax';

/*
|--------------------------------------------------------------------------
| TAX LOCATION
|--------------------------------------------------------------------------
| Taxes only apply when the delivery country is known. When it isn't (a guest
| with no location, a walk-in sale, an admin order with a typed-in address),
| the store's own location from CompanySettings (storeCountryId/StateId/CityId)
| is used instead. If that isn't set either the result has no countryId and
| applyTaxesToLines charges no tax - it never falls back to "every tax".
*/
const storeLocationContext = (companySettingsData) => {
    try {
        return {
            countryId: companySettingsData?.storeCountryId || null,
            stateId: companySettingsData?.storeStateId || null,
            cityId: companySettingsData?.storeCityId || null,
            zipCode: null
        };
    } catch (err) {
        throw err;
    }
};

const resolveTaxLocationContext = (locationContext, companySettingsData) => {
    try {
        if (locationContext && locationContext.countryId) {
            return { ...locationContext, isStoreLocation: false };
        }
        return { ...storeLocationContext(companySettingsData), isStoreLocation: true };
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| AUTO TAX
|--------------------------------------------------------------------------
| lines: [{ taxIds, amount, ... }] - each line gets its own taxBreakdown
| (replaced, not appended). A tax applies when its country is the location's
| country and, for a state-specific tax, the state matches too.
*/
const applyTaxesToLines = async (lines, locationContext) => {
    try {
        for (const line of lines) {
            line.taxBreakdown = [];
        }
        if (!locationContext || !locationContext.countryId) {
            return lines;
        }

        const allTaxIds = [...new Set(lines.flatMap((line) => (line.taxIds || []).map((id) => id.toString())))];
        const taxDocs = allTaxIds.length > 0
            ? await TaxMaster.find({ _id: { $in: allTaxIds }, status: 'A' })
            : [];
        const taxDocMap = new Map(taxDocs.map((tax) => [tax._id.toString(), tax]));

        for (const line of lines) {
            for (const taxId of (line.taxIds || [])) {
                const taxDoc = taxDocMap.get(taxId.toString());
                if (!taxDoc) continue;
                if (taxDoc.countryId.toString() !== locationContext.countryId.toString()) continue;
                if (taxDoc.stateId && locationContext.stateId && taxDoc.stateId.toString() !== locationContext.stateId.toString()) continue;

                const taxAmount = taxDoc.taxType === 'percentage'
                    ? line.amount * (taxDoc.totalRate / 100)
                    : taxDoc.totalRate;

                line.taxBreakdown.push({
                    taxId: taxDoc._id,
                    taxName: taxDoc.name,
                    taxRate: taxDoc.totalRate,
                    taxAmount: round2(taxAmount)
                });
            }
        }
        return lines;
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| MANUAL TAX
|--------------------------------------------------------------------------
| The admin types one tax total for the order. It is split across the lines
| in proportion to each line's amount (the last line takes the rounding
| remainder), so per-line tax still adds up for invoices and returns.
*/
const applyManualTax = (lines, totalTaxAmount) => {
    try {
        for (const line of lines) {
            line.taxBreakdown = [];
        }
        const total = round2(totalTaxAmount || 0);
        if (total <= 0 || lines.length === 0) {
            return lines;
        }

        const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
        let remaining = total;
        lines.forEach((line, index) => {
            const isLast = index === lines.length - 1;
            const share = isLast
                ? round2(remaining)
                : round2(subtotal > 0 ? total * (line.amount / subtotal) : (index === 0 ? total : 0));
            remaining = round2(remaining - share);
            if (share <= 0) return;
            line.taxBreakdown.push({
                taxId: null,
                taxName: MANUAL_TAX_NAME,
                taxRate: line.amount > 0 ? round4((share / line.amount) * 100) : 0,
                taxAmount: share
            });
        });
        return lines;
    } catch (err) {
        throw err;
    }
};

// Totals the lines' taxBreakdown, grouped per tax (manual tax is one group).
const summarizeTaxes = (lines) => {
    try {
        const totals = new Map();
        for (const line of lines) {
            for (const tax of (line.taxBreakdown || [])) {
                const key = tax.taxId ? tax.taxId.toString() : tax.taxName;
                const existing = totals.get(key);
                if (existing) {
                    existing.taxAmount = round2(existing.taxAmount + tax.taxAmount);
                } else {
                    totals.set(key, { taxId: tax.taxId, taxName: tax.taxName, taxRate: tax.taxRate, taxAmount: tax.taxAmount });
                }
            }
        }
        const taxes = Array.from(totals.values());
        const totalTaxAmount = round2(taxes.reduce((sum, tax) => sum + tax.taxAmount, 0));
        return { taxes, totalTaxAmount };
    } catch (err) {
        throw err;
    }
};

const lineTaxAmount = (line) => {
    try {
        return round2((line.taxBreakdown || []).reduce((sum, tax) => sum + tax.taxAmount, 0));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    MANUAL_TAX_NAME,
    storeLocationContext,
    resolveTaxLocationContext,
    applyTaxesToLines,
    applyManualTax,
    summarizeTaxes,
    lineTaxAmount
};
