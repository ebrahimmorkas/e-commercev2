import { useState } from 'react';
import { useStorefrontCompanySettings } from '../../../features/companySettings/hooks/useStorefrontCompanySettings';
import { POLICY_LINKS } from '../../../features/companySettings/constants';
import PolicyModal from '../../../features/companySettings/components/PolicyModal';

/** Minimal theme footer: one slim row - name, policy links, copyright. */
const MinimalFooter = ({ onOpenPolicyPage }) => {
  const { companySettings } = useStorefrontCompanySettings();
  const [activeLink, setActiveLink] = useState(null);
  const brandName = companySettings?.companyName?.trim() || 'Our Store';
  const isModalMode = companySettings?.policyDisplayMode === 'MODAL';
  const links = POLICY_LINKS.filter((link) => companySettings?.[link.key]?.trim());

  const handleClick = (link) => (isModalMode ? setActiveLink(link) : onOpenPolicyPage?.(link));

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-medium text-slate-900">{brandName}</p>
        {links.length > 0 && (
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Policies">
            {links.map((link) => (
              <button key={link.key} type="button" onClick={() => handleClick(link)} className="cursor-pointer hover:text-slate-900">
                {link.label}
              </button>
            ))}
          </nav>
        )}
        <p>&copy; {new Date().getFullYear()} {brandName}</p>
      </div>
      {isModalMode && (
        <PolicyModal link={activeLink} html={activeLink ? companySettings?.[activeLink.key] : ''} onClose={() => setActiveLink(null)} />
      )}
    </footer>
  );
};

export default MinimalFooter;
