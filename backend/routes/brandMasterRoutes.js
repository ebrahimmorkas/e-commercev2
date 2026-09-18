const express = require('express');
const router = express.Router();
const { addBrand, updateBrand, deleteBrand, getAllBrandsAdmin, getAllBrandsClient, getBrandById, bulkSetBrandStatus, bulkDeleteBrands } = require('../controllers/brandMasterController');
const { addBrandSchema, updateBrandSchema, deleteBrandSchema, idParamSchema, bulkBrandStatusSchema, bulkDeleteBrandSchema } = require('../middlewares/validations/brandMasterValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

router.post('/add-brand', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(addBrandSchema, 'body'), addBrand);
router.put('/update-brand', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(updateBrandSchema, 'body'), updateBrand);
router.delete('/delete-brand', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(deleteBrandSchema, 'body'), deleteBrand);
router.get('/get-all-brands-admin', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), getAllBrandsAdmin);
router.get('/get-all-brands', checkModuleAssigned('BRAND'), getAllBrandsClient);
router.get('/get-brand/:id', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(idParamSchema, 'params'), getBrandById);

router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(bulkBrandStatusSchema, 'body'), bulkSetBrandStatus);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('BRAND'), validate(bulkDeleteBrandSchema, 'body'), bulkDeleteBrands);

module.exports = router;
