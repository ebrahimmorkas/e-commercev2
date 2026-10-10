import { useEffect } from 'react';
import { useStorefrontCompanySettings } from '../../../client/features/companySettings/hooks/useStorefrontCompanySettings';

const FALLBACK_NAME = 'e-commercev2';
const FALLBACK_ICON = '/logo-fallback.svg';

const setFavicon = (href) => {
  let link = document.querySelector('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  // The type hint belongs to the static fallback only - the vendor's logo can be png/jpg/webp.
  link.removeAttribute('type');
  link.href = href;
};

/**
 * Browser tab title + icon from the vendor's Company Settings (company name and
 * logo). Until they load, or when the vendor has not set them, the tab shows the
 * platform fallback. Renders nothing.
 *
 * @param {Object} props
 * @param {string} [props.titleSuffix] - Appended to the name, e.g. "Admin".
 */
const DocumentBranding = ({ titleSuffix = '' }) => {
  const { companySettings } = useStorefrontCompanySettings();
  const name = companySettings?.companyName?.trim() || '';
  const logoUrl = companySettings?.companyLogo?.url || '';

  useEffect(() => {
    const base = name || FALLBACK_NAME;
    document.title = titleSuffix ? `${base} - ${titleSuffix}` : base;
  }, [name, titleSuffix]);

  useEffect(() => {
    setFavicon(FALLBACK_ICON);
    if (!logoUrl) return undefined;

    // Only switch once the logo really loads, so a broken URL never leaves a blank tab icon.
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setFavicon(logoUrl);
    };
    probe.src = logoUrl;
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return null;
};

export default DocumentBranding;
