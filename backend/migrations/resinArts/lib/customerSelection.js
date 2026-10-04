const { createUserAdminSchema } = require('../../../middlewares/validations/userValidations');
const { resolveState, resolveCityName } = require('./indiaLocations');

// The exact rules the new store applies to these fields when an admin adds a
// customer (userValidations.js) - reused rather than re-typed.
const FIELD_RULES = {
    name: createUserAdminSchema.extract('name'),
    email: createUserAdminSchema.extract('email'),
    phone_no: createUserAdminSchema.extract('phone_no'),
    whatsapp_no: createUserAdminSchema.extract('whatsapp_no')
};

// Old customer -> the new store's field names, with the state/city text
// resolved to proper names.
const mapCustomer = (source) => {
    try {
        const name = [source.first_name, source.middle_name, source.last_name]
            .map(part => String(part || '').trim())
            .filter(Boolean)
            .join(' ');

        return {
            name,
            email: String(source.email || '').trim().toLowerCase(),
            phone_no: String(source.phone_number || '').trim(),
            whatsapp_no: String(source.whatsapp_number || '').trim() || undefined,
            state: resolveState(source.state),
            cityName: resolveCityName(source.city)
        };
    } catch (err) {
        throw err;
    }
};

// Why this old account cannot become a customer of the new store, or null.
const findRejectionReason = (source, mapped) => {
    try {
        if (source.role !== 'user') {
            return `"${source.role}" account - only customers are migrated`;
        }

        for (const [field, rule] of Object.entries(FIELD_RULES)) {
            if (mapped[field] === undefined) continue;
            const { error } = rule.validate(mapped[field]);
            if (error) {
                return `${error.details[0].message.replace(/"/g, '')} (old value: "${mapped[field]}")`;
            }
        }

        if (!String(source.state || '').trim()) {
            return 'no state in the old data - the new store requires one';
        }
        if (!mapped.state) {
            return `state "${source.state}" is not a recognised Indian state - add it to STATE_ALIASES in lib/indiaLocations.js`;
        }

        return null;
    } catch (err) {
        throw err;
    }
};

// Picks the customers one run works on. 04-locationMasters and 05-users both
// call this with the same --limit / --ids, so the states and cities seeded by
// 04 are exactly the ones 05 then needs.
//
// --limit n means "the first n customers that CAN be migrated": an account
// that is rejected does not use up one of the n places.
const selectCustomers = (allUsers, { limit, ids }) => {
    try {
        const wantedIds = new Set(ids);
        const hasFilter = limit !== null || wantedIds.size > 0;
        const selected = [];
        const rejected = [];
        let takenByLimit = 0;

        for (const source of allUsers) {
            const isWantedById = wantedIds.has(source._id.toString());
            const isWithinLimit = limit !== null && takenByLimit < limit;
            if (hasFilter && !isWantedById && !isWithinLimit) continue;

            const mapped = mapCustomer(source);
            const reason = findRejectionReason(source, mapped);
            if (reason) {
                rejected.push({ source, mapped, reason });
                continue;
            }

            selected.push({ source, mapped });
            if (!isWantedById) takenByLimit++;
        }

        return { selected, rejected };
    } catch (err) {
        throw err;
    }
};

const describeCustomer = (source, mapped) => {
    try {
        return `${mapped.name} <${mapped.email}> (${source._id})`;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    selectCustomers,
    describeCustomer
};
