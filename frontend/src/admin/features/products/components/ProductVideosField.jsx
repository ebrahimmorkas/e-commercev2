import { useRef } from 'react';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const ArrowUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const limitsText = (settings, usedCount) => {
  const parts = [];
  parts.push(
    settings.maxVideosPerProduct != null
      ? `${usedCount} of ${settings.maxVideosPerProduct} video(s) used across this product`
      : `${usedCount} video(s) on this product`
  );
  if (settings.maxVideoSizeMB != null) parts.push(`up to ${settings.maxVideoSizeMB}MB each`);
  if (settings.allowedFormats?.length) parts.push(settings.allowedFormats.map((format) => format.toUpperCase()).join(', '));
  return parts.join(' · ');
};

/**
 * One size's product videos on the Add/Edit Product form: the saved/uploaded
 * list in gallery order (move up/down, remove), uploads in progress, and the
 * picker. All state lives in useProductVideoUploads (see ProductForm).
 * Hidden when the store has no product videos - unless the size still has
 * some, which can then only be removed.
 */
const ProductVideosField = ({ size, videoControls }) => {
  const inputRef = useRef(null);
  const settings = videoControls?.settings;
  const videos = size.videos || [];
  const uploads = (videoControls?.uploads || []).filter((upload) => upload.sizeClientId === size.clientId);

  if (!settings) return null;
  if (!settings.isEnabled && videos.length === 0) return null;

  const isLimitReached = settings.maxVideosPerProduct != null && videoControls.usedCount >= settings.maxVideosPerProduct;
  const accept = settings.allowedFormats?.length ? settings.allowedFormats.map((format) => `.${format}`).join(',') : 'video/*';

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">Videos</span>
      {settings.isEnabled ? (
        <p className={`text-xs mb-2 ${theme.text.muted}`}>
          Shown in the product gallery in this order. {limitsText(settings, videoControls.usedCount)}.
        </p>
      ) : (
        <p className={`text-xs mb-2 rounded-lg border px-3 py-2 ${theme.alert.error.border} ${theme.alert.error.background} ${theme.alert.error.text}`}>
          {settings.disabledMessage || 'Product videos are switched off for your store.'} These videos are hidden from customers; you can still remove them.
        </p>
      )}

      {videos.length > 0 && (
        <ul className="space-y-2 mb-2">
          {videos.map((video, index) => (
            <li key={video.videoAssetId} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
              <video src={video.url} preload="metadata" muted playsInline className="w-24 h-16 rounded bg-gray-900 object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{video.name || `Video ${index + 1}`}</p>
                <p className={`text-xs ${theme.text.muted}`}>{video.isNew ? 'Uploaded - saved with the product' : 'Saved'}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" isIconOnly size="xs" variant={theme.button.ghost} ariaLabel="Move video up" disabled={index === 0} onClick={() => videoControls.moveVideo(size.clientId, index, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button type="button" isIconOnly size="xs" variant={theme.button.ghost} ariaLabel="Move video down" disabled={index === videos.length - 1} onClick={() => videoControls.moveVideo(size.clientId, index, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button type="button" size="xs" variant={theme.button.danger} onClick={() => videoControls.removeVideo(size.clientId, video.videoAssetId)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploads.length > 0 && (
        <ul className="space-y-2 mb-2">
          {uploads.map((upload) => (
            <li key={upload.uploadId} className="rounded-lg border border-gray-200 p-2">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-700 truncate flex-1">{upload.name}</p>
                {upload.status === 'uploading' && <span className={`text-xs ${theme.text.muted}`}>{Math.round(upload.progress * 100)}%</span>}
                <Button
                  type="button"
                  isIconOnly
                  size="xs"
                  variant={theme.button.ghost}
                  ariaLabel={upload.status === 'uploading' ? 'Cancel upload' : 'Dismiss'}
                  onClick={() => videoControls.cancelUpload(upload.uploadId)}
                >
                  <CloseIcon />
                </Button>
              </div>
              {upload.status === 'uploading' ? (
                <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                </div>
              ) : (
                <p className={`mt-1 text-xs ${theme.text.error}`}>{upload.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {settings.isEnabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={(event) => {
              videoControls.selectFiles(size.clientId, event.target.files);
              event.target.value = '';
            }}
          />
          <Button type="button" size="sm" variant={theme.button.secondary} disabled={isLimitReached} onClick={() => inputRef.current?.click()}>
            Add videos
          </Button>
          {isLimitReached && <p className={`mt-1 text-xs ${theme.text.muted}`}>The product has the most videos allowed. Remove one to add another.</p>}
        </>
      )}
    </div>
  );
};

export default ProductVideosField;
