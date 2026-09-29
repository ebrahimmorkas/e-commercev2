import { useState } from 'react';
import theme from './theme/theme';
import { InstagramIcon, FacebookIcon, MailIcon, PhoneIcon, MapPinIcon } from './icons';
import { useStorefrontCompanySettings } from '../../../features/companySettings/hooks/useStorefrontCompanySettings';
import { POLICY_LINKS } from '../../../features/companySettings/constants';
import PolicyModal from '../../../features/companySettings/components/PolicyModal';

const instagramUrl = (handle) => `https://instagram.com/${handle.replace(/^@/, '').trim()}`;
const facebookUrl = (handle) => `https://facebook.com/${handle.trim()}`;

/**
 * Bottom footer for the client-facing storefront - every field is sourced
 * from CompanySettings (see client/features/companySettings), not
 * hardcoded, so it reflects whatever the vendor filled in under admin
 * Company Settings. Sections/fields with no data are simply omitted rather
 * than shown empty.
 *
 * Policy/About links open as a dedicated page or a modal depending on the
 * vendor's own `policyDisplayMode` choice (Company Settings > Policies).
 *
 * @param {(link: {key: string, label: string, path: string}) => void} props.onOpenPolicyPage
 */
const Footer = ({ onOpenPolicyPage }) => {
  const { companySettings } = useStorefrontCompanySettings();
  const [activeModalLink, setActiveModalLink] = useState(null);

  const brandName = companySettings?.companyName?.trim() || 'Our Store';
  const logoUrl = companySettings?.companyLogo?.url;
  const isModalMode = companySettings?.policyDisplayMode === 'MODAL';

  const availableLinks = POLICY_LINKS.filter((link) => companySettings?.[link.key]?.trim());

  const handleLinkClick = (link) => {
    if (isModalMode) {
      setActiveModalLink(link);
    } else {
      onOpenPolicyPage?.(link);
    }
  };

  const hasContact = !!(companySettings?.contactEmail || companySettings?.contactPhoneNumber || companySettings?.contactAddress);
  const hasSocial = !!(companySettings?.instagramId || companySettings?.facebookId);

  return (
    <footer className={`border-t ${theme.footer.background} ${theme.footer.border}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-10 w-auto object-contain mb-3" />
          ) : (
            <p className={`text-lg font-bold ${theme.brand.text}`}>{brandName}</p>
          )}
          {companySettings?.aboutUs?.trim() && (
            <p className={`mt-2 text-sm ${theme.tagline.text} line-clamp-4`}>
              {companySettings.aboutUs.replace(/<[^>]+>/g, ' ').trim().slice(0, 160)}
            </p>
          )}
        </div>

        {availableLinks.length > 0 && (
          <div>
            <h3 className={theme.heading.text}>Policies</h3>
            <ul className="mt-4 space-y-2">
              {availableLinks.map((link) => (
                <li key={link.key}>
                  <button type="button" onClick={() => handleLinkClick(link)} className={theme.link.text}>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasContact && (
          <div>
            <h3 className={theme.heading.text}>Contact Us</h3>
            <ul className="mt-4 space-y-3">
              {companySettings.contactPhoneNumber && (
                <li className={`flex items-start gap-2 ${theme.contact.text}`}>
                  <PhoneIcon className={`w-4 h-4 mt-0.5 shrink-0 ${theme.contact.icon}`} />
                  <a href={`tel:${companySettings.contactPhoneNumber}`} className="hover:text-amber-400 transition-colors">
                    {companySettings.contactPhoneNumber}
                  </a>
                </li>
              )}
              {companySettings.contactEmail && (
                <li className={`flex items-start gap-2 ${theme.contact.text}`}>
                  <MailIcon className={`w-4 h-4 mt-0.5 shrink-0 ${theme.contact.icon}`} />
                  <a href={`mailto:${companySettings.contactEmail}`} className="hover:text-amber-400 transition-colors break-all">
                    {companySettings.contactEmail}
                  </a>
                </li>
              )}
              {companySettings.contactAddress && (
                <li className={`flex items-start gap-2 ${theme.contact.text}`}>
                  <MapPinIcon className={`w-4 h-4 mt-0.5 shrink-0 ${theme.contact.icon}`} />
                  <span>{companySettings.contactAddress}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {hasSocial && (
          <div>
            <h3 className={theme.heading.text}>Follow Us</h3>
            <div className="mt-4 flex items-center gap-4">
              {companySettings.instagramId && (
                <a
                  href={instagramUrl(companySettings.instagramId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className={theme.social.icon}
                >
                  <InstagramIcon className="w-6 h-6" />
                </a>
              )}
              {companySettings.facebookId && (
                <a
                  href={facebookUrl(companySettings.facebookId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className={theme.social.icon}
                >
                  <FacebookIcon className="w-6 h-6" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <p className={`mx-auto max-w-7xl px-4 sm:px-6 pb-8 pt-6 border-t text-xs text-center ${theme.copyright.border} ${theme.copyright.text}`}>
        © {new Date().getFullYear()} {brandName}. All rights reserved.
      </p>

      {isModalMode && (
        <PolicyModal
          link={activeModalLink}
          html={activeModalLink ? companySettings?.[activeModalLink.key] : ''}
          onClose={() => setActiveModalLink(null)}
        />
      )}
    </footer>
  );
};

export default Footer;
