import StoreStatusLayout from './StoreStatusLayout';

// A clock whose hands have stopped, gently floating.
const ClockIcon = () => (
  <svg className="h-14 w-14 animate-float-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

/**
 * Shown instead of the storefront / admin panel once the vendor's
 * subscription is over (WebsiteMaster or CompanyMaster `showPlanExpirePage`).
 * Customers are only told the store is unavailable; the reason (an expired
 * plan) is shown to the vendor's own admin panel only.
 *
 * @param {Object} props
 * @param {Object} [props.store] - Public store details from the store status endpoint.
 * @param {boolean} [props.isAdmin] - Rendering in place of the admin panel.
 */
const PlanExpiredPage = ({ store, isAdmin = false }) => {
  const companyName = store?.companyName?.trim() || '';

  return (
    <StoreStatusLayout
      accent="rose"
      icon={<ClockIcon />}
      badge={isAdmin ? 'Subscription expired' : 'Store unavailable'}
      title={isAdmin ? 'Your plan has expired' : 'This store is currently unavailable'}
      description={
        isAdmin
          ? `The subscription${companyName ? ` for ${companyName}` : ''} has ended, so your storefront and admin panel are paused. Renew your plan to pick up right where you left off.`
          : `${companyName || 'This store'} is not taking orders at the moment. Please check back later.`
      }
      note={
        isAdmin
          ? 'Your products, orders and customers are safe. Please contact your service provider to renew.'
          : undefined
      }
      store={store}
      showContact={!isAdmin}
      actionLabel={isAdmin ? 'I have renewed - check again' : 'Check again'}
    />
  );
};

export default PlanExpiredPage;
