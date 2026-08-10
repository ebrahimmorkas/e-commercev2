const express = require('express');
const router = express.Router();
const { addAnnouncement, deleteAnnouncement, updateAnnouncement, getAllAnnouncements, getAllAnnouncementsAdmin, getAnnouncementById } = require('../controllers/announcementController');
const { validateAddAnnouncement, validateDeleteAnnouncement, validateUpdateAnnouncement } = require('../middlewares/validations/announcementValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

router.post('/add-announcement', authenticate, authorize('admin'), validateAddAnnouncement, addAnnouncement);
router.delete('/delete-announcement', authenticate, authorize('admin'), validateDeleteAnnouncement, deleteAnnouncement);
router.put('/update-announcement', authenticate, authorize('admin'), validateUpdateAnnouncement, updateAnnouncement);
router.get('/get-all-announcement',  getAllAnnouncements);
router.get('/get-all-announcement-admin', authenticate, authorize('admin'), getAllAnnouncementsAdmin);
router.get('/get-announcement/:id', getAnnouncementById);

module.exports = router;