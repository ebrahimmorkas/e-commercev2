import { useCallback, useEffect, useState } from 'react';
import * as bannerApi from '../api/bannerApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the banners list state for the admin page: fetching, and the
 * create/update/delete/toggle mutations, each surfacing errors via toast
 * rather than throwing, so callers can just check the boolean result.
 */
export const useBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bannerApi.getAllBannersAdmin();
      setBanners(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load banners');
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const createBanner = async (fields, media) => {
    setMutating(true);
    try {
      await bannerApi.addBanner(fields, media);
      toast.success('Banner added successfully');
      await fetchBanners();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to add banner');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editBanner = async (bannerId, fields, media) => {
    setMutating(true);
    try {
      await bannerApi.updateBanner(bannerId, fields, media);
      toast.success('Banner updated successfully');
      await fetchBanners();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update banner');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeBanner = async (bannerId) => {
    setMutating(true);
    try {
      await bannerApi.deleteBanner(bannerId);
      toast.success('Banner deleted successfully');
      await fetchBanners();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete banner');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = (banner) => {
    const nextStatus = banner.status === 'A' ? 'I' : 'A';
    return editBanner(banner._id, { status: nextStatus }, {});
  };

  return {
    banners,
    loading,
    error,
    mutating,
    refetch: fetchBanners,
    createBanner,
    editBanner,
    removeBanner,
    toggleStatus,
  };
};

export default useBanners;
