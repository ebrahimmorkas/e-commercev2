import { useState } from 'react';
import theme from './theme/theme';
import { useStorefrontAnnouncements } from '../../../features/announcements/hooks/useStorefrontAnnouncements';

// One real announcement (or a short list of them) can be far narrower than
// the screen - repeating the list several times, plus a min-w-[100vw] floor
// with justify-between, guarantees each of the two marquee copies below
// always spans at least a full viewport instead of leaving the second half
// of the bar blank.
const REPEAT_COUNT = 6;

const MarqueeItems = ({ announcements, hidden = false }) => (
  <div
    className="flex shrink-0 min-w-[100vw] items-center justify-between gap-8 pr-8"
    aria-hidden={hidden || undefined}
  >
    {Array.from({ length: REPEAT_COUNT }, (_, i) => i).flatMap((repeatIndex) =>
      announcements.map((announcement, i) => (
        <span key={`${repeatIndex}-${announcement._id ?? i}`} className="flex items-center gap-8">
          <span
            className={`text-sm font-medium whitespace-nowrap ${theme.bar.text}`}
            style={announcement.fontColor ? { color: announcement.fontColor } : undefined}
          >
            {announcement.heading ? `${announcement.heading}: ` : ''}
            {announcement.content}
          </span>
          <span className={`text-xs ${theme.separator.text}`} aria-hidden="true">
            &#10022;
          </span>
        </span>
      ))
    )}
  </div>
);

/**
 * Scrolling announcement marquee rendered below the Navbar. Pulls the
 * vendor's active announcements from the backend - renders nothing when
 * there are none (or the feature is off/errors) rather than showing
 * placeholder text.
 */
const AnnouncementBar = () => {
  const { announcements, loading, isRotating } = useStorefrontAnnouncements();
  const [index, setIndex] = useState(0);

  if (loading || announcements.length === 0) return null;

  // Rotation off: just the first announcement. Rotation on: one announcement
  // per marquee pass, advancing each time the scroll animation loops.
  const visible = [announcements[isRotating ? index % announcements.length : 0]];

  return (
    <div className={`group overflow-hidden border-b py-2.5 ${theme.bar.background} ${theme.bar.border}`}>
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        onAnimationIteration={isRotating ? () => setIndex((i) => i + 1) : undefined}
      >
        <MarqueeItems announcements={visible} />
        <MarqueeItems announcements={visible} hidden />
      </div>
    </div>
  );
};

export default AnnouncementBar;
