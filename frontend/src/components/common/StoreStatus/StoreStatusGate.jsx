import { useCallback, useEffect, useState } from 'react';
import { onStoreUnavailable } from '../../../utils/apiClient';
import { getStoreStatus, STORE_STATUS } from '../../../utils/storeStatusApi';
import Spinner from '../Spinner/Spinner';
import MaintenancePage from './MaintenancePage';
import PlanExpiredPage from './PlanExpiredPage';

/**
 * Decides whether the app may render at all. Asks the backend once at load
 * whether the store is open; while it is under maintenance or its plan has
 * expired, the matching full page replaces the app (storefront or admin
 * panel) - the app is never mounted, so it makes no API calls that would only
 * be refused. Mounted once around both apps (see main.jsx).
 *
 * Also covers a store that closes while someone is using it: the first
 * refused request (see onStoreUnavailable in apiClient) swaps the page in.
 *
 * If the status cannot be read (network problem), the app renders as usual.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.isAdmin] - Wrapping the admin panel (changes the wording).
 */
const StoreStatusGate = ({ children, isAdmin = false }) => {
  const [state, setState] = useState({ loading: true, status: null, store: null });

  const loadStatus = useCallback(
    () =>
      getStoreStatus()
        .then((data) => setState({ loading: false, status: data?.status || null, store: data?.store || null }))
        .catch(() => setState((previous) => ({ ...previous, loading: false }))),
    [],
  );

  useEffect(() => {
    loadStatus();
    // A refused request already says which page applies; re-read the status
    // only to get the store details (name, logo, contact) for it.
    onStoreUnavailable((status) => {
      setState((previous) => ({ ...previous, loading: false, status }));
      loadStatus();
    });
    return () => onStoreUnavailable(null);
  }, [loadStatus]);

  if (state.loading) return <Spinner fullScreen size="xl" color="gray" />;

  if (state.status === STORE_STATUS.MAINTENANCE) return <MaintenancePage store={state.store} isAdmin={isAdmin} />;
  if (state.status === STORE_STATUS.PLAN_EXPIRED) return <PlanExpiredPage store={state.store} isAdmin={isAdmin} />;

  return children;
};

export default StoreStatusGate;
