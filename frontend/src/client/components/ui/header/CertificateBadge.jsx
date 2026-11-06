import { useEffect, useRef, useState } from 'react';

const AwardIcon = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="9" r="5.5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l1.4 1.4L14.2 7.6" />
  </svg>
);

/**
 * A small "Certificate" badge next to the logo. Hovering it (or focusing it, or
 * tapping it on a touch screen) opens a card with the vendor's certificate image
 * and the caption they wrote in Company Settings.
 *
 * @param {string} props.imageUrl - the certificate image
 * @param {string} [props.text] - caption shown under the image
 */
const CertificateBadge = ({ imageUrl, text = '' }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Tap outside / Escape closes it (touch screens have no "mouse leave").
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="View our certificate"
        className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
      >
        <AwardIcon className="w-4 h-4" />
        <span className="hidden md:inline">Certified</span>
      </button>

      {open && (
        // pt-2 keeps the hover continuous while the pointer crosses the gap to the card.
        <div className="absolute left-0 top-full z-50 pt-2" role="dialog" aria-label="Certificate">
          <div className="w-72 sm:w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" title="Open full size" className="block">
              <img
                src={imageUrl}
                alt="Certificate"
                className="w-full max-h-72 rounded-lg border border-slate-100 bg-slate-50 object-contain"
              />
            </a>
            {text && <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{text}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateBadge;
