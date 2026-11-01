import { useEffect } from 'react';
import Modal from '../../../../components/common/Modal/Modal';

/**
 * Full-size view of a review's photos with previous/next (buttons and arrow keys).
 *
 * @param {Object} props
 * @param {Array<{ url: string }>} props.images
 * @param {number|null} props.index - Photo shown; null = closed.
 * @param {(index: number|null) => void} props.onChangeIndex
 */
const ReviewImageViewer = ({ images = [], index, onChangeIndex }) => {
  const isOpen = index !== null && index !== undefined && images.length > 0;
  const count = images.length;

  useEffect(() => {
    if (!isOpen || count < 2) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') onChangeIndex((index + 1) % count);
      if (e.key === 'ArrowLeft') onChangeIndex((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, index, count, onChangeIndex]);

  if (!isOpen) return null;
  const image = images[index];

  return (
    <Modal isOpen={isOpen} onClose={() => onChangeIndex(null)} title={`Photo ${index + 1} of ${count}`} size="lg">
      <div className="relative flex items-center justify-center bg-slate-50 rounded-lg min-h-64">
        <img src={image.url} alt={`Customer photo ${index + 1}`} className="max-h-[70vh] w-auto object-contain" />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => onChangeIndex((index - 1 + count) % count)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow text-slate-700 hover:bg-white cursor-pointer"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onChangeIndex((index + 1) % count)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow text-slate-700 hover:bg-white cursor-pointer"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReviewImageViewer;
