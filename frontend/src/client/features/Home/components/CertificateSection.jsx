import { useEffect, useState } from 'react';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';

const DEFAULT_TEXT = 'Preciosa';

const AwardIcon = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="9" r="5.5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l1.4 1.4L14.2 7.6" />
  </svg>
);

const CertificateModal = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Certificate"
    >
      <div
        className="relative max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <img src={imageUrl} alt="Certificate" className="mx-auto max-h-[85vh] w-auto rounded-lg object-contain" />
      </div>
    </div>
  );
};

/**
 * The vendor's certificate under the home banner. Desktop: the text on one side,
 * the certificate on the other. Mobile: a slim "Authorized Partner" strip whose
 * "View certificate" link opens the certificate in a modal. Renders nothing unless
 * the server sends a certificate (feature on in WebsiteMaster + CompanyMaster and
 * an image uploaded).
 */
const CertificateSection = () => {
  const { companySettings } = useStorefrontCompanySettings();
  const [open, setOpen] = useState(false);
  const imageUrl = companySettings?.partnerCertificate?.url;
  const written = (companySettings?.partnerCertificateText || '').trim();
  const text = written || DEFAULT_TEXT;

  if (!imageUrl) return null;

  const certificate = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="View full size"
      className="group block w-full cursor-zoom-in rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-900/15"
    >
      <img src={imageUrl} alt="Certificate" loading="lazy" className="w-full max-h-[420px] rounded-lg bg-slate-50 object-contain" />
    </button>
  );

  return (
    <section aria-label="Certificate">
      {/* Mobile: slim strip + modal */}
      <div className="border-y border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 md:hidden">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-4 text-center">
          <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Authorized Partner
          </span>
          <p className="text-sm font-semibold text-slate-900 whitespace-pre-line">{text}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-900 hover:decoration-amber-600"
          >
            View certificate
          </button>
        </div>
      </div>
      {open && <CertificateModal imageUrl={imageUrl} onClose={() => setOpen(false)} />}

      {/* Desktop: text beside the certificate */}
      <div className="hidden border-y border-slate-200 bg-slate-50 md:block">
        <div className="mx-auto max-w-7xl px-6 py-16">
          {written ? (
            <div className="grid items-center gap-14 md:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  <AwardIcon className="h-4 w-4" />
                  Certified
                </span>
                <p className="mt-5 text-3xl font-semibold leading-snug text-slate-900 whitespace-pre-line">{written}</p>
              </div>
              <div className="w-full max-w-lg justify-self-end">{certificate}</div>
            </div>
          ) : (
            <div className="mx-auto max-w-lg">{certificate}</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CertificateSection;
