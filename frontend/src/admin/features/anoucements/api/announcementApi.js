import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/announcements';

/**
 * Fetches all (active + inactive) announcements for the current vendor, admin view.
 */
export const getAllAnnouncementsAdmin = () =>
  apiRequest(`${BASE}/get-all-announcement-admin`);

/**
 * @param {Object} data - { name, heading, content, startDate, endDate, precedence }
 */
export const addAnnouncement = (data) =>
  apiRequest(`${BASE}/add-announcement`, { method: 'POST', body: data });

/**
 * @param {Object} data - { announcement_id, ...fields to update }
 */
export const updateAnnouncement = (data) =>
  apiRequest(`${BASE}/update-announcement`, { method: 'PUT', body: data });

/**
 * @param {string} announcementId
 */
export const deleteAnnouncement = (announcementId) =>
  apiRequest(`${BASE}/delete-announcement`, {
    method: 'DELETE',
    body: { announcement_id: announcementId },
  });

export default {
  getAllAnnouncementsAdmin,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
