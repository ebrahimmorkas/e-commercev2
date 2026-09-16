import { useCallback, useEffect, useState } from 'react';
import * as companySettingsApi from '../api/companySettingsApi';
import * as lookupApi from '../api/lookupApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the CompanySettings singleton for the current vendor: fetching it (and
 * the CompanyMaster entitlement flags the form needs), and the save mutation,
 * which transparently picks create vs update based on whether a settings
 * document exists yet.
 */
export const useCompanySettings = () => {
  const [settings, setSettings] = useState(null);
  const [exists, setExists] = useState(false);
  const [companyMaster, setCompanyMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResult, companyMasterResult] = await Promise.allSettled([
        companySettingsApi.getCompanySettings(),
        lookupApi.getCompanyMasterData(),
      ]);

      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value);
        setExists(true);
      } else if (settingsResult.reason?.statusCode === 404) {
        setSettings(null);
        setExists(false);
      } else {
        setError(settingsResult.reason?.message || 'Failed to load company settings');
      }

      setCompanyMaster(companyMasterResult.status === 'fulfilled' ? companyMasterResult.value || null : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const save = async (fields, files) => {
    setSaving(true);
    try {
      const result = exists
        ? await companySettingsApi.updateCompanySettings(fields, files)
        : await companySettingsApi.createCompanySettings(fields, files);
      setSettings(result);
      setExists(true);
      toast.success(exists ? 'Company settings updated successfully' : 'Company settings created successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to save company settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    exists,
    companyMaster,
    loading,
    error,
    saving,
    save,
    refetch: fetchAll,
  };
};

export default useCompanySettings;
