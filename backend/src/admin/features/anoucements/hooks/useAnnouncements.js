import { useCallback, useEffect, useState } from 'react';
import * as announcementApi from '../api/announcementApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the announcements list state for the admin page: fetching, and the
 * create/update/delete/toggle mutations, each surfacing errors via toast
 * rather than throwing, so callers can just check the boolean result.
 */
export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await announcementApi.getAllAnnouncementsAdmin();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const createAnnouncement = async (payload) => {
    setMutating(true);
    try {
      await announcementApi.addAnnouncement(payload);
      toast.success('Announcement added successfully');
      await fetchAnnouncements();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to add announcement');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editAnnouncement = async (announcementId, payload) => {
    setMutating(true);
    try {
      await announcementApi.updateAnnouncement({ announcement_id: announcementId, ...payload });
      toast.success('Announcement updated successfully');
      await fetchAnnouncements();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update announcement');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeAnnouncement = async (announcementId) => {
    setMutating(true);
    try {
      await announcementApi.deleteAnnouncement(announcementId);
      toast.success('Announcement deleted successfully');
      await fetchAnnouncements();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete announcement');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = (announcement) => {
    const nextStatus = announcement.status === 'A' ? 'I' : 'A';
    return editAnnouncement(announcement._id, { status: nextStatus });
  };

  return {
    announcements,
    loading,
    error,
    mutating,
    refetch: fetchAnnouncements,
    createAnnouncement,
    editAnnouncement,
    removeAnnouncement,
    toggleStatus,
  };
};

export default useAnnouncements;
