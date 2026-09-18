const express = require('express');
const router = express.Router();
const { addAnnouncement, deleteAnnouncement, updateAnnouncement, getAllAnnouncements, getAllAnnouncementsAdmin, getAnnouncementById, bulkSetAnnouncementStatus, bulkDeleteAnnouncements } = require('../controllers/announcementController');
const { validateAddAnnouncement, validateDeleteAnnouncement, validateUpdateAnnouncement, bulkAnnouncementStatusSchema, bulkDeleteAnnouncementSchema } = require('../middlewares/validations/announcementValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');

router.post('/add-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateAddAnnouncement, addAnnouncement);
router.delete('/delete-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateDeleteAnnouncement, deleteAnnouncement);
router.put('/update-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateUpdateAnnouncement, updateAnnouncement);
router.get('/get-all-announcement', checkModuleAssigned('ANNOUNCEMENT'), getAllAnnouncements);
router.get('/get-all-announcement-admin', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), getAllAnnouncementsAdmin);
router.get('/get-announcement/:id', checkModuleAssigned('ANNOUNCEMENT'), getAnnouncementById);

router.patch('/bulk-status', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validate(bulkAnnouncementStatusSchema, 'body'), bulkSetAnnouncementStatus);
router.delete('/bulk-delete', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validate(bulkDeleteAnnouncementSchema, 'body'), bulkDeleteAnnouncements);

module.exports = router;