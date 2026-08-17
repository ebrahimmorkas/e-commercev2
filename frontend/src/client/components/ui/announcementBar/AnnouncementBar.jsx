import theme from './theme/theme';
import { ANNOUNCEMENTS } from './data';

const MarqueeItems = ({ hidden = false }) => (
  <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
    {ANNOUNCEMENTS.map((text, i) => (
      <span key={i} className="flex items-center gap-8">
        <span className={`text-sm font-medium whitespace-nowrap ${theme.bar.text}`}>{text}</span>
        <span className={`text-xs ${theme.separator.text}`} aria-hidden="true">
          &#10022;
        </span>
      </span>
    ))}
  </div>
);

/**
 * Scrolling announcement marquee rendered below the Navbar.
 */
const AnnouncementBar = () => (
  <div className={`group overflow-hidden border-b py-2.5 ${theme.bar.background} ${theme.bar.border}`}>
    <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
      <MarqueeItems />
      <MarqueeItems hidden />
    </div>
  </div>
);

export default AnnouncementBar;
