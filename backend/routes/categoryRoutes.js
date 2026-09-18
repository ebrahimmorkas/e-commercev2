const express = require('express');
const router = express.Router();
const { addCategory, updateCategory, deleteCategory, getCategories, getAdminCategories, bulkUploadCategories, bulkSetCategoryStatus, bulkDeleteCategories } = require('../controllers/categoryController');
const createMemoryUploader = require('../middlewares/multer/memoryFileUpload');
const categoryUpload = createMemoryUploader({ maxSizeMB: 5 });
const validate = require('../middlewares/validate');
const { addCategorySchema, updateCategorySchema, deleteCategorySchema, bulkCategoryStatusSchema, bulkDeleteCategorySchema } = require('../middlewares/validations/categoryValidations');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
const categoryBulkUpload = createBulkUploader();
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
// TODO: add authorize('admin') to add/update/delete/get-admin-categories once you wire it in.

router.post('/add-category', checkModuleAssigned('CATEGORIES'), categoryUpload.single('image'), validate(addCategorySchema, 'body'), addCategory);
router.put('/update-category', checkModuleAssigned('CATEGORIES'), categoryUpload.single('image'), validate(updateCategorySchema, 'body'), updateCategory);
router.delete('/delete-category', checkModuleAssigned('CATEGORIES'), validate(deleteCategorySchema, 'body'), deleteCategory);
router.get('/get-categories', checkModuleAssigned('CATEGORIES'), getCategories);
router.get('/get-admin-categories', checkModuleAssigned('CATEGORIES'), getAdminCategories);
router.post('/bulk-upload-categories', checkModuleAssigned('CATEGORIES'), categoryBulkUpload, bulkUploadCategories);

// Bulk multi-select actions (frontend checkbox selection) - the only routes
// on this router with real authenticate/authorize('admin') wired in, same
// situation as productRoutes' clone routes.
router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('CATEGORIES'), validate(bulkCategoryStatusSchema, 'body'), bulkSetCategoryStatus);

router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('CATEGORIES'), validate(bulkDeleteCategorySchema, 'body'), bulkDeleteCategories);

module.exports = router;