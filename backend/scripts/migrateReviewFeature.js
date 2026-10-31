// One-time (safe to re-run) migration for the product review rework.
//
//   companymasters  - isReviewFeatureOn renamed to isProductReviewFeatureOn (the
//                     same name as the WebsiteMaster switch); the old
//                     numberOfReviewsAllowedOnProduct removed (the limit is now
//                     CompanySettings.maxReviewsPerCustomerPerProduct); the new
//                     review-photo fields filled in where missing.
//   websitemasters  - isIncludingImageInReviewsAllowed filled in where missing.
//   companysettings - maxReviewsPerCustomerPerProduct = 1 where missing.
//   reviews         - old string photos turned into { url, imageAssetId: null };
//                     `remarks` cleared on reviews that aren't deleted; the old
//                     unique index replaced by the partial one (status A/I) and
//                     the storefront list indexes created.
//   products        - averageRating / totalReviews recomputed from the
//                     published reviews.
//
// Admin Reviews module (moderation):
//   websitemasters/companymasters - isReviewEditingFeatureOn and
//                     isReviewApproveRejectFeatureOn filled in where missing
//                     (on in WebsiteMaster, off in CompanyMaster).
//   reviews         - existing reviews become APPROVED with their content as
//                     both the published and the original version; the old
//                     storefront list indexes are replaced.
//   modulemasters   - the REVIEWS module created/updated (same as seedModuleMaster.js).
//   companymasters  - REVIEWS assigned to every vendor that doesn't have it.
//
// Production: companymasters/websitemasters are read-only for the app's
// database user, so run this with the root URI, then restart the API (vendor
// data is cached).
//
// Run:  node scripts/migrateReviewFeature.js           (dry run - changes nothing)
//       node scripts/migrateReviewFeature.js --apply   (migrates)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const OLD_REVIEW_UNIQUE_INDEX = 'vendorId_1_productId_1_userId_1_orderId_1';
// Storefront list indexes from before reviews had a published version.
const OLD_REVIEW_LIST_INDEXES = ['vendorId_1_productId_1_status_1_createdAt_-1', 'vendorId_1_productId_1_status_1_rating_-1_createdAt_-1'];
const REVIEWS_MODULE = {
    moduleName: 'Reviews',
    shortModuleName: 'Reviews',
    code: 'REVIEWS',
    precedence: 2.3,
    isSystemModule: false,
    description: "Customers' product reviews - delete them, and (when switched on) edit them and approve or reject them before they go live."
};

const missing = (field) => ({ [field]: { $exists: false } });

async function migrateCompanyMasters(db) {
    try {
        const collection = db.collection('companymasters');
        const onlyOld = { isReviewFeatureOn: { $exists: true }, isProductReviewFeatureOn: { $exists: false } };
        const both = { isReviewFeatureOn: { $exists: true }, isProductReviewFeatureOn: { $exists: true } };
        const neither = { isReviewFeatureOn: { $exists: false }, isProductReviewFeatureOn: { $exists: false } };
        const oldCap = { numberOfReviewsAllowedOnProduct: { $exists: true } };

        const defaults = {
            isIncludingImageInReviewsAllowed: false,
            isReviewEditingFeatureOn: false,
            isReviewApproveRejectFeatureOn: false,
            maxImagesPerReview: 5,
            allowedReviewImageMB: 2,
            allowedReviewImagesFormat: []
        };

        const counts = {
            renamed: await collection.countDocuments(onlyOld),
            cleaned: await collection.countDocuments(both),
            addedFlag: await collection.countDocuments(neither),
            removedCap: await collection.countDocuments(oldCap)
        };
        const defaultCounts = {};
        for (const field of Object.keys(defaults)) {
            defaultCounts[field] = await collection.countDocuments(missing(field));
        }

        if (APPLY) {
            if (counts.renamed) await collection.updateMany(onlyOld, { $rename: { isReviewFeatureOn: 'isProductReviewFeatureOn' } });
            if (counts.cleaned) await collection.updateMany(both, { $unset: { isReviewFeatureOn: '' } });
            if (counts.addedFlag) await collection.updateMany(neither, { $set: { isProductReviewFeatureOn: false } });
            if (counts.removedCap) await collection.updateMany(oldCap, { $unset: { numberOfReviewsAllowedOnProduct: '' } });
            for (const [field, value] of Object.entries(defaults)) {
                if (defaultCounts[field]) await collection.updateMany(missing(field), { $set: { [field]: value } });
            }
        }

        const verb = APPLY ? '' : 'would be ';
        console.log(`companymasters   isReviewFeatureOn ${verb}renamed on ${counts.renamed}, old copy ${verb}removed on ${counts.cleaned}, ` +
            `flag ${verb}added (off) on ${counts.addedFlag}, numberOfReviewsAllowedOnProduct ${verb}removed on ${counts.removedCap}`);
        console.log(`                 new photo fields ${verb}filled in: ${JSON.stringify(defaultCounts)}`);
    } catch (err) {
        throw err;
    }
}

async function migrateWebsiteMasters(db) {
    try {
        const collection = db.collection('websitemasters');
        for (const field of ['isIncludingImageInReviewsAllowed', 'isReviewEditingFeatureOn', 'isReviewApproveRejectFeatureOn']) {
            const count = await collection.countDocuments(missing(field));
            if (APPLY && count) {
                await collection.updateMany(missing(field), { $set: { [field]: true } });
            }
            console.log(`websitemasters   ${field} ${APPLY ? '' : 'would be '}set (on) on ${count}`);
        }
    } catch (err) {
        throw err;
    }
}

async function migrateCompanySettings(db) {
    try {
        const collection = db.collection('companysettings');
        const count = await collection.countDocuments(missing('maxReviewsPerCustomerPerProduct'));
        if (APPLY && count) {
            await collection.updateMany(missing('maxReviewsPerCustomerPerProduct'), { $set: { maxReviewsPerCustomerPerProduct: 1 } });
        }
        console.log(`companysettings  maxReviewsPerCustomerPerProduct ${APPLY ? '' : 'would be '}set to 1 on ${count}`);
    } catch (err) {
        throw err;
    }
}

async function migrateReviews(db) {
    try {
        const collection = db.collection('reviews');
        const withStringImages = await collection.find({ 'images.0': { $type: 'string' } }).project({ images: 1 }).toArray();
        const liveWithRemarks = { status: { $ne: 'D' }, remarks: { $ne: null } };
        const remarksCount = await collection.countDocuments(liveWithRemarks);

        const indexes = await collection.indexes().catch(() => []);
        const hasOldIndex = indexes.some((index) => index.name === OLD_REVIEW_UNIQUE_INDEX);

        if (APPLY) {
            for (const review of withStringImages) {
                const images = review.images.map((image) => (typeof image === 'string'
                    ? { _id: new mongoose.Types.ObjectId(), url: image, imageAssetId: null }
                    : image));
                await collection.updateOne({ _id: review._id }, { $set: { images } });
            }
            if (remarksCount) await collection.updateMany(liveWithRemarks, { $set: { remarks: null } });
            if (hasOldIndex) await collection.dropIndex(OLD_REVIEW_UNIQUE_INDEX);
            for (const name of OLD_REVIEW_LIST_INDEXES) {
                if (indexes.some((index) => index.name === name)) await collection.dropIndex(name);
            }
            // The model's own indexes only (unique partial + list indexes).
            const Review = require('../models/Review');
            await Review.createIndexes();
        }

        const verb = APPLY ? '' : 'would be ';
        console.log(`reviews          string photos ${verb}converted on ${withStringImages.length}, remarks ${verb}cleared on ${remarksCount}, ` +
            `${hasOldIndex ? `old unique index ${verb}dropped, ` : ''}indexes ${verb}created`);
    } catch (err) {
        throw err;
    }
}

// Reviews from before moderation: APPROVED, current content = published = original.
async function migrateReviewModeration(db) {
    try {
        const collection = db.collection('reviews');
        const withoutStatus = await collection.find(missing('moderationStatus')).toArray();
        if (APPLY) {
            for (const review of withoutStatus) {
                const content = {
                    rating: review.rating,
                    title: review.title || '',
                    comment: review.comment || '',
                    images: Array.isArray(review.images) ? review.images : []
                };
                const set = { moderationStatus: 'APPROVED' };
                if (review.publishedContent === undefined) {
                    set.publishedContent = review.status === 'A' ? content : null;
                    set.publishedAt = review.status === 'A' ? review.createdAt : null;
                }
                if (review.originalContent === undefined) set.originalContent = content;
                if (review.history === undefined) set.history = [];
                await collection.updateOne({ _id: review._id }, { $set: set });
            }
        }
        console.log(`reviews          ${withoutStatus.length} review(s) ${APPLY ? '' : 'would be '}set to APPROVED with a published + original version`);
    } catch (err) {
        throw err;
    }
}

async function migrateReviewsModule(db) {
    try {
        const modules = db.collection('modulemasters');
        const existing = await modules.findOne({ code: REVIEWS_MODULE.code });
        let moduleId = existing?._id || null;
        if (APPLY) {
            const now = new Date();
            await modules.updateOne(
                { code: REVIEWS_MODULE.code },
                { $set: { ...REVIEWS_MODULE, status: 'A', updatedAt: now }, $setOnInsert: { createdAt: now } },
                { upsert: true }
            );
            moduleId = (await modules.findOne({ code: REVIEWS_MODULE.code }))._id;
        }
        console.log(`modulemasters    REVIEWS module ${existing ? (APPLY ? 'updated' : 'would be updated') : (APPLY ? 'created' : 'would be created')}`);

        const companies = db.collection('companymasters');
        const all = await companies.find({}).project({ assignedModules: 1 }).toArray();
        const needing = all.filter((company) => !moduleId || !(company.assignedModules || []).some((entry) => entry.moduleId && entry.moduleId.toString() === moduleId.toString()));
        if (APPLY) {
            const now = new Date();
            for (const company of needing) {
                await companies.updateOne(
                    { _id: company._id },
                    { $push: { assignedModules: { moduleId, startDate: now, expiryDate: null, assignedAt: now, revokedAt: null } } }
                );
            }
        }
        console.log(`companymasters   REVIEWS module ${APPLY ? '' : 'would be '}assigned to ${needing.length} vendor(s)`);
    } catch (err) {
        throw err;
    }
}

async function recalcProductRatings(db) {
    try {
        const stats = await db.collection('reviews').aggregate([
            { $match: { status: 'A', publishedContent: { $ne: null } } },
            { $group: { _id: '$productId', avgRating: { $avg: '$publishedContent.rating' }, count: { $sum: 1 } } }
        ]).toArray();

        const products = db.collection('products');
        const withoutSummary = await products.countDocuments(missing('totalReviews'));

        if (APPLY) {
            await products.updateMany(missing('totalReviews'), { $set: { averageRating: 0, totalReviews: 0 } });
            for (const row of stats) {
                await products.updateOne(
                    { _id: row._id },
                    { $set: { averageRating: Math.round(row.avgRating * 10) / 10, totalReviews: row.count } }
                );
            }
        }

        console.log(`products         rating summary ${APPLY ? '' : 'would be '}set to 0 on ${withoutSummary}, ` +
            `recomputed from reviews on ${stats.length}`);
    } catch (err) {
        throw err;
    }
}

async function migrateReviewFeature() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;

        await migrateCompanyMasters(db);
        await migrateWebsiteMasters(db);
        await migrateCompanySettings(db);
        await migrateReviews(db);
        await migrateReviewModeration(db);
        await migrateReviewsModule(db);
        await recalcProductRatings(db);

        if (!APPLY) {
            console.log('\nDry run only - nothing was changed. Re-run with --apply to migrate.');
        } else {
            console.log('\nDone. Restart the API so the cached vendor data is reloaded.');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrateReviewFeature();
