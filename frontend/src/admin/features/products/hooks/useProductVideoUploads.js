import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductVideoSettings, uploadProductVideo, discardProductVideo } from '../api/productApi';
import { countDraftVideos } from '../utils/productDraft';

const extensionOf = (fileName = '') => {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

let uploadIdCounter = 0;
const nextUploadId = () => `video-upload-${Date.now()}-${uploadIdCounter++}`;

const findSize = (draft, sizeClientId) => {
  for (const variant of draft?.variants || []) {
    for (const size of variant.sizes || []) {
      if (size.clientId === sizeClientId) return size;
    }
  }
  return null;
};

// Returns a new draft with `update(size)` applied to the size with that clientId.
const updateSize = (draft, sizeClientId, update) => ({
  ...draft,
  variants: draft.variants.map((variant) => ({
    ...variant,
    sizes: variant.sizes.map((size) => (size.clientId === sizeClientId ? update(size) : size)),
  })),
});

/**
 * Product videos on the Add/Edit Product form.
 *
 * Each picked video is uploaded straight away (POST /products/upload-product-video,
 * with progress); once done it is added to its size's `videos` in the draft and
 * the product save sends the ids. Uploads still running live here, not in the
 * draft. Rules (same as the backend, checked here first so the admin knows
 * before the upload): the feature switch, the per-product count (all sizes
 * together, uploads in progress included), the size and the format.
 *
 * Videos uploaded while the form was open are removed again when they are
 * taken off the form, and when the form closes without being saved. (The
 * backend also removes any upload no product uses after a day.)
 *
 * @param {{ draft: object, setDraft: Function, toast: object }} params - setDraft must accept an updater function
 */
export const useProductVideoUploads = ({ draft, setDraft, toast }) => {
  const [settings, setSettings] = useState(null);
  const [uploads, setUploads] = useState([]);

  // Latest draft/uploads for the async upload callbacks (kept in sync after each render).
  const draftRef = useRef(draft);
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    draftRef.current = draft;
    uploadsRef.current = uploads;
  }, [draft, uploads]);
  const controllersRef = useRef(new Map());
  const newVideoIdsRef = useRef(new Set());
  const isSavedRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    getProductVideoSettings()
      .then((data) => {
        if (isActive) setSettings(data || { isEnabled: false });
      })
      .catch(() => {
        // Unknown = treat as off; the backend is the final check anyway.
        if (isActive) setSettings({ isEnabled: false, disabledMessage: 'Product video settings could not be loaded.' });
      });
    return () => {
      isActive = false;
    };
  }, []);

  // Leaving the form: stop running uploads, and unless it was saved, remove
  // what was uploaded while it was open.
  useEffect(() => {
    const controllers = controllersRef.current;
    const newVideoIds = newVideoIdsRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      if (!isSavedRef.current) {
        newVideoIds.forEach((videoAssetId) => {
          discardProductVideo(videoAssetId).catch(() => {});
        });
      }
      newVideoIds.clear();
    };
  }, []);

  const discardIfNew = useCallback((videoAssetId) => {
    if (!newVideoIdsRef.current.has(videoAssetId)) return;
    newVideoIdsRef.current.delete(videoAssetId);
    discardProductVideo(videoAssetId).catch(() => {});
  }, []);

  const patchUpload = (uploadId, fields) =>
    setUploads((prev) => prev.map((upload) => (upload.uploadId === uploadId ? { ...upload, ...fields } : upload)));
  const dropUpload = (uploadId) => setUploads((prev) => prev.filter((upload) => upload.uploadId !== uploadId));

  const runUpload = (sizeClientId, file) => {
    const uploadId = nextUploadId();
    const controller = new AbortController();
    controllersRef.current.set(uploadId, controller);
    setUploads((prev) => [...prev, { uploadId, sizeClientId, name: file.name, progress: 0, status: 'uploading', error: null }]);

    uploadProductVideo(file, {
      signal: controller.signal,
      onProgress: (fraction) => patchUpload(uploadId, { progress: fraction }),
    })
      .then(({ video }) => {
        controllersRef.current.delete(uploadId);
        dropUpload(uploadId);
        newVideoIdsRef.current.add(video.videoAssetId);
        // The size was removed from the form while this was uploading.
        if (!findSize(draftRef.current, sizeClientId)) {
          discardIfNew(video.videoAssetId);
          return;
        }
        setDraft((prev) =>
          updateSize(prev, sizeClientId, (size) => ({
            ...size,
            videos: [...(size.videos || []), { videoAssetId: video.videoAssetId, url: video.url, name: file.name, isNew: true }],
          }))
        );
      })
      .catch((err) => {
        controllersRef.current.delete(uploadId);
        if (err?.name === 'AbortError') {
          dropUpload(uploadId);
          return;
        }
        patchUpload(uploadId, { status: 'error', error: err?.message || 'Upload failed.' });
      });
  };

  /** The admin picked files for one size. */
  const selectFiles = (sizeClientId, files) => {
    const picked = Array.from(files || []);
    if (picked.length === 0) return;

    if (!settings?.isEnabled) {
      toast.error(settings?.disabledMessage || 'Product videos are not enabled for your store.');
      return;
    }

    const formats = (settings.allowedFormats || []).map((format) => String(format).toLowerCase());
    const maxBytes = settings.maxVideoSizeMB != null ? settings.maxVideoSizeMB * 1024 * 1024 : null;
    const accepted = [];
    for (const file of picked) {
      const extension = extensionOf(file.name);
      if (formats.length > 0 && !formats.includes(extension)) {
        toast.error(`"${file.name}": .${extension || '(none)'} videos are not allowed. Allowed: ${formats.join(', ')}.`);
        continue;
      }
      if (maxBytes !== null && file.size > maxBytes) {
        toast.error(`"${file.name}" is larger than the ${settings.maxVideoSizeMB}MB allowed per video.`);
        continue;
      }
      accepted.push(file);
    }

    const maxCount = settings.maxVideosPerProduct;
    let toUpload = accepted;
    if (maxCount != null) {
      const inUse = countDraftVideos(draftRef.current) + uploadsRef.current.filter((upload) => upload.status === 'uploading').length;
      const remaining = Math.max(0, maxCount - inUse);
      if (accepted.length > remaining) {
        toast.error(
          remaining === 0
            ? `This product already has the most videos allowed (${maxCount}).`
            : `Only ${remaining} more video(s) can be added to this product (${maxCount} allowed in total) - the rest were not uploaded.`
        );
        toUpload = accepted.slice(0, remaining);
      }
    }

    toUpload.forEach((file) => runUpload(sizeClientId, file));
  };

  /** Takes a video off a size (a saved one is deleted when the product is saved). */
  const removeVideo = (sizeClientId, videoAssetId) => {
    setDraft((prev) =>
      updateSize(prev, sizeClientId, (size) => ({
        ...size,
        videos: (size.videos || []).filter((video) => video.videoAssetId !== videoAssetId),
      }))
    );
    discardIfNew(videoAssetId);
  };

  /** Moves a video up (-1) or down (+1) in its size's gallery order. */
  const moveVideo = (sizeClientId, index, delta) => {
    setDraft((prev) =>
      updateSize(prev, sizeClientId, (size) => {
        const videos = [...(size.videos || [])];
        const target = index + delta;
        if (target < 0 || target >= videos.length) return size;
        [videos[index], videos[target]] = [videos[target], videos[index]];
        return { ...size, videos };
      })
    );
  };

  /** Stops an upload that is still running, or clears a failed one. */
  const cancelUpload = (uploadId) => {
    const controller = controllersRef.current.get(uploadId);
    if (controller) controller.abort();
    else dropUpload(uploadId);
  };

  // Around the product save: a save that went through keeps its videos even
  // though the form then closes.
  const markSaving = () => {
    isSavedRef.current = true;
  };
  const markSaveFailed = () => {
    isSavedRef.current = false;
  };
  const markSaved = () => {
    isSavedRef.current = true;
    newVideoIdsRef.current.clear();
  };

  const isUploading = uploads.some((upload) => upload.status === 'uploading');

  return {
    settings,
    uploads,
    isUploading,
    usedCount: countDraftVideos(draft) + uploads.filter((upload) => upload.status === 'uploading').length,
    selectFiles,
    removeVideo,
    moveVideo,
    cancelUpload,
    markSaving,
    markSaveFailed,
    markSaved,
  };
};

export default useProductVideoUploads;
