import { useEffect, useRef, useState } from 'react';
import { useStorefrontCompanySettings } from '../../features/companySettings/hooks/useStorefrontCompanySettings';
import { FacebookIcon, InstagramIcon, WhatsappIcon } from './footer/icons';

const BUTTONS = {
  whatsapp: { label: 'Chat on WhatsApp', Icon: WhatsappIcon, color: 'bg-[#25D366]' },
  instagram: { label: 'Open Instagram', Icon: InstagramIcon, color: 'bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af]' },
  facebook: { label: 'Open Facebook', Icon: FacebookIcon, color: 'bg-[#1877F2]' },
};

/**
 * WhatsApp / Instagram / Facebook buttons stacked at the bottom-right of every
 * storefront page. Small, and they fade while the page is scrolling so they never
 * cover content for long; they sit above the "Footer" shortcut button. The server
 * only sends the ones that are switched on (WebsiteMaster + CompanyMaster + the
 * vendor's own toggle) and have a number / handle to link to.
 */
const FloatingSocial = () => {
  const { companySettings } = useStorefrontCompanySettings();
  const [scrolling, setScrolling] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setScrolling(false), 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer.current);
    };
  }, []);

  const items = (companySettings?.floatingSocial || []).filter((i) => BUTTONS[i.type]);
  if (!items.length) return null;

  return (
    // The wrapper ignores pointer events so only the icons themselves can be clicked.
    <div className="pointer-events-none fixed bottom-20 right-3 z-30 flex flex-col gap-2 sm:right-5 print:hidden">
      {items.map(({ type, url }) => {
        const { label, Icon, color } = BUTTONS[type];
        return (
          <a
            key={type}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 ${color} ${scrolling ? 'opacity-40' : 'opacity-95'}`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </a>
        );
      })}
    </div>
  );
};

export default FloatingSocial;
