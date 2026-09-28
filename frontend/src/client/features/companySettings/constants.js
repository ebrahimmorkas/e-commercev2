// Every piece of long-form HTML content on CompanySettings that the
// storefront links to (footer + dedicated pages), and how to reach it.
// `path` must stay in sync with the PAGE routes matched in client/App.jsx's
// parseRoute.
export const POLICY_LINKS = [
  { key: 'aboutUs', label: 'About Us', path: '/about-us' },
  { key: 'privacyPolicy', label: 'Privacy Policy', path: '/privacy-policy' },
  { key: 'cancelPolicy', label: 'Cancellation Policy', path: '/cancellation-policy' },
  { key: 'returnRefundPolicy', label: 'Return & Refund Policy', path: '/return-refund-policy' },
  { key: 'termsAndConditions', label: 'Terms & Conditions', path: '/terms-and-conditions' },
];

export const getPolicyLinkByPath = (path) => POLICY_LINKS.find((link) => link.path === path) || null;
export const getPolicyLinkByKey = (key) => POLICY_LINKS.find((link) => link.key === key) || null;
