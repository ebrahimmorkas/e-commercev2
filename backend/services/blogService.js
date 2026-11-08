const Blog = require('../models/Blog');
const logger = require('../utils/logger');
const common = require('../utils/common');
const slugify = require('../utils/slugify');
const imageUploadService = require('./imageUploadService');

const BLOG_IMAGE_MODULE = 'blog';
const WORDS_PER_MINUTE = 200;

// Admin-only authoring, same trust level as the policy pages. This is only a
// defence-in-depth pass (it is not a full HTML sanitizer): it drops the tags
// and attributes that execute code.
const cleanContent = (html = '') => String(html)
    .replace(/<\s*(script|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');

const computeReadTime = (html = '') => {
    const words = String(html).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
};

const parseTags = (tags) => {
    if (!tags) return [];
    const unique = new Set(
        String(tags).split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.slice(0, 30))
    );
    return [...unique].slice(0, 10);
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A slug that is free for this vendor ("my-post", "my-post-2", ...).
const uniqueSlug = async (vendorId, base, excludeId = null) => {
    const root = slugify(base).slice(0, 170) || 'post';
    let candidate = root;
    for (let n = 2; n < 500; n++) {
        const filter = { vendorId, slug: candidate, status: { $in: ['A', 'I'] } };
        if (excludeId) filter._id = { $ne: excludeId };
        if (!(await Blog.exists(filter))) return candidate;
        candidate = `${root}-${n}`;
    }
    return `${root}-${Date.now()}`;
};

const uploadCover = async ({ vendorId, file, userId, companyMasterData, websiteMasterData }) => {
    const uploadResult = await imageUploadService.uploadImage({
        vendorId,
        module: BLOG_IMAGE_MODULE,
        file,
        userId,
        maxSizeField: 'allowedBannerImagesMB',
        allowedFormatsField: 'allowedBannerImagesFormat',
        companyMasterData,
        websiteMasterData
    });
    if (!uploadResult.isSuccess) return { result: uploadResult };
    return { image: uploadResult.meta.image };
};

const discardImage = async (imageId, userId) => {
    if (!imageId) return;
    try {
        await imageUploadService.deleteImage({ imageId, userId });
    } catch (err) {
        logger.logWarning('blogService - discardImage: could not remove image', err);
    }
};

// Published = Active AND its publish date has arrived (a future date means
// "scheduled" and stays hidden from the storefront until then).
const publishedFilter = (vendorId) => ({
    vendorId,
    status: 'A',
    publishedAt: { $lte: new Date() }
});

const addBlog = async (vendorId, userId, data, file, companyMasterData, websiteMasterData) => {
    let uploaded = null;
    try {
        const slug = await uniqueSlug(vendorId, data.slug || data.title);

        if (file) {
            const cover = await uploadCover({ vendorId, file, userId, companyMasterData, websiteMasterData });
            if (cover.result) return cover.result;
            uploaded = cover.image;
        }

        const status = data.status || 'I';
        const content = cleanContent(data.content);
        const blog = new Blog({
            vendorId,
            title: data.title,
            slug,
            excerpt: data.excerpt || '',
            content,
            coverImage: uploaded ? uploaded.url : null,
            coverImageAssetId: uploaded ? uploaded._id : null,
            category: data.category || '',
            tags: parseTags(data.tags),
            authorName: data.authorName || '',
            readTimeMinutes: computeReadTime(content),
            isFeatured: !!data.isFeatured,
            metaTitle: data.metaTitle || '',
            metaDescription: data.metaDescription || '',
            status,
            // Published straight away unless a date was chosen.
            publishedAt: status === 'A' ? (data.publishedAt || new Date()) : (data.publishedAt || null),
            createdBy: userId,
            updatedBy: userId
        });
        const saved = await blog.save();
        logger.logInfo(1, 0, 'Blog created', { vendorId, blogId: saved._id });
        return common.returnResult(true, 201, 'Blog post created successfully', { blog: saved });
    } catch (err) {
        // The upload happens before the save, so a failed save must not leave the file behind.
        await discardImage(uploaded?._id, userId);
        if (err && err.code === 11000) {
            return common.returnResult(false, 409, 'A post with this slug already exists. Please try again.');
        }
        throw err;
    }
};

const updateBlog = async (vendorId, userId, blogId, data, file, companyMasterData, websiteMasterData) => {
    let uploaded = null;
    try {
        const blog = await Blog.findOne({ _id: blogId, vendorId, status: { $ne: 'D' } });
        if (!blog) return common.returnResult(false, 404, 'Blog post not found');

        const oldImageId = blog.coverImageAssetId;

        if (file) {
            const cover = await uploadCover({ vendorId, file, userId, companyMasterData, websiteMasterData });
            if (cover.result) return cover.result;
            uploaded = cover.image;
            blog.coverImage = uploaded.url;
            blog.coverImageAssetId = uploaded._id;
        } else if (data.removeCoverImage) {
            blog.coverImage = null;
            blog.coverImageAssetId = null;
        }

        if (data.title !== undefined) blog.title = data.title;
        if (data.slug) blog.slug = await uniqueSlug(vendorId, data.slug, blog._id);
        if (data.excerpt !== undefined) blog.excerpt = data.excerpt || '';
        if (data.content !== undefined) {
            blog.content = cleanContent(data.content);
            blog.readTimeMinutes = computeReadTime(blog.content);
        }
        if (data.category !== undefined) blog.category = data.category || '';
        if (data.tags !== undefined) blog.tags = parseTags(data.tags);
        if (data.authorName !== undefined) blog.authorName = data.authorName || '';
        if (data.isFeatured !== undefined) blog.isFeatured = !!data.isFeatured;
        if (data.metaTitle !== undefined) blog.metaTitle = data.metaTitle || '';
        if (data.metaDescription !== undefined) blog.metaDescription = data.metaDescription || '';
        if (data.publishedAt !== undefined) blog.publishedAt = data.publishedAt || null;

        if (data.status && data.status !== blog.status) {
            blog.status = data.status;
            if (data.status === 'A') {
                blog.activeMarkedBy = userId;
                blog.activeMarkedDate = new Date();
            } else {
                blog.inActiveMarkedBy = userId;
                blog.inactiveMarkedDate = new Date();
            }
        }
        // Publishing without a date means "now".
        if (blog.status === 'A' && !blog.publishedAt) blog.publishedAt = new Date();
        blog.updatedBy = userId;

        const saved = await blog.save();
        // Only now is the previous cover unreferenced.
        if (oldImageId && String(oldImageId) !== String(saved.coverImageAssetId || '')) {
            await discardImage(oldImageId, userId);
        }
        return common.returnResult(true, 200, 'Blog post updated successfully', { blog: saved });
    } catch (err) {
        await discardImage(uploaded?._id, userId);
        if (err && err.code === 11000) {
            return common.returnResult(false, 409, 'A post with this slug already exists.');
        }
        throw err;
    }
};

const softDeleteBlog = async (vendorId, userId, blogId) => {
    try {
        const blog = await Blog.findOne({ _id: blogId, vendorId, status: { $ne: 'D' } });
        if (!blog) return common.returnResult(false, 404, 'Blog post not found');

        const imageId = blog.coverImageAssetId;
        blog.status = 'D';
        blog.deletedBy = userId;
        blog.updatedBy = userId;
        await blog.save();
        await discardImage(imageId, userId);
        return common.returnResult(true, 200, 'Blog post deleted successfully');
    } catch (err) {
        throw err;
    }
};

const setBlogStatus = async (vendorId, userId, blogId, status) => {
    try {
        const blog = await Blog.findOne({ _id: blogId, vendorId, status: { $ne: 'D' } });
        if (!blog) return common.returnResult(false, 404, 'Blog post not found');

        if (status === 'A') {
            blog.activeMarkedBy = userId;
            blog.activeMarkedDate = new Date();
            if (!blog.publishedAt) blog.publishedAt = new Date();
        } else {
            blog.inActiveMarkedBy = userId;
            blog.inactiveMarkedDate = new Date();
        }
        blog.status = status;
        blog.updatedBy = userId;
        await blog.save();
        return common.returnResult(true, 200, `Blog post ${status === 'A' ? 'published' : 'moved to drafts'} successfully`);
    } catch (err) {
        throw err;
    }
};

const bulkSetBlogStatus = async (vendorId, userId, blogIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            blogIds,
            (id) => setBlogStatus(vendorId, userId, id, status)
        );
        logger.logInfo(successCount, failureCount, 'Bulk blog status update completed', { vendorId, status });
        return common.returnResult(true, 200, `${successCount} updated, ${failureCount} failed`, { results, successCount, failureCount });
    } catch (err) {
        throw err;
    }
};

const bulkDeleteBlogs = async (vendorId, userId, blogIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            blogIds,
            (id) => softDeleteBlog(vendorId, userId, id)
        );
        logger.logInfo(successCount, failureCount, 'Bulk blog delete completed', { vendorId });
        return common.returnResult(true, 200, `${successCount} deleted, ${failureCount} failed`, { results, successCount, failureCount });
    } catch (err) {
        throw err;
    }
};

const fetchBlogsAdmin = async (vendorId, { page = 1, limit = 20, search = '', status = '' }) => {
    try {
        const filter = { vendorId, status: status ? status : { $in: ['A', 'I'] } };
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ title: pattern }, { category: pattern }, { tags: pattern }];
        }
        const [blogs, total] = await Promise.all([
            Blog.find(filter, { content: 0 }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Blog.countDocuments(filter)
        ]);
        return common.returnResult(true, 200, 'Blog posts fetched successfully', {
            blogs, total, page, limit, hasMore: page * limit < total
        });
    } catch (err) {
        throw err;
    }
};

const fetchBlogByIdAdmin = async (vendorId, blogId) => {
    try {
        const blog = await Blog.findOne({ _id: blogId, vendorId, status: { $ne: 'D' } }).lean();
        if (!blog) return common.returnResult(false, 404, 'Blog post not found');
        return common.returnResult(true, 200, 'Blog post fetched successfully', { blog });
    } catch (err) {
        throw err;
    }
};

// Storefront list - content is left out (the card only needs the excerpt).
const fetchPublishedBlogs = async (vendorId, { page = 1, limit = 9, search = '', category = '' }) => {
    try {
        const filter = publishedFilter(vendorId);
        if (category) filter.category = category;
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ title: pattern }, { excerpt: pattern }, { tags: pattern }];
        }
        const [blogs, total, categoryRows] = await Promise.all([
            Blog.find(filter, { content: 0 }).sort({ isFeatured: -1, publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Blog.countDocuments(filter),
            Blog.aggregate([
                { $match: { ...publishedFilter(vendorId), category: { $ne: '' } } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } }
            ])
        ]);
        return common.returnResult(true, 200, 'Blog posts fetched successfully', {
            blogs,
            total,
            page,
            limit,
            hasMore: page * limit < total,
            categories: categoryRows.map((row) => ({ name: row._id, count: row.count }))
        });
    } catch (err) {
        throw err;
    }
};

const fetchPublishedBlogBySlug = async (vendorId, slug) => {
    try {
        const blog = await Blog.findOne({ ...publishedFilter(vendorId), slug }).lean();
        if (!blog) return common.returnResult(false, 404, 'Blog post not found');

        // Up to 3 more posts, preferring the same category.
        const related = await Blog.find(
            { ...publishedFilter(vendorId), _id: { $ne: blog._id } },
            { content: 0 }
        ).sort({ publishedAt: -1 }).limit(12).lean();
        const sorted = [
            ...related.filter((post) => blog.category && post.category === blog.category),
            ...related.filter((post) => !(blog.category && post.category === blog.category))
        ].slice(0, 3);

        return common.returnResult(true, 200, 'Blog post fetched successfully', { blog, related: sorted });
    } catch (err) {
        throw err;
    }
};

// Drives the navbar link: no published posts = no link.
const hasPublishedBlogs = async (vendorId) => {
    const found = await Blog.exists(publishedFilter(vendorId));
    return !!found;
};

module.exports = {
    addBlog,
    updateBlog,
    softDeleteBlog,
    bulkSetBlogStatus,
    bulkDeleteBlogs,
    fetchBlogsAdmin,
    fetchBlogByIdAdmin,
    fetchPublishedBlogs,
    fetchPublishedBlogBySlug,
    hasPublishedBlogs
};
