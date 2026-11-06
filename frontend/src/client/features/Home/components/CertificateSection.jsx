import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';

const AwardIcon = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="9" r="5.5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l1.4 1.4L14.2 7.6" />
  </svg>
);

/**
 * The vendor's certificate, shown on the home page just below the banner: the
 * text they wrote on one side and the certificate image on the other. Renders
 * nothing unless the server sends a certificate (it only does when the feature
 * is on in WebsiteMaster and CompanyMaster and an image has been uploaded).
 */
const CertificateSection = () => {
  const { companySettings } = useStorefrontCompanySettings();
  const imageUrl = companySettings?.partnerCertificate?.url;
  const text = (companySettings?.partnerCertificateText || '').trim();

  if (!imageUrl) return null;

  const certificate = (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open full size"
      className="group block rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-900/15"
    >
      <img
        src={imageUrl}
        alt="Certificate"
        loading="lazy"
        className="w-full max-h-[420px] rounded-lg bg-slate-50 object-contain"
      />
    </a>
  );

  return (
    <section className="bg-slate-50 border-y border-slate-200" aria-label="Certificate">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {text ? (
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <AwardIcon className="h-4 w-4" />
                Certified
              </span>
              <p className="mt-5 text-2xl font-semibold leading-snug text-slate-900 whitespace-pre-line sm:text-3xl">
                {text}
              </p>
            </div>
            <div className="md:justify-self-end w-full max-w-lg">{certificate}</div>
          </div>
        ) : (
          // No text written: just the certificate, centred.
          <div className="mx-auto max-w-lg">{certificate}</div>
        )}
      </div>
    </section>
  );
};

export default CertificateSection;
