import { useEffect, useState } from 'react';
import { getBankFields } from '../api/companySettingsApi';

const EMPTY = { countryId: '', country: null, fields: [], error: '' };

/**
 * The bank detail fields of the store country (BankFieldTemplate on the
 * backend) - refetched whenever the store country changes, including one just
 * picked on the General tab and not saved yet.
 *
 * @param {string} countryId - draft.storeCountryId ('' = none chosen)
 * @param {boolean} enabled - false skips the request (Bank Transfer not available)
 * @returns {{ country: Object|null, fields: Array<Object>, loading: boolean, error: string }}
 *   loading stays true until the fields of THIS countryId have arrived, so
 *   the page never saves values against another country's fields.
 */
export const useBankFields = (countryId, enabled = true) => {
  const [result, setResult] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !countryId) return undefined;
    let cancelled = false;
    getBankFields(countryId)
      .then((data) => {
        if (!cancelled) setResult({ countryId, country: data?.country || null, fields: data?.fields || [], error: '' });
      })
      .catch((err) => {
        if (!cancelled) setResult({ countryId, country: null, fields: [], error: err?.message || 'Could not load the bank fields.' });
      });
    return () => {
      cancelled = true;
    };
  }, [countryId, enabled]);

  if (!enabled || !countryId) return { country: null, fields: [], loading: false, error: '' };
  const isCurrent = result.countryId === countryId;
  return {
    country: isCurrent ? result.country : null,
    fields: isCurrent ? result.fields : [],
    loading: !isCurrent,
    error: isCurrent ? result.error : '',
  };
};

export default useBankFields;
