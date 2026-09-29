import { useState } from 'react';
import * as companySettingsApi from '../api/companySettingsApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * The vendor's email attachments and images (Company Settings > Email).
 * They're saved immediately through their own endpoints, so they're kept
 * apart from the page's draft: uploading or removing a file never touches
 * (or resets) unsaved changes elsewhere on the page.
 *
 * @param {Object|null} settings - the loaded CompanySettings (initial lists)
 */
export const useEmailContent = (settings) => {
  // null until the first change here; the loaded settings are used till then.
  const [lists, setLists] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const current = lists || {
    emailAttachments: settings?.emailAttachments || [],
    emailImages: settings?.emailImages || [],
  };

  const run = async (action, successMessage, failureMessage) => {
    setBusy(true);
    try {
      const data = await action();
      setLists({ emailAttachments: data?.emailAttachments || [], emailImages: data?.emailImages || [] });
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    attachments: current.emailAttachments,
    images: current.emailImages,
    busy,
    addAttachment: (file, displayName) =>
      run(() => companySettingsApi.addEmailAttachment(file, displayName), 'Attachment added', 'Could not add the attachment'),
    removeAttachment: (id) =>
      run(() => companySettingsApi.removeEmailAttachment(id), 'Attachment removed', 'Could not remove the attachment'),
    addImage: (file, name) => run(() => companySettingsApi.addEmailImage(file, name), 'Image added', 'Could not add the image'),
    removeImage: (id) => run(() => companySettingsApi.removeEmailImage(id), 'Image removed', 'Could not remove the image'),
  };
};

export default useEmailContent;
