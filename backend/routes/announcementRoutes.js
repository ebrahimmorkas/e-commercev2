const express = require('express');
const router = express.Router();
const { addAnnouncement, deleteAnnouncement, updateAnnouncement, getAllAnnouncements, getAllAnnouncementsAdmin, getAnnouncementById } = require('../controllers/announcementController');
const { validateAddAnnouncement, validateDeleteAnnouncement, validateUpdateAnnouncement } = require('../middlewares/validations/announcementValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');

router.post('/add-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateAddAnnouncement, addAnnouncement);
router.delete('/delete-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateDeleteAnnouncement, deleteAnnouncement);
router.put('/update-announcement', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), validateUpdateAnnouncement, updateAnnouncement);
router.get('/get-all-announcement', checkModuleAssigned('ANNOUNCEMENT'), getAllAnnouncements);
router.get('/get-all-announcement-admin', authenticate, authorize('admin'), checkModuleAssigned('ANNOUNCEMENT'), getAllAnnouncementsAdmin);
router.get('/get-announcement/:id', checkModuleAssigned('ANNOUNCEMENT'), getAnnouncementById);

module.exports = router;