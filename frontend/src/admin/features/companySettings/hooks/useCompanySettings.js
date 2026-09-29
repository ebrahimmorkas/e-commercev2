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
  const [orderSteps, setOrderSteps] = useState({ steps: [], lastStepCode: null, isDeliveryAgentAccessOn: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResult, companyMasterResult, orderStepsResult] = await Promise.allSettled([
        companySettingsApi.getCompanySettings(),
        lookupApi.getCompanyMasterData(),
        companySettingsApi.getAssignedOrderSteps(),
      ]);

      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value);
        setExists(true);
      } else if (
        settingsResult.reason?.statusCode === 404 &&
        settingsResult.reason?.message === 'Company settings not found'
      ) {
        // Only THIS exact 404 means "no settings document yet for this
        // vendor". A 404 can also come from checkModuleAssigned (e.g.
        // "Module with code ... not found" - an unrelated config/infra
        // problem, most likely right after a backend restart before
        // everything settles) - that must surface as a real error, not be
        // misread as "show the create form", or the user gets stuck: they
        // fill the form in again and creating fails with 409 "already
        // exists" since settings were there all along.
        setSettings(null);
        setExists(false);
      } else {
        setError(settingsResult.reason?.message || 'Failed to load company settings');
      }

      setCompanyMaster(companyMasterResult.status === 'fulfilled' ? companyMasterResult.value || null : null);
      if (orderStepsResult.status === 'fulfilled' && orderStepsResult.value) {
        setOrderSteps({
          steps: orderStepsResult.value.steps || [],
          lastStepCode: orderStepsResult.value.lastStepCode || null,
          isDeliveryAgentAccessOn: orderStepsResult.value.isDeliveryAgentAccessOn === true,
        });
      }
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
      let result;
      let usedUpdate = exists;
      if (exists) {
        result = await companySettingsApi.updateCompanySettings(fields, files);
      } else {
        try {
          result = await companySettingsApi.createCompanySettings(fields, files);
        } catch (err) {
          // Self-heal: if create says settings already exist (409), our
          // `exists` state was wrong (e.g. the initial load 404'd for an
          // unrelated reason - see fetchAll) - fall back to update instead
          // of leaving the admin stuck re-submitting a "Create" that can
          // never succeed.
          if (err.statusCode !== 409) throw err;
          result = await companySettingsApi.updateCompanySettings(fields, files);
          usedUpdate = true;
        }
      }
      setSettings(result);
      setExists(true);
      toast.success(usedUpdate ? 'Company settings updated successfully' : 'Company settings created successfully');
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
    orderSteps,
    loading,
    error,
    saving,
    save,
    refetch: fetchAll,
  };
};

export default useCompanySettings;
