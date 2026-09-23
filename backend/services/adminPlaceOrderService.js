const Order = require('../models/Order');
const Address = require('../models/Address');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const OrderStepMaster = require('../models/OrderStepMaster');
const categoryService = require('./categoryService');
const commissionService = require('./commissionService');
const invoiceService = require('./invoiceService');
const common = require('../utils/common');
const logger = require('../utils/logger');
const bulkPricing = require('../utils/bulkPricing');
const taxCalculationService = require('./taxCalculationService');
const currencyService = require('./currencyService');
const userLocationService = require('./userLocationService');
const { PAYMENT_METHODS } = require('../constants/paymentGatewayConstants');
const { ORDER_NOTIFICATION_TYPES } = require('../constants/orderRealtimeConstants');
const { notifyOrderChanged } = require('./orderRealtimeService');
const {
    USER_SEARCH_FIELDS,
    USER_DROPDOWN_DEFAULT_LIMIT,
    USER_DROPDOWN_MAX_LIMIT
} = require('../constants/adminPlaceOrderConstants');

const round2 = (value) => Math.round(value * 100) / 100;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Two-layer WebsiteMaster/CompanyMaster switch, same convention as
// createUserByAdmin in userService.js. Every function below starts with it.
const checkFeatureOn = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        return await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData,
            'isAdminPlacingOrderOnBehalfOfUserIsOn', 'isAdminPlacingOrderOnBehalfOfUserIsOn'
        );
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| DROPDOWN DATA
|--------------------------------------------------------------------------
*/

const fetchUserSearchFields = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const fields = USER_SEARCH_FIELDS.map(({ key, label }) => ({ key, label }));
        return common.returnResult(true, 200, 'Search fields fetched successfully', { fields });
    } catch (err) {
        throw err;
    }
};

// Second dropdown: the values of whichever field the admin picked, one row per
// active customer. A customer with no value for that field (e.g. no WhatsApp
// number) is excluded. `search` narrows as the admin types, `limit` caps the
// dropdown size so a large customer base never ships in one response.
const fetchUsersBySearchField = async (vendorId, websiteMasterData, companyMasterData, query) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { searchField, search, limit } = query;
        const fieldConfig = USER_SEARCH_FIELDS.find((field) => field.key === searchField);
        if (!fieldConfig) {
            return common.returnResult(false, 400, 'Invalid search field.');
        }

        const filter = {
            vendorId,
            role: 'user',
            status: 'A',
            [fieldConfig.userField]: { $exists: true, $nin: [null, ''] }
        };
        if (search) {
            filter[fieldConfig.userField] = { $regex: escapeRegex(search), $options: 'i' };
        }

        const effectiveLimit = Math.min(limit || USER_DROPDOWN_DEFAULT_LIMIT, USER_DROPDOWN_MAX_LIMIT);
        const users = await User.find(filter)
            .select(`name ${fieldConfig.userField}`)
            .sort({ [fieldConfig.userField]: 1 })
            .limit(effectiveLimit)
            .lean();

        const options = users.map((user) => ({
            userId: user._id,
            value: user[fieldConfig.userField],
            name: user.name
        }));

        return common.returnResult(true, 200, 'Users fetched successfully', { users: options });
    } catch (err) {
        throw err;
    }
};

const fetchUserAddresses = async (vendorId, websiteMasterData, companyMasterData, userId) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const user = await User.findOne({ _id: userId, vendorId, role: 'user', status: 'A' }).select('_id').lean();
        if (!user) {
            return common.returnResult(false, 404, 'User not found.');
        }

        const addresses = await Address.find({ userId, vendorId, status: 'A' })
            .select('address_name room_no building address_in_words floor pincode country_id state_id city_id')
            .sort({ createdAt: -1 })
            .lean();

        return common.returnResult(true, 200, 'Addresses fetched successfully', { addresses });
    } catch (err) {
        throw err;
    }
};

// Every active category (any depth), flat - the shape the shared
// CategoryPathPicker builds its main -> sub -> deeper drill-down from.
// Feature-gate-free loaders: Place Order gates them with
// isAdminPlacingOrderOnBehalfOfUserIsOn (the fetchX wrappers below), and Edit
// Order (orderEditService.js) gates them with isEditingOrderFeatureOn, so the
// product picker behaves identically in both.
const loadCategories = async (vendorId) => {
    try {
        const categories = await Category.find({ vendorId, status: 'A' })
            .select('categoryName parent_category_id status')
            .sort({ categoryName: 1 })
            .lean();

        return common.returnResult(true, 200, 'Categories fetched successfully', { categories });
    } catch (err) {
        throw err;
    }
};

const fetchCategories = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        return await loadCategories(vendorId);
    } catch (err) {
        throw err;
    }
};

// Active products only. With categoryId (the deepest category the admin has
// picked so far) it matches that category and everything beneath it.
const loadActiveProducts = async (vendorId, query) => {
    try {
        const { categoryId, search } = query;
        const filter = { vendorId, status: 'A' };

        if (categoryId) {
            const category = await Category.findOne({ _id: categoryId, vendorId, status: 'A' }).select('_id').lean();
            if (!category) {
                return common.returnResult(false, 404, 'Category not found.');
            }
            const descendantIds = await categoryService.getActiveDescendantIds(vendorId, category._id);
            const categoryIds = [category._id, ...descendantIds];
            filter.$or = [
                { mainCategory: { $in: categoryIds } },
                { subCategory: { $in: categoryIds } }
            ];
        }
        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: 'i' };
        }

        const products = await Product.find(filter)
            .select('name productCode mainCategory subCategory')
            .sort({ name: 1 })
            .limit(200)
            .lean();

        return common.returnResult(true, 200, 'Products fetched successfully', { products });
    } catch (err) {
        throw err;
    }
};

const fetchActiveProducts = async (vendorId, websiteMasterData, companyMasterData, query) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        return await loadActiveProducts(vendorId, query);
    } catch (err) {
        throw err;
    }
};

// Variant dropdown -> size dropdown data for one product, active variants and
// sizes only. Stock is returned so the UI can flag out-of-stock sizes; whether
// they may still be ordered is decided server-side by allowOutOfStockProductsAdding.
const loadProductOptions = async (vendorId, companySettingsData, productId) => {
    try {
        const product = await Product.findOne({ _id: productId, vendorId, status: 'A' }).lean();
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;
        const variants = (product.variants || [])
            .filter((variant) => variant.status === 'A')
            .map((variant) => ({
                variantId: variant._id,
                variantName: variant.displayName || variant.color || 'Default',
                sizes: (variant.sizes || [])
                    .filter((size) => size.status === 'A')
                    .map((size) => ({
                        sizeId: size._id,
                        sizeName: size.sizeName,
                        sku: size.sku,
                        price: size.price,
                        // Combined product -> variant -> size tiers, so Place
                        // Order can preview the price "Apply Bulk Pricing" gives.
                        bulkPricing: bulkPricing.resolveEffectiveBulkPricing(product, variant, size)
                            .map(({ minimumQuantity, maximumQuantity, price }) => ({ minimumQuantity, maximumQuantity, price }))
                            .sort((a, b) => a.minimumQuantity - b.minimumQuantity),
                        stock: size.stock,
                        isOutOfStock: size.stock <= 0,
                        isSelectable: allowOutOfStock || size.stock > 0
                    }))
            }))
            .filter((variant) => variant.sizes.length > 0);

        return common.returnResult(true, 200, 'Product options fetched successfully', {
            product: { productId: product._id, name: product.name, productCode: product.productCode },
            allowOutOfStockProductsAdding: allowOutOfStock,
            variants
        });
    } catch (err) {
        throw err;
    }
};

const fetchProductOptions = async (vendorId, websiteMasterData, companyMasterData, companySettingsData, productId) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        return await loadProductOptions(vendorId, companySettingsData, productId);
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| STOCK
|--------------------------------------------------------------------------
| Same $elemMatch-guarded findOneAndUpdate technique as cartService's
| adjustSizeStock (see the comment there on why the guard has to live in the
| top-level filter). Kept here so admin orders stay independent of the
| Cart-based stock helpers.
*/
const adjustSizeStock = async (productId, variantId, sizeId, delta, requireAvailableStock) => {
    try {
        const sizeElemMatch = { _id: sizeId };
        if (requireAvailableStock) {
            sizeElemMatch.stock = { $gte: -delta };
        }
        const updated = await Product.findOneAndUpdate(
            {
                _id: productId,
                variants: { $elemMatch: { _id: variantId, sizes: { $elemMatch: sizeElemMatch } } }
            },
            { $inc: { 'variants.$[v].sizes.$[s].stock': delta } },
            { arrayFilters: [{ 'v._id': variantId }, { 's._id': sizeId }] }
        );
        return updated !== null;
    } catch (err) {
        throw err;
    }
};

// Takes stock off one line and returns how much was actually taken, or null
// when it could not be taken. With allowOutOfStock the amount is clamped at
// what is left (stock never goes below 0); without it, the full quantity or
// nothing. Retries on a lost race, since stock can change between the read
// and the guarded write.
const deductStockForLine = async (line, allowOutOfStock) => {
    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            const product = await Product.findOne({ _id: line.productId }).select('variants').lean();
            const variant = product?.variants?.find((v) => v._id.toString() === line.variantId.toString());
            const size = variant?.sizes?.find((s) => s._id.toString() === line.sizeId.toString());
            if (!size) return null;

            const deduct = allowOutOfStock ? Math.min(size.stock, line.quantity) : line.quantity;
            if (deduct <= 0) {
                return allowOutOfStock ? 0 : null;
            }

            const succeeded = await adjustSizeStock(line.productId, line.variantId, line.sizeId, -deduct, true);
            if (succeeded) return deduct;
        }
        return null;
    } catch (err) {
        throw err;
    }
};

const restoreDeductedStock = async (deductions) => {
    try {
        for (const done of deductions) {
            if (done.deducted > 0) {
                await adjustSizeStock(done.productId, done.variantId, done.sizeId, done.deducted, false);
            }
        }
    } catch (err) {
        throw err;
    }
};

// Called on cancellation of an admin-placed order (see orderService.js's
// restoreStockForCancelledOrder). Gives back exactly what was taken.
const restoreStockForAdminOrder = async (order) => {
    try {
        const deductions = (order.items || []).map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sizeId: item.sizeId,
            deducted: item.stockDeductedQuantity || 0
        }));
        await restoreDeductedStock(deductions);
    } catch (err) {
        throw err;
    }
};

/*
|--------------------------------------------------------------------------
| PLACE ORDER
|--------------------------------------------------------------------------
*/

// Resolves each requested line against the live catalogue: product, variant
// and size must all be active, and unless the vendor allows out-of-stock
// adding, the size must have enough stock. Price is always the live size price.
// The admin's "Apply Bulk Pricing" tick (Place Order and Edit Order). Unticked
// -> normal price. Ticked while the feature is off for this vendor -> refused,
// rather than silently charging the normal price.
const resolveApplyBulkPricing = async (vendorId, applyBulkPricing, websiteMasterData, companyMasterData) => {
    try {
        if (applyBulkPricing !== true) {
            return common.returnResult(true, 200, 'All Good', { isBulkPricingOn: false });
        }
        const isBulkPricingOn = await bulkPricing.isBulkPricingActive(vendorId, websiteMasterData, companyMasterData);
        if (!isBulkPricingOn) {
            return common.returnResult(false, 403, 'Bulk Pricing is not enabled for your plan, so it cannot be applied to this order.');
        }
        return common.returnResult(true, 200, 'All Good', { isBulkPricingOn: true });
    } catch (err) {
        throw err;
    }
};

// isBulkPricingOn comes from resolveApplyBulkPricing - true only when the
// admin ticked "Apply Bulk Pricing" and the feature is on.
const resolveOrderLines = async (vendorId, items, allowOutOfStock, isBulkPricingOn = false) => {
    try {
        const seen = new Set();
        const lines = [];

        for (const item of items) {
            const key = `${item.productId}:${item.variantId}:${item.sizeId}`;
            if (seen.has(key)) {
                return { error: 'The same product, variant and size is added more than once. Combine them into one line.' };
            }
            seen.add(key);

            const product = await Product.findOne({ _id: item.productId, vendorId, status: 'A' });
            if (!product) {
                return { error: 'One of the selected products was not found or is not active.' };
            }
            const variant = product.variants.id(item.variantId);
            if (!variant || variant.status !== 'A') {
                return { error: `The selected variant of "${product.name}" is not available.` };
            }
            const size = variant.sizes.id(item.sizeId);
            if (!size || size.status !== 'A') {
                return { error: `The selected size of "${product.name}" is not available.` };
            }

            const variantName = variant.displayName || variant.color || 'Default';
            if (!allowOutOfStock && size.stock < item.quantity) {
                return { error: `"${product.name}" - ${variantName} - ${size.sizeName} has only ${size.stock} in stock.` };
            }

            // Same quantity-based bulk pricing the customer gets in the cart.
            const { unitPrice } = bulkPricing.resolveUnitPrice(product, variant, size, item.quantity, isBulkPricingOn);

            lines.push({
                productId: product._id,
                variantId: variant._id,
                sizeId: size._id,
                productName: product.name,
                variantName,
                sizeName: size.sizeName,
                sku: size.sku,
                taxIds: product.taxIds || [],
                unitPrice,
                quantity: item.quantity,
                amount: round2(unitPrice * item.quantity),
                taxBreakdown: []
            });
        }

        return { lines };
    } catch (err) {
        throw err;
    }
};

// Tax location for an admin order: the chosen saved address when there is
// one; otherwise (walk-in, typed-in address, or no address at all) the store's
// own location from CompanySettings. Shared with orderEditService.js.
const resolveAdminOrderTaxLocation = ({ savedAddress, companySettingsData }) => {
    try {
        const addressLocation = savedAddress
            ? { countryId: savedAddress.country_id, stateId: savedAddress.state_id, cityId: savedAddress.city_id, zipCode: savedAddress.pincode }
            : null;
        return taxCalculationService.resolveTaxLocationContext(addressLocation, companySettingsData);
    } catch (err) {
        throw err;
    }
};

// Fills every line's taxBreakdown for an admin order: nothing when tax is
// switched off, the admin's typed total split across the lines when
// "Enter tax manually" is ticked, otherwise the location's auto taxes.
const applyAdminOrderTax = async ({ lines, taxLocation, isTaxOff, isTaxManual, manualTaxAmount }) => {
    try {
        if (isTaxOff) {
            lines.forEach((line) => { line.taxBreakdown = []; });
            return lines;
        }
        if (isTaxManual) {
            return taxCalculationService.applyManualTax(lines, manualTaxAmount);
        }
        return await taxCalculationService.applyTaxesToLines(lines, taxLocation);
    } catch (err) {
        throw err;
    }
};

// Currency of an admin order: the customer's own country's (converted from the
// store currency, like a storefront order); walk-ins always the store's.
const resolveAdminOrderCurrency = async ({ isWalkIn, user, companyMasterData, companySettingsData }) => {
    try {
        const countryId = isWalkIn ? null : userLocationService.extractUserLocation(user).countryId;
        return await currencyService.resolveCustomerCurrency({ countryId, companyMasterData, companySettingsData });
    } catch (err) {
        throw err;
    }
};

// Prices store-currency lines into the order currency and taxes them. Auto tax
// is worked out on the store-currency amounts and converted with the lines; a
// manually typed tax is already in the order currency, so it is split across
// the lines after they are converted. Shared with orderEditService.js.
const priceAdminOrderLines = async ({ lines, taxLocation, isTaxOff, isTaxManual, manualTaxAmount, exchangeRate, decimalPlaces }) => {
    try {
        if (isTaxManual && !isTaxOff) {
            currencyService.convertLines(lines, exchangeRate, decimalPlaces);
            return taxCalculationService.applyManualTax(lines, manualTaxAmount);
        }
        await applyAdminOrderTax({ lines, taxLocation, isTaxOff, isTaxManual: false });
        return currencyService.convertLines(lines, exchangeRate, decimalPlaces);
    } catch (err) {
        throw err;
    }
};

// What the tax preview returns for a set of priced lines.
const buildTaxPreview = (lines, taxLocation, isTaxOff) => {
    try {
        const { taxes, totalTaxAmount } = taxCalculationService.summarizeTaxes(lines);
        return {
            lines: lines.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                sizeId: line.sizeId,
                unitPrice: line.unitPrice,
                amount: line.amount,
                taxAmount: taxCalculationService.lineTaxAmount(line)
            })),
            taxes,
            totalTaxAmount,
            isTaxOff: isTaxOff === true,
            // true = taxed at the store's location; false with no country = no tax (store location not set).
            isStoreLocation: !isTaxOff && taxLocation.isStoreLocation && !!taxLocation.countryId,
            isLocationMissing: !isTaxOff && !taxLocation.countryId
        };
    } catch (err) {
        throw err;
    }
};

// The currency the Place Order page shows (and the admin types amounts in)
// for the chosen customer - or, with no userId, a walk-in's store currency.
const fetchOrderCurrency = async (vendorId, websiteMasterData, companyMasterData, companySettingsData, userId) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        let user = null;
        if (userId) {
            user = await User.findOne({ _id: userId, vendorId, role: 'user', status: 'A' }).select('_id country').lean();
            if (!user) {
                return common.returnResult(false, 404, 'User not found.');
            }
        }

        const currencyResult = await resolveAdminOrderCurrency({ isWalkIn: !userId, user, companyMasterData, companySettingsData });
        if (!currencyResult.isSuccess) {
            return common.returnResult(false, currencyResult.statusCode, currencyResult.message);
        }
        const { currency, storeCurrency, exchangeRate, isConverted } = currencyResult.meta;
        return common.returnResult(true, 200, 'Currency fetched successfully', {
            currency: currencyService.shapeCurrency(currency),
            storeCurrency: currencyService.shapeCurrency(storeCurrency),
            exchangeRate,
            isConverted
        });
    } catch (err) {
        throw err;
    }
};

// Live preview of the auto-calculated tax on the Place Order page.
const previewPlaceOrderTax = async (vendorId, websiteMasterData, companyMasterData, companySettingsData, payload) => {
    try {
        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { userId, isWalkInCustomer, addressId, applyTax, applyBulkPricing, items } = payload;
        const isWalkIn = isWalkInCustomer === true;

        let savedAddress = null;
        let user = null;
        if (!isWalkIn) {
            user = await User.findOne({ _id: userId, vendorId, role: 'user', status: 'A' }).select('_id country').lean();
            if (!user) {
                return common.returnResult(false, 404, 'User not found.');
            }
            if (addressId) {
                savedAddress = await Address.findOne({ _id: addressId, userId, vendorId, status: 'A' });
                if (!savedAddress) {
                    return common.returnResult(false, 404, 'Selected address not found for this user.');
                }
            }
        }

        const bulkPricingResult = await resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
        if (!bulkPricingResult.isSuccess) {
            return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
        }

        // Preview only - stock is re-checked (and reserved) when the order is placed.
        const lineResult = await resolveOrderLines(vendorId, items, true, bulkPricingResult.meta.isBulkPricingOn);
        if (lineResult.error) {
            return common.returnResult(false, 400, lineResult.error);
        }

        const currencyResult = await resolveAdminOrderCurrency({ isWalkIn, user, companyMasterData, companySettingsData });
        if (!currencyResult.isSuccess) {
            return common.returnResult(false, currencyResult.statusCode, currencyResult.message);
        }
        const currencyShape = currencyService.shapeCurrency(currencyResult.meta.currency);

        // Amounts come back in the customer's currency - the one the order will be in.
        const isTaxOff = isWalkIn && applyTax === false;
        const taxLocation = resolveAdminOrderTaxLocation({ savedAddress, companySettingsData });
        await priceAdminOrderLines({
            lines: lineResult.lines, taxLocation, isTaxOff, isTaxManual: false,
            exchangeRate: currencyResult.meta.exchangeRate, decimalPlaces: currencyShape.decimalPlaces
        });

        return common.returnResult(true, 200, 'Tax preview calculated successfully', {
            ...buildTaxPreview(lineResult.lines, taxLocation, isTaxOff),
            currency: currencyShape,
            exchangeRate: currencyResult.meta.exchangeRate
        });
    } catch (err) {
        throw err;
    }
};

const placeOrderOnBehalfOfUser = async (vendorId, adminUserId, websiteMasterData, companyMasterData, companySettingsData, payload) => {
    try {
        // orderService requires this file (for cancellation), so it is
        // required lazily here to avoid a circular import at load time.
        const orderService = require('./orderService');

        const featureCheck = await checkFeatureOn(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const { userId, isWalkInCustomer, walkInCustomer, applyTax, applyBulkPricing, isTaxManual, manualTaxAmount, items, shippingAmount, discountAmount, addressId, addressText, orderNumber, remarks } = payload;
        const isWalkIn = isWalkInCustomer === true;
        const isTaxOff = isWalkIn && applyTax === false;
        if (isTaxOff && isTaxManual === true) {
            return common.returnResult(false, 400, 'Tax cannot be entered manually when "Apply tax" is switched off.');
        }
        const allowOutOfStock = companySettingsData?.allowOutOfStockProductsAdding === true;

        // Walk-in (cash counter) orders have no User at all.
        let user = null;
        if (!isWalkIn) {
            user = await User.findOne({ _id: userId, vendorId, role: 'user', status: 'A' });
            if (!user) {
                return common.returnResult(false, 404, 'User not found.');
            }
        }

        // --- Optional saved address ---
        let savedAddress = null;
        let addressSnapshot;
        if (!isWalkIn && addressId) {
            savedAddress = await Address.findOne({ _id: addressId, userId, vendorId, status: 'A' });
            if (!savedAddress) {
                return common.returnResult(false, 404, 'Selected address not found for this user.');
            }
            const snapshotResult = await orderService.buildAddressSnapshot(savedAddress);
            if (snapshotResult.error) {
                return common.returnResult(false, 400, snapshotResult.error);
            }
            addressSnapshot = snapshotResult.snapshot;
        }

        // --- Order caps (same plan limits as normal orders) ---
        const lifetimeLimit = companyMasterData?.numberOfOrdersAllowed;
        if (lifetimeLimit !== null && lifetimeLimit !== undefined) {
            const lifetimeCount = await Order.countDocuments({ vendorId, status: { $ne: 'D' } });
            if (lifetimeCount >= lifetimeLimit) {
                return common.returnResult(false, 403, 'This store has reached the maximum number of orders allowed on its current plan.');
            }
        }

        const monthlyLimit = companyMasterData?.numberOfOrdersAllowedPerMonth;
        if (monthlyLimit !== null && monthlyLimit !== undefined) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const monthlyCount = await Order.countDocuments({ vendorId, status: { $ne: 'D' }, orderPlacedAt: { $gte: startOfMonth } });
            if (monthlyCount >= monthlyLimit) {
                return common.returnResult(false, 403, 'This store has reached the maximum number of orders allowed this month.');
            }
        }

        // --- Order step workflow ---
        const orderStepMasterId = companyMasterData?.orderSteps;
        if (!orderStepMasterId) {
            return common.returnResult(false, 500, 'Order workflow is not configured for this store yet. Please contact support.');
        }
        const stepMaster = await OrderStepMaster.findOne({ _id: orderStepMasterId, status: 'A' });
        if (!stepMaster) {
            return common.returnResult(false, 500, 'Order workflow is not configured correctly for this store. Please contact support.');
        }
        const firstStep = stepMaster.steps.find((step) => step.sequence === 1);
        if (!firstStep) {
            return common.returnResult(false, 500, 'Order workflow is misconfigured for this store (no starting step). Please contact support.');
        }

        // --- Currency: the customer's own country's, converted from the store
        // currency (walk-ins: the store's). The admin types discount, shipping
        // and a manual tax in this currency. ---
        const currencyResult = await resolveAdminOrderCurrency({ isWalkIn, user, companyMasterData, companySettingsData });
        if (!currencyResult.isSuccess) {
            return common.returnResult(false, currencyResult.statusCode, currencyResult.message);
        }
        const currencyFields = currencyService.buildOrderCurrencyFields(currencyResult.meta);

        // --- Lines, tax, totals ---
        const bulkPricingResult = await resolveApplyBulkPricing(vendorId, applyBulkPricing, websiteMasterData, companyMasterData);
        if (!bulkPricingResult.isSuccess) {
            return common.returnResult(false, bulkPricingResult.statusCode, bulkPricingResult.message);
        }

        const lineResult = await resolveOrderLines(vendorId, items, allowOutOfStock, bulkPricingResult.meta.isBulkPricingOn);
        if (lineResult.error) {
            return common.returnResult(false, 400, lineResult.error);
        }
        const lines = lineResult.lines;

        // Taxed at the saved address, else at the store's own location (walk-in,
        // typed-in address, no address), else not at all. The admin can instead
        // enter the tax by hand, or switch it off entirely for a walk-in order.
        const taxLocation = resolveAdminOrderTaxLocation({ savedAddress, companySettingsData });
        await priceAdminOrderLines({
            lines, taxLocation, isTaxOff, isTaxManual: isTaxManual === true, manualTaxAmount,
            exchangeRate: currencyFields.exchangeRate, decimalPlaces: currencyFields.currencyDecimalPlaces
        });

        const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
        const totalTaxAmount = round2(lines.reduce((sum, line) => sum + line.taxBreakdown.reduce((s, t) => s + t.taxAmount, 0), 0));
        const shipping = round2(shippingAmount || 0);
        const discount = round2(discountAmount || 0);

        if (discount > subtotal) {
            return common.returnResult(false, 400, 'Discount cannot be greater than the order subtotal.');
        }
        const grandTotal = round2(subtotal - discount + totalTaxAmount + shipping);

        // --- Order number ---
        const orderNumberResult = await orderService.resolveOrderNumber({ vendorId, orderNumber, companySettingsData });
        if (!orderNumberResult.isSuccess) {
            return common.returnResult(false, orderNumberResult.statusCode, orderNumberResult.message);
        }

        // --- Reserve stock line by line; undo everything if any line loses ---
        const deductions = [];
        for (const line of lines) {
            const deducted = await deductStockForLine(line, allowOutOfStock);
            if (deducted === null) {
                await restoreDeductedStock(deductions);
                return common.returnResult(false, 409, `"${line.productName}" - ${line.variantName} - ${line.sizeName} just went out of stock. Please review and try again.`);
            }
            line.stockDeductedQuantity = deducted;
            deductions.push({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, deducted });
        }

        const orderItems = lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            sizeId: line.sizeId,
            productName: line.productName,
            variantName: line.variantName,
            sizeName: line.sizeName,
            sku: line.sku,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineAmount: line.amount,
            taxBreakdown: line.taxBreakdown,
            lineTaxAmount: taxCalculationService.lineTaxAmount(line),
            stockDeductedQuantity: line.stockDeductedQuantity
        }));

        const order = new Order({
            orderNumber: orderNumberResult.meta.orderNumber,
            vendorId,
            userId: user ? user._id : null,
            orderStepMasterId: stepMaster._id,
            currentStepId: firstStep._id,
            currentStepCode: firstStep.code,
            currentStepName: firstStep.name,
            currentStepSequence: firstStep.sequence,
            statusHistory: [{
                stepId: firstStep._id,
                stepCode: firstStep.code,
                stepName: firstStep.name,
                sequence: firstStep.sequence,
                startedAt: new Date(),
                isManualUpdate: false
            }],
            items: orderItems,
            subtotal,
            // Mirrored into totalDiscountAmount so existing order views and the
            // commission base (subtotal - totalDiscountAmount) stay consistent.
            totalDiscountAmount: discount,
            totalTaxAmount,
            totalFreeCashAmount: 0,
            shippingAmount: shipping,
            additionalCharges: 0,
            grandTotal,
            ...currencyFields,
            shippingAddressId: savedAddress ? savedAddress._id : null,
            shippingAddressSnapshot: addressSnapshot,
            adminEnteredAddress: isWalkIn ? null : (addressText || null),
            isPlacedByAdmin: true,
            isWalkInCustomer: isWalkIn,
            walkInCustomer: isWalkIn ? {
                name: walkInCustomer.name,
                phone: walkInCustomer.phone,
                // Optional fields arrive as '' when left blank - store them as null.
                whatsapp: walkInCustomer.whatsapp || null,
                email: walkInCustomer.email || null,
                address: walkInCustomer.address || null
            } : undefined,
            placedByAdminId: adminUserId,
            adminDiscountAmount: discount,
            payment: { method: PAYMENT_METHODS.COD, status: 'PENDING', amount: grandTotal },
            remarks: remarks || null,
            orderPlacedAt: new Date(),
            createdBy: adminUserId
        });

        try {
            await order.save();
            await commissionService.recordCommissionForOrder(order, companyMasterData);
        } catch (err) {
            await restoreDeductedStock(deductions);
            throw err;
        }

        // Live-updates the admin Orders list. Walk-in orders have no userId, so no customer push.
        notifyOrderChanged(order, ORDER_NOTIFICATION_TYPES.NEW);

        // Never fails the order: if this can't issue the invoice now, it is issued on first download.
        await invoiceService.tryIssueInvoiceForOrder(order, { companySettingsData, companyMasterData, websiteMasterData });

        logger.logInfo(1, 0, 'Admin placed order on behalf of user', { vendorId, adminUserId, userId: user ? user._id : null, isWalkIn, orderId: order._id });

        return common.returnResult(true, 201, 'Order placed successfully', { order });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    fetchUserSearchFields,
    fetchUsersBySearchField,
    fetchUserAddresses,
    fetchCategories,
    fetchActiveProducts,
    fetchProductOptions,
    previewPlaceOrderTax,
    fetchOrderCurrency,
    placeOrderOnBehalfOfUser,
    restoreStockForAdminOrder,
    // shared with orderEditService.js
    loadCategories,
    loadActiveProducts,
    loadProductOptions,
    resolveOrderLines,
    resolveApplyBulkPricing,
    resolveAdminOrderTaxLocation,
    applyAdminOrderTax,
    priceAdminOrderLines,
    resolveAdminOrderCurrency,
    buildTaxPreview,
    deductStockForLine,
    restoreDeductedStock
};
