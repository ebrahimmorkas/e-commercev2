import { useEffect, useState } from 'react';
import { apiRequest } from '../../../utils/apiClient';

/**
 * Fetches the vendor's effective feature switches (CompanyMaster AND
 * WebsiteMaster, computed by the backend as `featureAccess`). `featureAccess`
 * is null until loaded (or if the fetch fails) - callers treat null as
 * "unknown, show everything" so a slow request never blanks the UI.
 *
 * @param {boolean} enabled - Only fetches once true (e.g. once authenticated).
 */
export const useFeatureAccess = (enabled) => {
  const [featureAccess, setFeatureAccess] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiRequest('/company-master/get-company-master-data')
      .then((data) => {
        if (cancelled) return;
        // Delivery agents are gated by a plan number, not a flag: 0 = not on this plan.
        setFeatureAccess(
          data?.featureAccess
            ? { ...data.featureAccess, deliveryAgentsEnabled: (data.numberOfDeliveryAgentsAllowed ?? 1) > 0 }
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setFeatureAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return featureAccess;
};

export default useFeatureAccess;
