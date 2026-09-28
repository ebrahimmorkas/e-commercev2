const express = require('express');
const router = express.Router();
const { addCourier, updateCourier, deleteCourier, getAllCouriersAdmin, getActiveCouriers, getCourierById, bulkSetCourierStatus, bulkDeleteCouriers } = require('../controllers/courierMasterController');
const { addCourierSchema, updateCourierSchema, deleteCourierSchema, idParamSchema, bulkCourierStatusSchema, bulkDeleteCourierSchema } = require('../middlewares/validations/courierMasterValidations');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

// Admin only - couriers are never shown to customers directly (they only
// see the courier name on their order / in emails).
const adminAccess = [authenticate, authorize('admin'), checkModuleAssigned('COURIER')];

router.post('/add-courier', ...adminAccess, validate(addCourierSchema, 'body'), addCourier);
router.put('/update-courier', ...adminAccess, validate(updateCourierSchema, 'body'), updateCourier);
router.delete('/delete-courier', ...adminAccess, validate(deleteCourierSchema, 'body'), deleteCourier);
router.get('/get-all-couriers-admin', ...adminAccess, getAllCouriersAdmin);
// Active couriers only, for the order modal's courier dropdown.
router.get('/get-active-couriers', ...adminAccess, getActiveCouriers);
router.get('/get-courier/:id', ...adminAccess, validate(idParamSchema, 'params'), getCourierById);

router.patch('/bulk-status', ...adminAccess, validate(bulkCourierStatusSchema, 'body'), bulkSetCourierStatus);
router.delete('/bulk-delete', ...adminAccess, validate(bulkDeleteCourierSchema, 'body'), bulkDeleteCouriers);

module.exports = router;
