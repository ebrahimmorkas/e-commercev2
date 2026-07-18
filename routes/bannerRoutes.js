const express = require('express');
const router = express.Router();
const { addBanner, deleteBanner, updateBanner, getAllBanners, getAllBannersAdmin, getBannerById } = require('../controllers/bannerController');
const createUploader = require('../middlewares/multer/fileUpload');
const bannerUpload = createUploader({ folder: 'uploads/banners', maxSizeMB: 5 });
const {validateAddBanner, validateDeleteBanner, validateUpdateBanner} = require('../middlewares/validations/bannerValidations');

router.post('/add-banner', bannerUpload.single('image'), validateAddBanner, addBanner);
router.delete('/delete-banner', validateDeleteBanner, deleteBanner);
router.put('/update-banner', bannerUpload.single('image'), validateUpdateBanner, updateBanner);
router.get('/get-all-banner', getAllBanners);
router.get('/get-all-banner-admin', getAllBannersAdmin);
router.get('/get-banner/:id', getBannerById);

module.exports = router;