const crypto = require('crypto');
const mongoose = require('mongoose');

const ImageAsset = require('../../../models/ImageAsset');

const MIME_TYPES = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif'
};

// The same inputs always give the same ObjectId. Records that never existed in
// the old database (a product's variant and size, an ImageAsset, an Address,
// a Favorite) get their _id this way, so running a script twice finds the
// record it created the first time instead of creating a second one.
const deterministicObjectId = (...parts) => {
    try {
        const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
        return new mongoose.Types.ObjectId(hash.slice(0, 24));
    } catch (err) {
        throw err;
    }
};

// https://res.cloudinary.com/<cloud>/image/upload/v123/products/abc.png
//   -> key "products/abc" (the Cloudinary public id the storage provider
//      needs to delete or replace the file later), extension "png".
const parseCloudinaryUrl = (url) => {
    try {
        const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)\.([a-z0-9]+)$/i.exec(String(url || '').trim());
        if (!match) {
            return null;
        }
        return { key: match[1], extension: match[2].toLowerCase() };
    } catch (err) {
        throw err;
    }
};

// The old database stored a bare image URL; the new one stores the URL plus an
// ImageAsset record describing the file. The file itself is not touched or
// re-uploaded - the ImageAsset simply points at where it already is.
// Returns null when the URL is not a Cloudinary image URL.
const buildImageAsset = ({ vendorId, module, url, ownerId, slot, adminId, createdAt }) => {
    try {
        const parsed = parseCloudinaryUrl(url);
        if (!parsed) {
            return null;
        }

        return new ImageAsset({
            _id: deterministicObjectId('imageAsset', ownerId, slot),
            vendorId,
            module,
            provider: 'cloudinary',
            url: String(url).trim(),
            key: parsed.key,
            originalName: `${parsed.key.split('/').pop()}.${parsed.extension}`,
            mimeType: MIME_TYPES[parsed.extension],
            status: 'A',
            createdBy: adminId,
            createdAt,
            updatedAt: createdAt
        });
    } catch (err) {
        throw err;
    }
};

// Validates the document against its Mongoose schema and writes it.
//   inserted / replaced           written (with --apply)
//   would-insert / would-replace  what --apply would do (dry run)
//   exists                        already migrated and --overwrite not given
//   conflict                      the _id is taken by another vendor's record
//   duplicate                     a unique index rejected it (reason says which field)
// timestamps:false keeps the createdAt/updatedAt carried over from the old data.
const saveDocument = async (Model, doc, { apply, overwrite, vendorId }) => {
    try {
        await doc.validate();

        const existing = await Model.findById(doc._id).select('vendorId').lean();
        if (existing && existing.vendorId && existing.vendorId.toString() !== vendorId.toString()) {
            return { outcome: 'conflict', reason: 'a record with this id already belongs to another vendor' };
        }
        if (existing && !overwrite) {
            return { outcome: 'exists', reason: null };
        }
        if (!apply) {
            return { outcome: existing ? 'would-replace' : 'would-insert', reason: null };
        }

        try {
            if (existing) {
                await Model.findOneAndReplace({ _id: doc._id }, doc.toObject(), { timestamps: false });
                return { outcome: 'replaced', reason: null };
            }
            await doc.save({ timestamps: false });
            return { outcome: 'inserted', reason: null };
        } catch (writeErr) {
            if (writeErr && writeErr.code === 11000) {
                const fields = Object.keys(writeErr.keyValue || {}).filter(field => field !== 'vendorId').join(', ');
                return { outcome: 'duplicate', reason: `the new store already has a record with the same ${fields || 'unique value'}` };
            }
            throw writeErr;
        }
    } catch (err) {
        throw err;
    }
};

// A record that fails its own schema is reported and skipped; anything else
// (lost connection, bug) must still stop the run.
const describeValidationError = (err) => {
    try {
        if (err && err.name === 'ValidationError') {
            return Object.values(err.errors).map(e => e.message).join('; ');
        }
        return null;
    } catch (describeErr) {
        throw describeErr;
    }
};

module.exports = {
    deterministicObjectId,
    buildImageAsset,
    saveDocument,
    describeValidationError
};
