import StoreStatusLayout from './StoreStatusLayout';

const GEAR_PATH = 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z';

const Gear = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d={GEAR_PATH} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

// Two gears turning against each other.
const GearsIcon = () => (
  <div className="relative h-16 w-16">
    <Gear className="absolute left-0 top-0 h-12 w-12 animate-spin [animation-duration:9s] motion-reduce:animate-none" />
    <Gear className="absolute bottom-0 right-0 h-8 w-8 animate-spin [animation-direction:reverse] [animation-duration:6s] motion-reduce:animate-none" />
  </div>
);

/**
 * Shown instead of the storefront / admin panel while the store is under
 * maintenance (WebsiteMaster or CompanyMaster `showMaintenancePage`).
 *
 * @param {Object} props
 * @param {Object} [props.store] - Public store details from the store status endpoint.
 * @param {boolean} [props.isAdmin] - Rendering in place of the admin panel.
 */
const MaintenancePage = ({ store, isAdmin = false }) => {
  const companyName = store?.companyName?.trim() || 'Our store';

  return (
    <StoreStatusLayout
      accent="amber"
      icon={<GearsIcon />}
      badge="Under maintenance"
      title={isAdmin ? 'The admin panel will be back soon' : "We'll be back shortly"}
      description={
        isAdmin
          ? 'We are carrying out some maintenance right now, so the admin panel and your storefront are paused for a little while.'
          : `${companyName} is getting a quick tune-up so we can serve you better. Please check back in a little while.`
      }
      note={
        isAdmin
          ? 'Your products, orders and customers are safe. Nothing has been lost.'
          : 'Your account and your orders are safe.'
      }
      store={store}
      showContact={!isAdmin}
    />
  );
};

export default MaintenancePage;
