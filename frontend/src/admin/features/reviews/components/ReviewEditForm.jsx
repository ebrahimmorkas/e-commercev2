import { useEffect, useRef, useState } from 'react';
import Button from '../../../../components/common/Buttons';
import { StarsInput } from './Stars';
import { TITLE_MAX, COMMENT_MAX } from '../constants';
import theme from '../theme/theme';

const formatAccept = (formats) => (formats?.length ? formats.map((format) => `.${String(format).replace(/^\./, '')}`).join(',') : 'image/*');

const extensionOf = (name) => String(name).split('.').pop().toLowerCase();

/**
 * The admin's edit of a review: rating, title, comment, and photos (remove
 * existing / add new within the vendor's photo limits).
 *
 * `onSubmit({ rating, title, comment, removeImageIds, files, approve })`. Shows
 * "Save & approve" when approval is on and the review isn't already approved.
 */
const ReviewEditForm = ({ review, permissions, busy, onSubmit, onCancel }) => {
  const [rating, setRating] = useState(review.rating);
  const [title, setTitle] = useState(review.title || '');
  const [comment, setComment] = useState(review.comment || '');
  const [removedIds, setRemovedIds] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]); // { file, url }
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const newPhotosRef = useRef(newPhotos);

  useEffect(() => {
    newPhotosRef.current = newPhotos;
  }, [newPhotos]);
  // Preview URLs are released when the form goes away.
  useEffect(() => () => newPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  const existingImages = review.images || [];
  const keptCount = existingImages.filter((image) => !removedIds.includes(image._id)).length;
  const maxImages = permissions?.maxImagesPerReview ?? 0;
  const totalCount = keptCount + newPhotos.length;
  const photosAllowed = maxImages > 0;

  const toggleRemove = (imageId) => {
    setRemovedIds((prev) => (prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]));
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;
    const formats = (permissions?.allowedImageFormats || []).map((format) => String(format).replace(/^\./, '').toLowerCase());
    const maxBytes = permissions?.maxImageSizeMB ? permissions.maxImageSizeMB * 1024 * 1024 : null;
    const room = maxImages - totalCount;

    for (const file of files) {
      if (!file.type.startsWith('image/')) return setError(`"${file.name}" is not an image.`);
      if (formats.length && !formats.includes(extensionOf(file.name))) return setError(`"${file.name}" must be one of: ${formats.join(', ')}.`);
      if (maxBytes && file.size > maxBytes) return setError(`"${file.name}" is larger than ${permissions.maxImageSizeMB} MB.`);
    }
    if (files.length > room) return setError(`A review can have at most ${maxImages} photo${maxImages === 1 ? '' : 's'}.`);

    setError('');
    setNewPhotos((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removeNewPhoto = (index) => {
    setNewPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = (approve) => {
    if (!rating || rating < 1 || rating > 5) return setError('Choose a rating from 1 to 5 stars.');
    if (title.length > TITLE_MAX) return setError(`The title can be at most ${TITLE_MAX} characters.`);
    if (comment.length > COMMENT_MAX) return setError(`The comment can be at most ${COMMENT_MAX} characters.`);
    setError('');
    onSubmit({
      rating,
      title: title.trim(),
      comment: comment.trim(),
      removeImageIds: removedIds,
      files: newPhotos.map((photo) => photo.file),
      approve,
    });
  };

  const showSaveAndApprove = permissions?.canApproveReject && review.moderationStatus !== 'APPROVED';

  return (
    <div className="space-y-4">
      <div>
        <p className={`text-sm font-medium mb-1 ${theme.text.heading}`}>Rating</p>
        <StarsInput value={rating} onChange={setRating} disabled={busy} />
      </div>

      <div>
        <label htmlFor="admin-review-title" className={`block text-sm font-medium mb-1 ${theme.text.heading}`}>
          Title
        </label>
        <input id="admin-review-title" type="text" maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className={theme.input} disabled={busy} />
      </div>

      <div>
        <label htmlFor="admin-review-comment" className={`block text-sm font-medium mb-1 ${theme.text.heading}`}>
          Comment
        </label>
        <textarea id="admin-review-comment" rows={5} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} className={theme.input} disabled={busy} />
        <p className={`mt-1 text-xs text-right ${theme.text.muted}`}>
          {comment.length}/{COMMENT_MAX}
        </p>
      </div>

      {(existingImages.length > 0 || photosAllowed) && (
        <div>
          <p className={`text-sm font-medium mb-1 ${theme.text.heading}`}>
            Photos {photosAllowed && <span className={`font-normal ${theme.text.muted}`}>({totalCount}/{maxImages})</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((image) => {
              const removed = removedIds.includes(image._id);
              return (
                <div key={image._id} className="relative">
                  <img src={image.url} alt="" className={`h-20 w-20 rounded-lg object-cover border ${theme.panel.border} ${removed ? 'opacity-30' : ''}`} />
                  <button
                    type="button"
                    onClick={() => toggleRemove(image._id)}
                    disabled={busy}
                    className="absolute -top-2 -right-2 rounded-full bg-white border border-gray-300 shadow px-1.5 text-xs cursor-pointer"
                    aria-label={removed ? 'Keep photo' : 'Remove photo'}
                  >
                    {removed ? '↺' : '✕'}
                  </button>
                </div>
              );
            })}
            {newPhotos.map((photo, index) => (
              <div key={photo.url} className="relative">
                <img src={photo.url} alt="" className="h-20 w-20 rounded-lg object-cover border border-blue-300" />
                <button
                  type="button"
                  onClick={() => removeNewPhoto(index)}
                  disabled={busy}
                  className="absolute -top-2 -right-2 rounded-full bg-white border border-gray-300 shadow px-1.5 text-xs cursor-pointer"
                  aria-label="Remove new photo"
                >
                  ✕
                </button>
              </div>
            ))}
            {photosAllowed && totalCount < maxImages && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 text-2xl cursor-pointer hover:border-blue-400 hover:text-blue-500"
                aria-label="Add photos"
              >
                +
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={formatAccept(permissions?.allowedImageFormats)}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {!photosAllowed && existingImages.length > 0 && (
            <p className={`mt-1 text-xs ${theme.text.muted}`}>Photos are switched off for reviews - existing ones can only be removed.</p>
          )}
        </div>
      )}

      {error && (
        <p className={`text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-3 py-2`}>{error}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant={theme.button.ghost} onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={showSaveAndApprove ? theme.button.secondary : theme.button.primary} loading={busy} onClick={() => submit(false)}>
          Save
        </Button>
        {showSaveAndApprove && (
          <Button variant={theme.button.success} loading={busy} onClick={() => submit(true)}>
            Save &amp; approve
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReviewEditForm;
