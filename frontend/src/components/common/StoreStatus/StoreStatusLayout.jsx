import Avatar from '../Avatar/Avatar';
import Button from '../Buttons/Button';

// Class-string tokens per accent, so each closed-store page gets its own mood
// from the same layout.
const ACCENTS = {
  amber: {
    glowPrimary: 'bg-amber-500/25',
    glowSecondary: 'bg-orange-600/20',
    orb: 'from-amber-400/30 to-orange-500/10',
    pulse: 'bg-amber-400',
    icon: 'text-amber-300',
    badge: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
    link: 'hover:border-amber-400/50 hover:text-amber-200',
    button: 'warning',
  },
  rose: {
    glowPrimary: 'bg-rose-500/25',
    glowSecondary: 'bg-violet-600/25',
    orb: 'from-rose-400/30 to-violet-500/10',
    pulse: 'bg-rose-400',
    icon: 'text-rose-300',
    badge: 'bg-rose-400/10 text-rose-200 ring-rose-400/30',
    link: 'hover:border-rose-400/50 hover:text-rose-200',
    button: 'danger',
  },
};

const MailIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
  </svg>
);

/**
 * Full-screen layout shared by the closed-store pages (MaintenancePage,
 * PlanExpiredPage): the store's own logo and name on top, an animated icon,
 * the message, and optionally how to reach the store.
 *
 * @param {Object} props
 * @param {'amber'|'rose'} [props.accent]
 * @param {React.ReactNode} props.icon - Illustration inside the glowing orb.
 * @param {string} props.badge - Short label above the title.
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.note] - Smaller line under the description.
 * @param {Object} [props.store] - { companyName, companyLogoUrl, contactEmail, contactPhoneNumber }
 * @param {boolean} [props.showContact] - Show the store's email / phone.
 * @param {string} [props.actionLabel] - Label of the button that re-checks the store.
 */
const StoreStatusLayout = ({
  accent = 'amber',
  icon,
  badge,
  title,
  description,
  note,
  store,
  showContact = false,
  actionLabel = 'Check again',
}) => {
  const tokens = ACCENTS[accent] || ACCENTS.amber;
  const companyName = store?.companyName?.trim() || '';
  const contactEmail = showContact ? store?.contactEmail : null;
  const contactPhoneNumber = showContact ? store?.contactPhoneNumber : null;
  const contactLinkClasses = `inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-colors ${tokens.link}`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Backdrop: two drifting glows over a faint dot grid */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className={`absolute -left-24 -top-32 h-96 w-96 rounded-full blur-3xl animate-float-slow ${tokens.glowPrimary}`} />
        <div className={`absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl animate-float ${tokens.glowSecondary}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      {(companyName || store?.companyLogoUrl) && (
        <header className="relative flex items-center justify-center gap-3 px-4 pt-8 sm:pt-10">
          <Avatar src={store?.companyLogoUrl} name={companyName} size="lg" shape="square" className="bg-white ring-1 ring-white/20" />
          {companyName && <span className="text-lg font-semibold tracking-tight text-white">{companyName}</span>}
        </header>
      )}

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:px-12 sm:py-14">
          <div className="relative mx-auto h-28 w-28">
            <span className={`absolute inset-2 rounded-full opacity-20 animate-ping [animation-duration:2.8s] motion-reduce:animate-none ${tokens.pulse}`} />
            <div className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ring-1 ring-white/15 ${tokens.orb} ${tokens.icon}`}>
              {icon}
            </div>
          </div>

          <span className={`mt-8 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold uppercase tracking-widest ring-1 ${tokens.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none ${tokens.pulse}`} />
            {badge}
          </span>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-300">{description}</p>
          {note && <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">{note}</p>}

          {(contactEmail || contactPhoneNumber) && (
            <div className="mt-8">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Need help? Reach us</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className={contactLinkClasses}>
                    <MailIcon />
                    <span className="break-all">{contactEmail}</span>
                  </a>
                )}
                {contactPhoneNumber && (
                  <a href={`tel:${contactPhoneNumber}`} className={contactLinkClasses}>
                    <PhoneIcon />
                    {contactPhoneNumber}
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="mt-10">
            <Button variant={tokens.button} shape="pill" onClick={() => window.location.reload()}>
              {actionLabel}
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative px-4 pb-8 text-center text-xs text-slate-500">
        {companyName ? `© ${new Date().getFullYear()} ${companyName}` : 'Thank you for your patience.'}
      </footer>
    </div>
  );
};

export default StoreStatusLayout;
