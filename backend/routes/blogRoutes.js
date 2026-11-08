const express = require('express');
const router = express.Router();
const {
    addBlog, updateBlog, deleteBlog, getAllBlogsAdmin, getBlogByIdAdmin,
    getPublishedBlogs, getPublishedBlogBySlug, bulkSetBlogStatus, bulkDeleteBlogs
} = require('../controllers/blogController');
const {
    addBlogSchema, updateBlogSchema, deleteBlogSchema, idParamSchema, slugParamSchema,
    adminListQuerySchema, publicListQuerySchema, bulkBlogStatusSchema, bulkDeleteBlogSchema
} = require('../middlewares/validations/blogValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/imageUpload');

// Multipart (optional cover image) - multer must run before validation so the
// text fields are on req.body.
const coverUpload = upload.single('coverImage');
const blogAdmin = [authenticate, authorize('admin'), checkModuleAssigned('BLOG')];

// Admin. Fixed paths come before the /:id matchers.
router.post('/add-blog', ...blogAdmin, coverUpload, validate(addBlogSchema, 'body'), addBlog);
router.put('/update-blog', ...blogAdmin, coverUpload, validate(updateBlogSchema, 'body'), updateBlog);
router.delete('/delete-blog', ...blogAdmin, validate(deleteBlogSchema, 'body'), deleteBlog);
router.get('/get-all-blogs-admin', ...blogAdmin, validate(adminListQuerySchema, 'query'), getAllBlogsAdmin);
router.patch('/bulk-status', ...blogAdmin, validate(bulkBlogStatusSchema, 'body'), bulkSetBlogStatus);
router.delete('/bulk-delete', ...blogAdmin, validate(bulkDeleteBlogSchema, 'body'), bulkDeleteBlogs);
router.get('/get-blog-admin/:id', ...blogAdmin, validate(idParamSchema, 'params'), getBlogByIdAdmin);

// Storefront (public) - published posts only.
router.get('/get-blogs', checkModuleAssigned('BLOG'), validate(publicListQuerySchema, 'query'), getPublishedBlogs);
router.get('/get-blog/:slug', checkModuleAssigned('BLOG'), validate(slugParamSchema, 'params'), getPublishedBlogBySlug);

module.exports = router;
