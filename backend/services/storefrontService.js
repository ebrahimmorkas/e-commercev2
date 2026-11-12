const StorefrontSettings = require('../models/StorefrontSettings');
const common = require('../utils/common');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const { SECTION_DEFAULTS, defaultConfig } = require('../constants/storefrontConstants');

// Turns whatever is stored into a complete config: missing fields fall back to
// defaults, and any section type the vendor has not seen yet (e.g. one added in a
// later release) is appended in its default order, so new sections never break an
// existing vendor's saved layout.
const normalizeConfig = (raw) => {
    const base = defaultConfig();
    if (!raw) return base;
    const seen = new Set();
    const sections = [];
    (raw.sections || []).forEach((s) => {
        if (s && !seen.has(s.type)) {
            seen.add(s.type);
            sections.push({ type: s.type, enabled: s.enabled !== false });
        }
    });
    SECTION_DEFAULTS.forEach((s) => {
        if (!seen.has(s.type)) sections.push({ ...s });
    });
    return {
        themeCode: raw.themeCode || base.themeCode,
        primaryColor: raw.primaryColor || null,
        fontFamily: raw.fontFamily || null,
        sections,
    };
};

const sameConfig = (a, b) => JSON.stringify(normalizeConfig(a)) === JSON.stringify(normalizeConfig(b));

// Shoppers: the published config only (defaults if the vendor never published).
const getPublishedConfig = async (vendorId) => {
    try {
        const doc = await StorefrontSettings.findOne({ vendorId }).lean();
        return common.returnResult(true, 200, 'Storefront config fetched', { config: normalizeConfig(doc?.published) });
    } catch (err) {
        throw err;
    }
};

// Admin: both copies plus whether they differ.
const getAdminView = async (vendorId) => {
    try {
        const doc = await StorefrontSettings.findOne({ vendorId }).lean();
        const published = normalizeConfig(doc?.published);
        const draft = doc?.draft ? normalizeConfig(doc.draft) : published;
        return common.returnResult(true, 200, 'Storefront settings fetched', {
            draft,
            published,
            hasUnpublishedChanges: !sameConfig(draft, published),
            publishedAt: doc?.publishedAt || null,
        });
    } catch (err) {
        throw err;
    }
};

const saveDraft = async (vendorId, userId, data) => {
    try {
        const draft = normalizeConfig(data);
        await StorefrontSettings.findOneAndUpdate(
            { vendorId },
            { $set: { draft, updatedBy: userId } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        return common.returnResult(true, 200, 'Draft saved', { draft });
    } catch (err) {
        throw err;
    }
};

const publish = async (vendorId, userId) => {
    try {
        const doc = await StorefrontSettings.findOne({ vendorId });
        if (!doc || !doc.draft) return common.returnResult(false, 400, 'Nothing to publish - save a draft first');
        doc.published = normalizeConfig(doc.draft);
        doc.publishedAt = new Date();
        doc.updatedBy = userId;
        await doc.save();
        await redisService.del(redisKeys.storefrontConfig(vendorId));
        return common.returnResult(true, 200, 'Storefront published', { published: doc.published });
    } catch (err) {
        throw err;
    }
};

// Throw away unpublished edits.
const discardDraft = async (vendorId, userId) => {
    try {
        const doc = await StorefrontSettings.findOne({ vendorId });
        if (!doc) return common.returnResult(true, 200, 'Nothing to discard', { draft: defaultConfig() });
        doc.draft = normalizeConfig(doc.published);
        doc.updatedBy = userId;
        await doc.save();
        return common.returnResult(true, 200, 'Draft discarded', { draft: normalizeConfig(doc.draft) });
    } catch (err) {
        throw err;
    }
};

module.exports = { normalizeConfig, getPublishedConfig, getAdminView, saveDraft, publish, discardDraft };
