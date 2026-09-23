const mongoose = require('mongoose');

const brandMasterSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    brandName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    brandShortName: {
        type: String,
        trim: true,
        default: null,
        maxlength: 20
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    updatedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkedBy: {
        type: mongoose.Types.ObjectId,
        default: null,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    activeMarkedDate: {
        type: Date,
        default: null
    },
    inactiveMarkedDate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Two different vendors may both create a brand named "Nike" - uniqueness is
// scoped per vendor, not global - case-insensitive ("Nike" and "nike" are the
// same brand, like product names), and only among brands that aren't
// soft-deleted, matching brandMasterService's duplicate check (status $ne 'D'),
// so deleting "Nike" lets a new "Nike" be created. $in because partial
// indexes can't use $ne. Mongoose won't change an existing index's options -
// after editing either index here run `node scripts/migrateBrandIndexes.js`.
const LIVE_BRAND = { status: { $in: ['A', 'I'] } };
// Used by both unique indexes; exported so brandMasterService's duplicate
// checks compare names and short names exactly the way the indexes do.
const BRAND_NAME_COLLATION = { locale: 'en', strength: 2 };
brandMasterSchema.index(
    { vendorId: 1, brandName: 1 },
    { unique: true, collation: BRAND_NAME_COLLATION, partialFilterExpression: LIVE_BRAND }
);

// Same scoping as brandName - also case-insensitive ("UCB" = "ucb") - but only
// for brands that HAVE a short name and aren't soft-deleted, matching
// brandMasterService's duplicate check (status $ne 'D'). A partial filter, not `sparse`: sparse on a compound index
// still indexes every doc (vendorId is always present), so brands with no
// short name (null) collided. $type because partial indexes can't use $ne.
brandMasterSchema.index(
    { vendorId: 1, brandShortName: 1 },
    { unique: true, collation: BRAND_NAME_COLLATION, partialFilterExpression: { brandShortName: { $type: 'string' }, ...LIVE_BRAND } }
);

module.exports = mongoose.model('BrandMaster', brandMasterSchema);
module.exports.BRAND_NAME_COLLATION = BRAND_NAME_COLLATION;
