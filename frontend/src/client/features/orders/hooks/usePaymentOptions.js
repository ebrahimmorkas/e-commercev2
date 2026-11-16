import { useCallback, useEffect, useState } from 'react';
import { getPaymentOptions } from '../api/paymentApi';

/**
 * The payment choices the store offers at checkout.
 * `loading` is true until the answer is in. If the request fails, `options`
 * is null and `error` says why - checkout then blocks the order (it can't
 * tell whether Cash on Delivery is allowed) and offers to report it.
 * `reload()` asks again.
 *
 * @returns {{ options: null | { cod: boolean, online: Object|null }, loading: boolean, error: string, reload: Function }}
 */
export const usePaymentOptions = () => {
  const [state, setState] = useState({ options: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPaymentOptions()
      .then((options) => {
        if (!cancelled) setState({ options, loading: false, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ options: null, loading: false, error: err?.message || 'Could not load the payment options.' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
};

export default usePaymentOptions;
