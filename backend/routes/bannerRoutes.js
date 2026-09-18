const express = require('express');
const router = express.Router();
const { addBanner, deleteBanner, updateBanner, getAllBanners, getAllBannersAdmin, getBannerById, bulkSetBannerStatus, bulkDeleteBanners } = require('../controllers/bannerController');
const bannerMediaUpload = require('../middlewares/bannerMediaUpload');
const {validateAddBanner, validateDeleteBanner, validateUpdateBanner, bulkBannerStatusSchema, bulkDeleteBannerSchema} = require('../middlewares/validations/bannerValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');

router.post('/add-banner', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), bannerMediaUpload, validateAddBanner, addBanner);
router.delete('/delete-banner', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), validateDeleteBanner, deleteBanner);
router.put('/update-banner', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), bannerMediaUpload, validateUpdateBanner, updateBanner);
router.get('/get-all-banner', checkModuleAssigned('BANNER'), getAllBanners);
router.get('/get-all-banner-admin', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), getAllBannersAdmin);
router.get('/get-banner/:id', checkModuleAssigned('BANNER'), getBannerById);

router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), validate(bulkBannerStatusSchema, 'body'), bulkSetBannerStatus);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('BANNER'), validate(bulkDeleteBannerSchema, 'body'), bulkDeleteBanners);

module.exports = router;