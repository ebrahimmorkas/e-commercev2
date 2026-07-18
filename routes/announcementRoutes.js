const express = require('express');
const router = express.Router();
const { addAnnouncement, deleteAnnouncement, updateAnnouncement, getAllAnnouncements, getAllAnnouncementsAdmin, getAnnouncementById } = require('../controllers/announcementController');
const { validateAddAnnouncement, validateDeleteAnnouncement, validateUpdateAnnouncement } = require('../middlewares/validations/announcementValidations');

router.post('/add-announcement', validateAddAnnouncement, addAnnouncement);
router.delete('/delete-announcement', validateDeleteAnnouncement, deleteAnnouncement);
router.put('/update-announcement', validateUpdateAnnouncement, updateAnnouncement);
router.get('/get-all-announcement', getAllAnnouncements);
router.get('/get-all-announcement-admin', getAllAnnouncementsAdmin);
router.get('/get-announcement/:id', getAnnouncementById);

module.exports = router;