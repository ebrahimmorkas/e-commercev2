const express = require('express');
const router = express.Router();
const {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategories,
    getAdminCategories
} = require('../controllers/categoryController');
const createMemoryUploader = require('../middlewares/multer/memoryFileUpload');
const categoryUpload = createMemoryUploader({ maxSizeMB: 5 });
const validate = require('../middlewares/validate');
const {
    addCategorySchema,
    updateCategorySchema,
    deleteCategorySchema
} = require('../middlewares/validations/categoryValidations');
// const authorize = require('../middlewares/authorize');
// TODO: add authorize('admin') to add/update/delete/get-admin-categories once you wire it in.

router.post('/add-category', categoryUpload.single('image'), validate(addCategorySchema, 'body'), addCategory);
router.put('/update-category', categoryUpload.single('image'), validate(updateCategorySchema, 'body'), updateCategory);
router.delete('/delete-category', validate(deleteCategorySchema, 'body'), deleteCategory);
router.get('/get-categories', getCategories);
router.get('/get-admin-categories', getAdminCategories);

module.exports = router;