import { useCallback, useEffect, useState } from 'react';
import * as companySettingsApi from '../api/companySettingsApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * The vendor's own email account (Company Settings > Email). Saved on its
 * own (not through the page's Save button), and only after the email server
 * accepted the sign-in. The password is never sent back - only hasPassword.
 *
 * @param {boolean} enabled - load only when the settings exist and email is on
 */
export const useEmailAccount = (enabled) => {
  const [account, setAccount] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null); // 'save' | 'test' | 'remove' | null
  const toast = useToast();

  const applyAccount = useCallback((data) => {
    setAccount(data?.emailAccount || null);
    setLoaded(true);
  }, []);

  // State is only set once the request settles.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    companySettingsApi
      .getEmailAccount()
      .then((data) => !cancelled && applyAccount(data))
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [enabled, applyAccount]);

  const run = async (kind, action, onSuccess) => {
    setBusy(kind);
    try {
      const data = await action();
      onSuccess(data);
      return true;
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    account,
    loaded,
    busy,
    save: (fields) =>
      run('save', () => companySettingsApi.saveEmailAccount(fields), (data) => {
        applyAccount(data);
        toast.success('Email account saved - the server accepted the sign-in.');
      }),
    sendTest: (to) => run('test', () => companySettingsApi.sendTestEmail(to), () => toast.success('Test email sent. Check the inbox.')),
    remove: () =>
      run('remove', () => companySettingsApi.removeEmailAccount(), () => {
        setAccount(null);
        toast.success('Email account removed. No emails will be sent until you add one again.');
      }),
  };
};

export default useEmailAccount;
