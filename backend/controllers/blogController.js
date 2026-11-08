const blogService = require('../services/blogService');
const logger = require('../utils/logger');
const common = require('../utils/common');

const FLAG = 'isBlogFeatureOn';

const encodeIf = (id) => (id ? common.encodeId(id) : id);

// Admin shape - every ObjectId encoded.
const formatBlogForAdmin = (blogDoc) => {
    if (!blogDoc) return blogDoc;
    const blog = blogDoc.toObject ? blogDoc.toObject() : blogDoc;
    return {
        ...blog,
        _id: encodeIf(blog._id),
        vendorId: encodeIf(blog.vendorId),
        coverImageAssetId: encodeIf(blog.coverImageAssetId),
        createdBy: encodeIf(blog.createdBy),
        updatedBy: encodeIf(blog.updatedBy),
        deletedBy: encodeIf(blog.deletedBy),
        activeMarkedBy: encodeIf(blog.activeMarkedBy),
        inActiveMarkedBy: encodeIf(blog.inActiveMarkedBy)
    };
};

// Storefront shape - only what a reader needs; no internal ids or audit fields.
const formatBlogForPublic = (blog) => ({
    _id: encodeIf(blog._id),
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt,
    ...(blog.content !== undefined ? { content: blog.content } : {}),
    coverImage: blog.coverImage,
    category: blog.category,
    tags: blog.tags,
    authorName: blog.authorName,
    readTimeMinutes: blog.readTimeMinutes,
    isFeatured: blog.isFeatured,
    metaTitle: blog.metaTitle,
    metaDescription: blog.metaDescription,
    publishedAt: blog.publishedAt
});

// Both switches (WebsiteMaster + CompanyMaster) must be on.
const checkFeature = (req) => common.checkFeatureOnOrOff(req.vendorId, req.websiteMasterData, req.companyMasterData, FLAG, FLAG);

// The vendor's own Company Settings toggle (the cached doc may predate the field).
const isBlogShown = (req) => req.companySettingsData?.showBlog !== false;

const addBlog = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const result = await blogService.addBlog(vendorId, req.user._id, req.body, req.file, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, formatBlogForAdmin(result.meta.blog));
    } catch (error) {
        logger.logException('blogController: addBlog - Exception while adding blog', { vendorId, error });
        return common.sendError(res, 500, 'Could not create the blog post.');
    }
};

const updateBlog = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const { blogId, ...data } = req.body;
        const result = await blogService.updateBlog(vendorId, req.user._id, common.decodeId(blogId), data, req.file, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, formatBlogForAdmin(result.meta.blog));
    } catch (error) {
        logger.logException('blogController: updateBlog - Exception while updating blog', { vendorId, error });
        return common.sendError(res, 500, 'Could not update the blog post.');
    }
};

const deleteBlog = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const result = await blogService.softDeleteBlog(vendorId, req.user._id, common.decodeId(req.body.blogId));
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('blogController: deleteBlog - Exception while deleting blog', { vendorId, error });
        return common.sendError(res, 500, 'Could not delete the blog post.');
    }
};

const getAllBlogsAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const result = await blogService.fetchBlogsAdmin(vendorId, req.query);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        const { blogs, ...paging } = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, { ...paging, blogs: blogs.map(formatBlogForAdmin) });
    } catch (error) {
        logger.logException('blogController: getAllBlogsAdmin - Exception while fetching blogs', { vendorId, error });
        return common.sendError(res, 500, 'Could not load the blog posts.');
    }
};

const getBlogByIdAdmin = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const result = await blogService.fetchBlogByIdAdmin(vendorId, common.decodeId(req.params.id));
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, formatBlogForAdmin(result.meta.blog));
    } catch (error) {
        logger.logException('blogController: getBlogByIdAdmin - Exception while fetching blog', { vendorId, error });
        return common.sendError(res, 500, 'Could not load the blog post.');
    }
};

const getPublishedBlogs = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);
        if (!isBlogShown(req)) return common.sendError(res, 403, 'The blog is not available right now.');

        const result = await blogService.fetchPublishedBlogs(vendorId, req.query);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        const { blogs, ...paging } = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, { ...paging, blogs: blogs.map(formatBlogForPublic) });
    } catch (error) {
        logger.logException('blogController: getPublishedBlogs - Exception while fetching blogs', { vendorId, error });
        return common.sendError(res, 500, 'Could not load the blog posts.');
    }
};

const getPublishedBlogBySlug = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);
        if (!isBlogShown(req)) return common.sendError(res, 403, 'The blog is not available right now.');

        const result = await blogService.fetchPublishedBlogBySlug(vendorId, req.params.slug);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, {
            blog: formatBlogForPublic(result.meta.blog),
            related: result.meta.related.map(formatBlogForPublic)
        });
    } catch (error) {
        logger.logException('blogController: getPublishedBlogBySlug - Exception while fetching blog', { vendorId, error });
        return common.sendError(res, 500, 'Could not load the blog post.');
    }
};

const bulkResponse = (result) => ({
    ...result.meta,
    results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
});

const bulkSetBlogStatus = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const ids = req.body.blogIds.map((id) => common.decodeId(id));
        const result = await blogService.bulkSetBlogStatus(vendorId, req.user._id, ids, req.body.status);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, bulkResponse(result));
    } catch (error) {
        logger.logException('blogController: bulkSetBlogStatus - Exception while bulk updating blog status', { vendorId, error });
        return common.sendError(res, 500, 'Could not update the blog posts.');
    }
};

const bulkDeleteBlogs = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const feature = await checkFeature(req);
        if (!feature.isSuccess) return common.sendError(res, feature.statusCode, feature.message);

        const ids = req.body.blogIds.map((id) => common.decodeId(id));
        const result = await blogService.bulkDeleteBlogs(vendorId, req.user._id, ids);
        if (!result.isSuccess) return common.sendError(res, result.statusCode, result.message);
        return common.sendSuccess(res, result.statusCode, result.message, bulkResponse(result));
    } catch (error) {
        logger.logException('blogController: bulkDeleteBlogs - Exception while bulk deleting blogs', { vendorId, error });
        return common.sendError(res, 500, 'Could not delete the blog posts.');
    }
};

module.exports = {
    addBlog,
    updateBlog,
    deleteBlog,
    getAllBlogsAdmin,
    getBlogByIdAdmin,
    getPublishedBlogs,
    getPublishedBlogBySlug,
    bulkSetBlogStatus,
    bulkDeleteBlogs
};
