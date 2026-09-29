import { useCallback, useEffect, useState } from 'react';
import * as sendEmailApi from '../api/sendEmailApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Loads the compose-form options and sends emails for the Send Email page.
 * Sending answers straight away (delivery runs in the background), so a
 * successful send just bumps historyVersion for the History tab.
 */
export const useSendEmail = () => {
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const toast = useToast();

  const applyOptions = useCallback((data) => {
    setOptions(data);
    setError('');
  }, []);
  const applyError = useCallback((err) => setError(err.message || 'Could not load the Send Email page'), []);

  const load = useCallback(async () => {
    try {
      applyOptions(await sendEmailApi.getSendEmailOptions());
    } catch (err) {
      applyError(err);
    } finally {
      setLoading(false);
    }
  }, [applyOptions, applyError]);

  // First load - state is only set once the request settles.
  useEffect(() => {
    let cancelled = false;
    sendEmailApi
      .getSendEmailOptions()
      .then((data) => !cancelled && applyOptions(data))
      .catch((err) => !cancelled && applyError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applyOptions, applyError]);

  const send = async (fields, files) => {
    setSending(true);
    try {
      await sendEmailApi.sendEmail(fields, files);
      toast.success('Your email is being sent. You can follow it in the History tab.');
      setHistoryVersion((v) => v + 1);
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not send the email');
      return false;
    } finally {
      setSending(false);
    }
  };

  return { options, loading, error, sending, send, historyVersion, reload: load };
};

export default useSendEmail;
