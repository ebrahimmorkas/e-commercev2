const express = require('express');
const router = express.Router();
const { addBrand, updateBrand, deleteBrand, getAllBrandsAdmin, getAllBrandsClient, getBrandById } = require('../controllers/brandMasterController');
const { addBrandSchema, updateBrandSchema, deleteBrandSchema, idParamSchema } = require('../middlewares/validations/brandMasterValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.post('/add-brand', authenticate, authorize('admin'), validate(addBrandSchema, 'body'), addBrand);
router.put('/update-brand', authenticate, authorize('admin'), validate(updateBrandSchema, 'body'), updateBrand);
router.delete('/delete-brand', authenticate, authorize('admin'), validate(deleteBrandSchema, 'body'), deleteBrand);
router.get('/get-all-brands-admin', authenticate, authorize('admin'), getAllBrandsAdmin);
router.get('/get-all-brands', getAllBrandsClient);
router.get('/get-brand/:id', authenticate, authorize('admin'), validate(idParamSchema, 'params'), getBrandById);

module.exports = router;
