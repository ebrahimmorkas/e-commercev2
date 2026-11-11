import { useEffect, useMemo, useState } from 'react';
import { getFieldConfigAdmin } from '../api/fieldConfigApi';
import { buildFieldConfigView } from '../utils/fieldConfigView';

// Fetched once per page load and shared by every screen (it only changes when
// the config script is run - a reload picks that up).
let cachedEntities = null;
let pendingRequest = null;

const loadFieldConfig = () => {
  if (!pendingRequest) {
    pendingRequest = getFieldConfigAdmin()
      .then((data) => {
        cachedEntities = data?.entities || {};
        return cachedEntities;
      })
      .catch((error) => {
        pendingRequest = null; // the next screen tries again
        throw error;
      });
  }
  return pendingRequest;
};

/**
 * The vendor's field config for one entity (e.g. 'product') as a view - see
 * buildFieldConfigView. Until it has loaded (or if it cannot be loaded) every
 * standard field shows and there are no custom fields; `isLoaded` tells which.
 */
export const useFieldConfig = (entity) => {
  const [entities, setEntities] = useState(cachedEntities);

  useEffect(() => {
    if (cachedEntities) return undefined;
    let alive = true;
    loadFieldConfig()
      .then((data) => {
        if (alive) setEntities(data);
      })
      .catch(() => {
        if (alive) setEntities({});
      });
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => buildFieldConfigView(entities?.[entity], entities !== null), [entities, entity]);
};

export default useFieldConfig;
