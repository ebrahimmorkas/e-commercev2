import { useEffect, useRef, useState } from 'react';

const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/**
 * Calls onLoadMore whenever the sentinel element nears the viewport.
 *
 * With an endless list the page footer would otherwise be unreachable: it sits
 * right under the sentinel, so every scroll toward it loads more and pushes it
 * away. So loading pauses while the footer is on screen (and resumes once the
 * user scrolls back up), and `footerInView` / `jumpToFooter` let the page offer
 * a "go to footer" shortcut.
 *
 * onLoadMore must change identity when a load finishes (usePagedProducts'
 * loadMore does) - that re-arms the observer, so a still-visible sentinel
 * keeps pulling pages until the screen is full.
 *
 * @param {Object} options
 * @param {() => void} options.onLoadMore
 * @param {number} options.itemCount - Items rendered so far; a change while parked at the footer re-anchors it.
 * @param {boolean} options.enabled - false while there's nothing (more) to load or a load failed.
 * @returns {{ sentinelRef, footerInView, jumpToFooter }}
 */
export const useInfiniteScroll = ({ onLoadMore, enabled, itemCount }) => {
  const sentinelRef = useRef(null);
  const [footerInView, setFooterInView] = useState(false);
  // Set synchronously by jumpToFooter. footerInView only updates after the
  // observer's async callback, and in that gap the sentinel (right above the
  // footer) would still load a page and push the footer back off screen.
  const parkedAtFooterRef = useRef(false);

  // Parked until the user scrolls themselves.
  useEffect(() => {
    const release = () => {
      parkedAtFooterRef.current = false;
    };
    USER_SCROLL_EVENTS.forEach((type) => window.addEventListener(type, release, { passive: true }));
    return () => USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, release));
  }, []);

  // A page that was already in flight when the user jumped lands above the
  // footer and shifts it - put it back.
  useEffect(() => {
    if (parkedAtFooterRef.current) document.querySelector('footer')?.scrollIntoView({ block: 'start' });
  }, [itemCount]);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const active = enabled && !footerInView;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!active || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !parkedAtFooterRef.current) onLoadMore();
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, onLoadMore]);

  // Instant, not smooth: a smooth scroll would sweep past the sentinel and load more on the way.
  const jumpToFooter = () => {
    parkedAtFooterRef.current = true;
    document.querySelector('footer')?.scrollIntoView({ block: 'start' });
  };

  return { sentinelRef, footerInView, jumpToFooter };
};

export default useInfiniteScroll;
