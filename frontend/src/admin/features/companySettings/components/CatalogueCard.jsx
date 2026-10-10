import { useState } from 'react';
import FileUpload from '../../../../components/common/FileUpload';
import Button from '../../../../components/common/Buttons';
import { useToast } from '../../../../components/common/Toast';
import * as companySettingsApi from '../api/companySettingsApi';
import theme from '../theme/theme';

const MAX_MB = 25;

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * The catalogue PDF customers download from the storefront navbar. Saved
 * immediately through its own endpoints (like email attachments), so it never
 * touches the page's unsaved draft. Rendered only when the platform turned
 * Catalogue Download on for this vendor (isCatalogueDownloadFeatureOn).
 *
 * @param {Object|null} props.catalogue - { originalName, size, uploadedAt } or null
 * @param {boolean} props.settingsExist - the settings record must exist first
 */
const CatalogueCard = ({ catalogue: initial, settingsExist }) => {
  // undefined until the first change here; the loaded settings are used till then.
  const [changed, setChanged] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploaderKey, setUploaderKey] = useState(0);
  const toast = useToast();

  const catalogue = changed === undefined ? initial : changed;

  const run = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      const data = await action();
      setChanged(data?.catalogue || null);
      toast.success(success);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
      setUploaderKey((k) => k + 1);
    }
  };

  const handleSelect = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setError('The catalogue must be a PDF file.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`The file is larger than ${MAX_MB} MB.`);
      return;
    }
    run(() => companySettingsApi.uploadCatalogue(file), catalogue ? 'Catalogue replaced' : 'Catalogue uploaded');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <div>
        <p className={`text-sm font-medium ${theme.text.heading}`}>Catalogue (PDF)</p>
        <p className={`text-xs ${theme.text.subheading}`}>
          Customers see a download icon in the storefront menu, after Brands. Uploading a new file replaces the current one.
        </p>
      </div>

      {!settingsExist ? (
        <p className={`text-xs ${theme.text.muted}`}>Save your company settings first, then upload the catalogue here.</p>
      ) : (
        <>
          {catalogue && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className={`text-sm truncate ${theme.text.heading}`}>{catalogue.originalName}</p>
                <p className={`text-xs ${theme.text.muted}`}>
                  {formatSize(catalogue.size)}
                  {catalogue.uploadedAt ? ` · uploaded ${new Date(catalogue.uploadedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL || '/api'}/company-settings/catalogue/download`}
                  className="text-sm font-medium text-violet-700 hover:underline"
                >
                  Download
                </a>
                <Button variant={theme.button.danger} size="sm" onClick={() => run(() => companySettingsApi.removeCatalogue(), 'Catalogue removed')} disabled={busy}>
                  Remove
                </Button>
              </div>
            </div>
          )}

          <FileUpload
            key={uploaderKey}
            label={catalogue ? 'Replace catalogue' : 'Upload catalogue'}
            accept=".pdf,application/pdf"
            maxSize={MAX_MB * 1024 * 1024}
            onFilesSelected={handleSelect}
            disabled={busy}
            error={error}
          />
          <p className={`text-xs ${theme.text.muted}`}>PDF only, up to {MAX_MB} MB.</p>
        </>
      )}
    </div>
  );
};

export default CatalogueCard;
