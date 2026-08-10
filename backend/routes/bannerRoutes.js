const express = require('express');
const router = express.Router();
const { addBanner, deleteBanner, updateBanner, getAllBanners, getAllBannersAdmin, getBannerById } = require('../controllers/bannerController');
const bannerUpload = require('../middlewares/imageUpload');
const {validateAddBanner, validateDeleteBanner, validateUpdateBanner} = require('../middlewares/validations/bannerValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.post('/add-banner', authenticate, authorize('admin'), bannerUpload.single('image'), validateAddBanner, addBanner);
router.delete('/delete-banner', authenticate, authorize('admin'), validateDeleteBanner, deleteBanner);
router.put('/update-banner', authenticate, authorize('admin'), bannerUpload.single('image'), validateUpdateBanner, updateBanner);
router.get('/get-all-banner', getAllBanners);
router.get('/get-all-banner-admin', authenticate, authorize('admin'),getAllBannersAdmin);
router.get('/get-banner/:id', getBannerById);

module.exports = router;