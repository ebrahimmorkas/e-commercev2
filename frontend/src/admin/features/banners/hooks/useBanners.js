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

  // --- Bulk multi-select actions (checkbox column) --------------------------
  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) {
      toast.success(`${successCount} banner(s) ${pastTenseVerb}`);
    } else if (successCount === 0) {
      toast.error(`Could not ${pastTenseVerb === 'deleted' ? 'delete' : 'update'} the selected banner(s)`);
    } else {
      toast.warning(`${successCount} banner(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
    }
  };

  const bulkToggleStatus = async (bannerIds, status) => {
    if (!bannerIds || bannerIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await bannerApi.bulkSetBannerStatus(bannerIds, status);
      describeBulkOutcome(data, status === 'A' ? 'activated' : 'deactivated');
      await fetchBanners();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update banner status');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveBanners = async (bannerIds) => {
    if (!bannerIds || bannerIds.length === 0) return null;
    setMutating(true);
    try {
      const data = await bannerApi.bulkDeleteBanners(bannerIds);
      describeBulkOutcome(data, 'deleted');
      await fetchBanners();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete banners');
      return null;
    } finally {
      setMutating(false);
    }
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
    bulkToggleStatus,
    bulkRemoveBanners,
  };
};

export default useBanners;
