require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const BrandMaster = require('../models/BrandMaster');
const SizeMaster = require('../models/SizeMaster');
const WeightMaster = require('../models/WeightMaster');
const TaxMaster = require('../models/TaxMaster');
const Counter = require('../models/Counter');
const ImageAsset = require('../models/ImageAsset');
const CompanyMaster = require('../models/CompanyMaster');
const WebsiteMaster = require('../models/WebsiteMaster');
const imageUploadService = require('../services/imageUploadService');
const slugify = require('../utils/slugify');

/*
|--------------------------------------------------------------------------
| Bulk product seed - load testing the storefront and admin product lists
|--------------------------------------------------------------------------
| Inserts COUNT realistic, fully-filled products (crystals, rhinestones,
| beads, sequins, trims...) for one vendor, spread over the vendor's
| existing active categories and brands.
|
|   node seeds/seedBulkProducts.js                  -> 10000 products, vendor on "localhost"
|   node seeds/seedBulkProducts.js --count=50000
|   node seeds/seedBulkProducts.js --domain=shop.example.com
|   SEED_VENDOR_ID=<id> node seeds/seedBulkProducts.js
|
| Images: a pool of IMAGE_POOL_SIZE real photos (Wikimedia Commons) is
| uploaded ONCE through the vendor's configured storage provider, as normal
| ImageAssets, and shared across the products. Re-runs reuse the pool
| (matched by the "seed-pool-" file name prefix) instead of re-uploading.
| Sharing is safe: a product delete only removes an image no other product
| still references (productService.deleteImageIfUnreferenced).
|
| Safe to re-run: names that already exist are skipped, and product/variant/
| size codes are reserved from the same counters the app uses, so seeded
| codes never collide with codes the admin panel generates later.
*/

const IMAGE_POOL_SIZE = 40;
const BATCH_SIZE = 500;
const POOL_PREFIX = 'seed-pool-';
const USER_AGENT = 'ecommerce-v2-seed/1.0 (product load-test seed)';

const args = Object.fromEntries(
    process.argv.slice(2)
        .filter((arg) => arg.startsWith('--'))
        .map((arg) => {
            const [key, value] = arg.slice(2).split('=');
            return [key, value ?? 'true'];
        })
);
const COUNT = Math.max(1, parseInt(args.count, 10) || 10000);
const DOMAIN = args.domain || 'localhost';

// Deterministic pseudo-random numbers, so a given run is reproducible.
let seedState = 20261001;
const random = () => {
    seedState = (seedState * 1664525 + 1013904223) % 4294967296;
    return seedState / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step);

const FINISHES = ['Classic', 'Premium', 'Luxe', 'Couture', 'Bridal', 'Festive', 'Studio', 'Heritage', 'Royal', 'Signature', 'Boutique', 'Atelier'];

const COLORS = [
    'Crystal Clear', 'Crystal AB', 'Siam Red', 'Light Siam', 'Sapphire', 'Light Sapphire', 'Emerald', 'Peridot', 'Jet Black',
    'Hematite', 'Rose Gold', 'Antique Gold', 'Silver Shade', 'Amethyst', 'Rose Pink', 'Fuchsia', 'Topaz', 'Light Topaz',
    'Aquamarine', 'Turquoise', 'Montana Blue', 'Olivine', 'Smoked Topaz', 'Champagne', 'Pearl White', 'Ivory', 'Ruby',
    'Garnet', 'Tanzanite', 'Indicolite', 'Jonquil', 'Citrine', 'Moonlight', 'Golden Shadow', 'Black Diamond', 'Volcano',
    'Paradise Shine', 'Aurore Boreale', 'Metallic Sunshine', 'Bronze'
];

// Product types: which category they go in (matched by name against the
// vendor's active categories, best match first), what their sizes look like,
// and a sensible price band per pack.
const PRODUCT_TYPES = [
    { name: 'Hotfix Rhinestones', categories: ['Hotfix Rhinestones', 'Crystal'], sizes: ['SS6 (2 mm)', 'SS10 (2.8 mm)', 'SS16 (4 mm)', 'SS20 (4.8 mm)', 'SS30 (6.4 mm)'], pack: '1 gross (144 pcs)', price: [180, 900], material: 'Lead-free crystal glass, hotfix glue backing', use: 'Iron-on with a hotfix applicator or heat press', images: 'rhinestone' },
    { name: 'Flatback Rhinestones', categories: ['Crystal'], sizes: ['SS8 (2.4 mm)', 'SS12 (3.1 mm)', 'SS16 (4 mm)', 'SS20 (4.8 mm)'], pack: '1 gross (144 pcs)', price: [150, 750], material: 'Machine-cut glass, foiled back', use: 'Glue-on for garments, footwear and crafts', images: 'rhinestone' },
    { name: 'Sew-on Square Stones', categories: ['Square', 'Crystal'], sizes: ['6 x 6 mm', '8 x 8 mm', '10 x 10 mm', '12 x 12 mm'], pack: '50 pcs', price: [140, 520], material: 'Czech crystal glass in metal setting', use: 'Sew-on with 2 holes, for blouses and lehengas', images: 'rhinestone' },
    { name: 'Sew-on Rectangle Stones', categories: ['Rectangle', 'Crystal'], sizes: ['8 x 4 mm', '10 x 5 mm', '14 x 7 mm', '18 x 9 mm'], pack: '50 pcs', price: [150, 560], material: 'Czech crystal glass in metal setting', use: 'Sew-on with 2 holes, for necklines and borders', images: 'rhinestone' },
    { name: 'Chaton Stones', categories: ['Crystal'], sizes: ['PP14 (2.1 mm)', 'PP24 (3.1 mm)', 'SS29 (6.2 mm)', 'SS39 (8.2 mm)'], pack: '1 gross (144 pcs)', price: [220, 1100], material: 'Pointed-back crystal with foil', use: 'Prong settings, jewellery and kundan work', images: 'crystal' },
    { name: 'Kundan Stones', categories: ['Crystal'], sizes: ['4 mm', '6 mm', '8 mm', '10 mm'], pack: '100 pcs', price: [120, 480], material: 'Glass stones with gold foil', use: 'Kundan and polki embroidery', images: 'crystal' },
    { name: 'Faceted Crystal Beads', categories: ['Crystal Beads', 'Beads'], sizes: ['4 mm', '6 mm', '8 mm', '10 mm', '12 mm'], pack: 'Strand of 40 cm', price: [90, 480], material: 'Faceted crystal glass', use: 'Beading, tassels and jewellery making', images: 'beads' },
    { name: 'Rondelle Crystal Beads', categories: ['Crystal Beads', 'Beads'], sizes: ['4 x 3 mm', '6 x 4 mm', '8 x 6 mm', '10 x 8 mm'], pack: 'Strand of 40 cm', price: [80, 420], material: 'Faceted rondelle crystal glass', use: 'Bracelets, latkans and hand embroidery', images: 'beads' },
    { name: 'Bicone Crystal Beads', categories: ['Crystal Beads', 'Beads'], sizes: ['3 mm', '4 mm', '5 mm', '6 mm'], pack: '144 pcs', price: [110, 520], material: 'Bicone-cut crystal glass', use: 'Beadwork and tassel finishing', images: 'beads' },
    { name: 'Pressed Glass Beads', categories: ['Glass Beads', 'Beads'], sizes: ['6 mm', '8 mm', '10 mm', '12 mm'], pack: '250 g', price: [70, 320], material: 'Pressed glass', use: 'Craft, macrame and fashion jewellery', images: 'glass' },
    { name: 'Seed Beads', categories: ['Glass Beads', 'Beads'], sizes: ['Size 15/0', 'Size 11/0', 'Size 8/0', 'Size 6/0'], pack: '100 g', price: [60, 260], material: 'Uniform glass seed beads', use: 'Bead embroidery and loom work', images: 'glass' },
    { name: 'Bugle Beads', categories: ['Glass Beads', 'Beads'], sizes: ['3 mm', '6 mm', '9 mm', '12 mm'], pack: '100 g', price: [60, 240], material: 'Cut glass tube beads', use: 'Zardozi, aari and border work', images: 'glass' },
    { name: 'Pearl Beads', categories: ['Beads'], sizes: ['4 mm', '6 mm', '8 mm', '10 mm'], pack: 'Strand of 40 cm', price: [70, 360], material: 'Glass pearls with lustre coating', use: 'Bridal embroidery and jewellery', images: 'beads' },
    { name: 'Cup Sequins', categories: ['Sequins'], sizes: ['3 mm', '4 mm', '5 mm', '6 mm', '8 mm'], pack: '100 g (approx. 9,000 pcs)', price: [90, 260], material: 'PVC film, cup-shaped', use: 'Machine and hand embroidery', images: 'sequins' },
    { name: 'Flat Sequins', categories: ['Sequins'], sizes: ['3 mm', '4 mm', '6 mm', '10 mm'], pack: '100 g', price: [80, 240], material: 'PVC film, flat round', use: 'Sequin embroidery and craft', images: 'sequins' },
    { name: 'Sequin Trim', categories: ['Sequins'], sizes: ['6 mm wide', '10 mm wide', '20 mm wide'], pack: '9 m roll', price: [120, 480], material: 'Sequins stitched on cotton thread', use: 'Borders, dupattas and costume trims', images: 'sequins', measurable: true },
    { name: 'Crystal Cup Chain', categories: ['Crystal'], sizes: ['SS6', 'SS12', 'SS18', 'SS28'], pack: '1 m', price: [140, 680], material: 'Glass crystals in brass cup chain', use: 'Necklines, belts and footwear', images: 'crystal', measurable: true },
    { name: 'Mirror Work Pieces', categories: ['Crystal'], sizes: ['8 mm', '12 mm', '16 mm', '20 mm'], pack: '100 pcs', price: [60, 220], material: 'Glass mirror, polished edge', use: 'Shisha and mirror embroidery', images: 'crystal' },
    { name: 'Glass Cabochons', categories: ['Glass Beads', 'Beads'], sizes: ['8 mm', '12 mm', '18 mm', '25 mm'], pack: '50 pcs', price: [90, 380], material: 'Domed glass, flat back', use: 'Jewellery settings and craft', images: 'glass' },
    { name: 'Crystal Pendants', categories: ['Crystal'], sizes: ['16 mm', '22 mm', '28 mm', '38 mm'], pack: '10 pcs', price: [180, 950], material: 'Faceted crystal drop with hole', use: 'Latkans, jhumkas and chandelier trims', images: 'crystal' },
    { name: 'Rhinestone Banding', categories: ['Hotfix Rhinestones', 'Crystal'], sizes: ['1 row', '2 rows', '3 rows', '5 rows'], pack: '1 m', price: [160, 900], material: 'Rhinestones on mesh banding', use: 'Belts, borders and bridal wear', images: 'rhinestone', measurable: true },
    { name: 'Quartz Crystal Points', categories: ['Crystal'], sizes: ['Small (4-5 cm)', 'Medium (6-8 cm)', 'Large (9-12 cm)'], pack: '1 pc', price: [250, 1500], material: 'Natural clear quartz', use: 'Decor and display', images: 'quartz' },
    { name: 'Crystal Buttons', categories: ['Crystal'], sizes: ['10 mm', '12 mm', '15 mm', '18 mm'], pack: '12 pcs', price: [120, 520], material: 'Crystal-set metal shank buttons', use: 'Sherwanis, blouses and jackets', images: 'rhinestone' },
    { name: 'Embroidery Beads Mix', categories: ['Beads'], sizes: ['50 g', '100 g', '250 g'], pack: 'Mixed pack', price: [90, 450], material: 'Assorted glass beads, sequins and bugles', use: 'Hand embroidery kits', images: 'glass' }
];

// Wikimedia Commons searches per image group - real product-like photos.
const IMAGE_SEARCHES = {
    rhinestone: ['rhinestones', 'strass crystal', 'swarovski crystals'],
    crystal: ['crystal glass faceted', 'cut crystal'],
    beads: ['crystal beads', 'faceted beads'],
    glass: ['glass beads', 'seed beads'],
    sequins: ['sequins', 'paillettes'],
    quartz: ['quartz crystal', 'rock crystal']
};

const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
};

const fetchBuffer = async (url) => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return Buffer.from(await response.arrayBuffer());
};

// JPEG thumbnail URLs (640px wide, well under the 2 MB product image limit).
const searchCommonsImages = async (query, limit) => {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6'
        + `&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}`
        + '&prop=imageinfo&iiprop=url|mime&iiurlwidth=640';
    const data = await fetchJson(url);
    return Object.values(data?.query?.pages || {})
        .map((page) => page.imageinfo?.[0])
        .filter((info) => info && info.mime === 'image/jpeg' && info.thumburl)
        .map((info) => info.thumburl);
};

// { group -> [{ url, imageAssetId }] }, uploading whatever the pool is still missing.
const buildImagePool = async ({ vendorId, userId, companyMasterData, websiteMasterData }) => {
    const existing = await ImageAsset.find({ vendorId, module: 'productSize', status: 'A', originalName: { $regex: `^${POOL_PREFIX}` } }).lean();
    const pool = {};
    for (const asset of existing) {
        const group = asset.originalName.slice(POOL_PREFIX.length).split('-')[0];
        (pool[group] ||= []).push({ url: asset.url, imageAssetId: asset._id });
    }

    const groups = Object.keys(IMAGE_SEARCHES);
    const perGroup = Math.ceil(IMAGE_POOL_SIZE / groups.length);

    for (const group of groups) {
        const have = (pool[group] || []).length;
        if (have >= perGroup) continue;

        const urls = [];
        for (const query of IMAGE_SEARCHES[group]) {
            try {
                urls.push(...await searchCommonsImages(query, 15));
            } catch (err) {
            }
        }

        let index = have;
        for (const url of [...new Set(urls)]) {
            if (index >= perGroup) break;
            try {
                const buffer = await fetchBuffer(url);
                const originalname = `${POOL_PREFIX}${group}-${index + 1}.jpg`;
                const result = await imageUploadService.uploadImage({
                    vendorId,
                    module: 'productSize',
                    file: { buffer, originalname, size: buffer.length, mimetype: 'image/jpeg' },
                    userId,
                    maxSizeField: 'allowedProductImageMB',
                    allowedFormatsField: 'allowedProductImagesFormat',
                    companyMasterData,
                    websiteMasterData
                });
                if (!result.isSuccess) {
                    continue;
                }
                (pool[group] ||= []).push({ url: result.meta.image.url, imageAssetId: result.meta.image._id });
                index += 1;
            } catch (err) {
            }
        }
    }

    const all = Object.values(pool).flat();
    if (all.length === 0) {
        throw new Error('No product images could be uploaded - check the network and the storage provider settings.');
    }
    // Groups with no image of their own borrow from the whole pool.
    for (const group of groups) {
        if (!pool[group] || pool[group].length === 0) pool[group] = all;
    }
    return pool;
};

// Reserves `count` consecutive values of one of the app's code sequences in a
// single atomic step and returns the first one.
const reserveSequence = async (vendorId, sequenceName, count) => {
    const counter = await Counter.findOneAndUpdate(
        { vendorId, sequenceName },
        { $inc: { value: count } },
        { upsert: true, returnDocument: 'after' }
    );
    return counter.value - count + 1;
};

const code = (prefix, value) => `${prefix}-${String(value).padStart(6, '0')}`;

// EAN-13 with a valid check digit.
const ean13 = (body12) => {
    const digits = body12.split('').map(Number);
    const sum = digits.reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0);
    return body12 + ((10 - (sum % 10)) % 10);
};

const resolveVendor = async () => {
    if (process.env.SEED_VENDOR_ID) {
        return Vendor.findById(process.env.SEED_VENDOR_ID);
    }
    return Vendor.findOne({ domain: DOMAIN });
};

const seedBulkProducts = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const vendor = await resolveVendor();
    if (!vendor) throw new Error(`No vendor found (${process.env.SEED_VENDOR_ID || `domain ${DOMAIN}`}). Run seeds/seedVendor.js first.`);
    const vendorId = vendor._id;

    const admin = await User.findOne({ vendorId, role: 'admin', status: 'A' }).sort({ _id: 1 });
    if (!admin) throw new Error('No active admin user for this vendor - run seeds/seedUser.js first.');

    const [companyMasterData, websiteMasterData] = await Promise.all([
        CompanyMaster.findOne({ vendorId }).lean(),
        WebsiteMaster.findOne({}).lean()
    ]);
    if (!companyMasterData || !websiteMasterData) throw new Error('CompanyMaster / WebsiteMaster missing - run their seeds first.');

    const categories = await Category.find({ vendorId, status: 'A' }).lean();
    if (categories.length === 0) throw new Error('This vendor has no active categories - add some first.');
    const roots = categories.filter((c) => !c.parent_category_id);
    const byName = new Map(categories.map((c) => [c.categoryName.toLowerCase(), c]));
    // A sub-category's root (products always store the top-level category as mainCategory).
    const rootOf = (category) => {
        let current = category;
        const seen = new Set();
        while (current?.parent_category_id && !seen.has(String(current._id))) {
            seen.add(String(current._id));
            current = categories.find((c) => String(c._id) === String(current.parent_category_id));
        }
        return current || category;
    };
    const placementFor = (type) => {
        const match = type.categories.map((name) => byName.get(name.toLowerCase())).find(Boolean) || pick(roots);
        const root = rootOf(match);
        return { mainCategory: root._id, subCategory: String(root._id) === String(match._id) ? null : match._id };
    };

    const brands = await BrandMaster.find({ vendorId, status: 'A' }).lean();
    if (brands.length === 0) throw new Error('This vendor has no active brands - add some first.');

    const labelSize = await SizeMaster.findOne({ type: 'LABEL', name: 'Clothing Size', status: 'A' }).lean()
        || await SizeMaster.findOne({ type: 'LABEL', status: 'A' }).lean();
    const lengthSize = await SizeMaster.findOne({ type: 'MEASURABLE', status: 'A', 'measurements.0': { $exists: true } }).lean();
    if (!labelSize) throw new Error('No LABEL size in SizeMaster - run seeds/seedSizeMaster.js first.');
    const lengthMeasurement = lengthSize?.measurements?.[0];
    const lengthUnit = lengthMeasurement?.allowedUnits?.[0]?._id || lengthMeasurement?.allowedUnits?.[0];

    const gram = await WeightMaster.findOne({ symbol: 'g', status: 'A' }).lean() || await WeightMaster.findOne({ status: 'A' }).lean();
    const tax = await TaxMaster.findOne({ code: 'IN_GST_18' }).lean() || await TaxMaster.findOne({ isDefault: true }).lean();

    const imagePool = await buildImagePool({ vendorId, userId: admin._id, companyMasterData, websiteMasterData });

    // Existing names (case-insensitive, live products only) so re-runs skip them.
    const existingNames = new Set(
        (await Product.find({ vendorId, status: { $in: ['A', 'I'] } }, { name: 1 }).lean()).map((p) => p.name.toLowerCase())
    );
    const recommendable = (await Product.find({ vendorId, status: 'A' }, { _id: 1 }).sort({ _id: -1 }).limit(200).lean()).map((p) => p._id);

    // Unique names: finish x color x type, then numbered series once exhausted.
    const names = [];
    const combos = FINISHES.length * COLORS.length * PRODUCT_TYPES.length;
    for (let n = 0; names.length < COUNT && n < combos * 20; n += 1) {
        const type = PRODUCT_TYPES[n % PRODUCT_TYPES.length];
        const color = COLORS[Math.floor(n / PRODUCT_TYPES.length) % COLORS.length];
        const finish = FINISHES[Math.floor(n / (PRODUCT_TYPES.length * COLORS.length)) % FINISHES.length];
        const series = Math.floor(n / combos) + 1;
        const name = `${finish} ${color} ${type.name}${series > 1 ? ` - Series ${series}` : ''}`;
        if (!existingNames.has(name.toLowerCase())) names.push({ name, type, color, finish });
    }

    // Code ranges: one size code per size, one variant code per variant.
    const plans = names.map((entry) => {
        const variantCount = between(1, 2);
        const sizesPerVariant = Array.from({ length: variantCount }, () => between(1, Math.min(3, entry.type.sizes.length)));
        return { ...entry, variantCount, sizesPerVariant };
    });
    const totalVariants = plans.reduce((sum, p) => sum + p.variantCount, 0);
    const totalSizes = plans.reduce((sum, p) => sum + p.sizesPerVariant.reduce((a, b) => a + b, 0), 0);
    let nextProductCode = await reserveSequence(vendorId, 'productCode', plans.length);
    let nextVariantCode = await reserveSequence(vendorId, 'variantCode', totalVariants);
    let nextSizeCode = await reserveSequence(vendorId, 'sizeCode', totalSizes);
    const runTag = Date.now().toString(36).toUpperCase();

    const buildProduct = (plan, index) => {
        const { type, color, finish } = plan;
        const [minPrice, maxPrice] = type.price;
        const basePrice = roundTo(between(minPrice, maxPrice), 5);
        const productCode = code('PRD', nextProductCode++);
        const productBrand = pick(brands);
        const images = imagePool[type.images];
        const secondColor = COLORS[(COLORS.indexOf(color) + 7) % COLORS.length];
        const variantColors = [color, secondColor].slice(0, plan.variantCount);

        const variants = variantColors.map((variantColor, v) => {
            const sizeLabels = [...type.sizes].sort(() => random() - 0.5).slice(0, plan.sizesPerVariant[v]);
            const sizes = sizeLabels.map((sizeLabel, s) => {
                const price = roundTo(basePrice * (1 + s * 0.35) * (v === 0 ? 1 : 1.1), 5);
                const sizeCode = code('SIZ', nextSizeCode++);
                const image = images[(index + v * 3 + s) % images.length];
                const extra = images[(index + v * 3 + s + 1) % images.length];
                // ~4% out of stock so the storefront's out-of-stock path is exercised too.
                const stock = random() < 0.04 ? 0 : between(5, 600);
                const measurable = type.measurable && lengthSize && lengthUnit;
                const sizeDoc = {
                    isDefaultSize: s === 0,
                    sizeType: measurable ? 'MEASURABLE' : 'LABEL',
                    sizeId: measurable ? lengthSize._id : labelSize._id,
                    sizeName: `${sizeLabel} - ${type.pack}`,
                    image: { url: image.url, imageAssetId: image.imageAssetId },
                    additionalImages: [{ url: extra.url, imageAssetId: extra.imageAssetId }],
                    sizeAdditionalDisclaimer: null,
                    sizeAdditionalDescription: [],
                    sizeAdditionalBulkPricing: [],
                    warranty: { isAvailable: false, duration: null, durationType: null },
                    return: { isAvailable: true, duration: 7, durationType: 'DAYS' },
                    exchange: { isAvailable: true, duration: 10, durationType: 'DAYS' },
                    shipping: { type: 'COMPANY_SETTINGS', value: null },
                    isDescriptionSameFromVariantsDetails: true,
                    isDisclaimerSameFromVariantsDetails: true,
                    isBulkPricingSameFromVariantsDetails: true,
                    precedence: s + 1,
                    excludeCountries: [],
                    excludeStates: [],
                    excludeCities: [],
                    excludeZipCodes: [],
                    brandId: (s === 0 ? productBrand : pick(brands))._id,
                    price,
                    cancelledPrice: roundTo(price * 1.18, 5),
                    stock,
                    weight: gram ? { value: between(20, 500), unit: gram._id } : null,
                    sku: `${productCode}-${v + 1}${s + 1}-${runTag}`,
                    barcode: ean13(`890${String(nextSizeCode).padStart(9, '0')}`),
                    sizeCode,
                    status: 'A',
                    createdBy: admin._id,
                    remarks: 'SEED'
                };
                if (measurable) {
                    sizeDoc.values = [{ measurementId: lengthMeasurement._id, unit: lengthUnit, value: (s + 1) * 100 }];
                } else {
                    sizeDoc.labelValue = labelSize.values[Math.min(s + 1, labelSize.values.length - 1)];
                }
                return sizeDoc;
            });

            return {
                isDefaultVariant: v === 0,
                color: variantColor,
                displayName: `${variantColor} ${finish}`,
                variantAdditionalDisclaimer: null,
                variantAdditionalDescription: [],
                variantAdditionalBulkPricing: [],
                isDescriptionSameFromProductBasicDetails: true,
                isDisclaimerSameFromProductBasicDetails: true,
                isBulkPricingSameFromProductBasicDetails: true,
                variantCode: code('VAR', nextVariantCode++),
                sizes,
                status: 'A',
                createdBy: admin._id,
                remarks: 'SEED'
            };
        });

        const placement = placementFor(type);
        return {
            vendorId,
            name: plan.name,
            description: [
                { key: 'Material', value: type.material },
                { key: 'Colour', value: variantColors.join(', ') },
                { key: 'Pack', value: type.pack },
                { key: 'Best for', value: type.use }
            ],
            colors: variantColors,
            mainCategory: placement.mainCategory,
            subCategory: placement.subCategory,
            disclaimer: 'Colours may vary slightly from the photo due to screen settings and lighting.',
            searchKeywords: [...new Set([type.name.toLowerCase(), color.toLowerCase(), finish.toLowerCase(), ...type.name.toLowerCase().split(' ')])],
            recommendedProducts: recommendable.length ? [pick(recommendable), pick(recommendable)].filter((id, i, a) => a.indexOf(id) === i) : [],
            taxIds: tax ? [tax._id] : [],
            // After the hand-curated products (1, 2, 3...) on the storefront's "featured" sort.
            precedence: 100 + (index % 900),
            slug: `${slugify(plan.name)}-${productCode.toLowerCase()}`,
            productCode,
            bulkPricing: [
                { minimumQuantity: 10, maximumQuantity: 49, price: roundTo(basePrice * 0.92, 1) },
                { minimumQuantity: 50, maximumQuantity: 500, price: roundTo(basePrice * 0.85, 1) }
            ],
            variants,
            status: 'A',
            createdBy: admin._id,
            remarks: 'SEED'
        };
    };

    let inserted = 0;
    const startedAt = Date.now();
    for (let start = 0; start < plans.length; start += BATCH_SIZE) {
        const batch = plans.slice(start, start + BATCH_SIZE).map((plan, i) => buildProduct(plan, start + i));
        try {
            const docs = await Product.insertMany(batch, { ordered: false });
            inserted += docs.length;
        } catch (err) {
            inserted += err.insertedDocs?.length || 0;
            const firstError = err.writeErrors?.[0]?.errmsg || err.message;
        }
    }

};

seedBulkProducts()
    .catch((err) => {
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
