import { useEffect, useState } from 'react';
import * as moduleMasterApi from '../api/moduleMasterApi';

/**
 * Fetches which modules are currently assigned to the logged-in admin's
 * vendor, for filtering the sidebar. `assignedCodes` is null until the first
 * fetch resolves (or if it fails) - callers should treat null as "show
 * everything" rather than "show nothing", so a slow/failed request never
 * hides the whole sidebar.
 *
 * @param {boolean} enabled - Only fetches once true (e.g. once authenticated).
 */
export const useAssignedModules = (enabled) => {
  const [assignedCodes, setAssignedCodes] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    setLoading(true);

    moduleMasterApi
      .getMyAssignedModules()
      .then((modules) => {
        if (cancelled) return;
        setAssignedCodes(new Set((modules || []).map((m) => m.code)));
      })
      .catch(() => {
        if (!cancelled) setAssignedCodes(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { assignedCodes, loading };
};

export default useAssignedModules;
