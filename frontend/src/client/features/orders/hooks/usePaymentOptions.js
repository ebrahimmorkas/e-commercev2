import { useEffect, useState } from 'react';
import { getPaymentOptions } from '../api/paymentApi';

/**
 * The payment choices the store offers at checkout, loaded once.
 * `loading` is true until the answer is in; if the request fails, `options`
 * is null and checkout places the order without asking (the same as before
 * this existed) rather than blocking the shopper.
 *
 * @returns {{ options: null | { cod: boolean, online: Object|null }, loading: boolean }}
 */
export const usePaymentOptions = () => {
  const [state, setState] = useState({ options: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    getPaymentOptions()
      .then((options) => {
        if (!cancelled) setState({ options, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ options: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

export default usePaymentOptions;
