import { useEffect, useState } from 'react';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';

const DEFAULT_TEXT = 'Preciosa';

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
 * A slim "Authorized Partner" strip under the home banner. The vendor's
 * certificate opens in a modal from the link. The text comes from Company
 * Settings (falls back to a default). Renders nothing unless the server sends a
 * certificate (feature on in WebsiteMaster + CompanyMaster and an image uploaded).
 */
const CertificateSection = () => {
  const { companySettings } = useStorefrontCompanySettings();
  const [open, setOpen] = useState(false);
  const imageUrl = companySettings?.partnerCertificate?.url;
  const text = (companySettings?.partnerCertificateText || '').trim() || DEFAULT_TEXT;

  if (!imageUrl) return null;

  return (
    <section className="border-y border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50" aria-label="Certificate">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-center sm:px-6">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
          Authorized Partner
        </span>
        <p className="text-sm font-semibold text-slate-900 whitespace-pre-line sm:text-base">{text}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4 transition-colors hover:text-amber-900 hover:decoration-amber-600"
        >
          View certificate
        </button>
      </div>
      {open && <CertificateModal imageUrl={imageUrl} onClose={() => setOpen(false)} />}
    </section>
  );
};

export default CertificateSection;
