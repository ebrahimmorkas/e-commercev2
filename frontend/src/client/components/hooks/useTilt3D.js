import { useRef } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Pointer-driven 3D tilt: rotates the element to face the cursor and lifts it
 * slightly, resetting on pointer leave. No-op for touch input (no mousemove)
 * and for users who prefer reduced motion.
 *
 * @param {Object} [options]
 * @param {number} [options.max] - Maximum rotation in degrees on each axis.
 * @param {number} [options.scale] - Scale applied while hovered.
 * @returns {{ref: React.RefObject, onMouseMove: Function, onMouseLeave: Function}}
 */
export const useTilt3D = ({ max = 8, scale = 1.03 } = {}) => {
  const ref = useRef(null);

  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * max * 2;
    const rotateX = (0.5 - py) * max * 2;
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
  };

  return { ref, onMouseMove, onMouseLeave };
};
