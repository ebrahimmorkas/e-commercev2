import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import FileUpload from '../../../../components/common/FileUpload';
import theme from '../theme/theme';

/**
 * Bulk-add categories from an Excel sheet + a zip of images.
 * Matches the backend contract exactly (services/categoryService.js,
 * BULK_CATEGORY_COLUMNS):
 *  - excelFile (.xlsx): columns categoryPath (required), imagePath, status
 *    - categoryPath uses '>' to nest, e.g. "Men > Shirts > Formal"
 *    - imagePath must match a filename inside the zip (case-insensitive)
 *  - imageZip (.zip): the images referenced by imagePath
 */
const BulkUploadModal = ({ onSubmit, onClose, submitting = false }) => {
  const [excelFile, setExcelFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const handleSubmit = async () => {
    setFormError('');
    if (!excelFile) return setFormError('An excel file is required.');
    if (!zipFile) return setFormError('An image zip file is required.');

    const outcome = await onSubmit(excelFile, zipFile);
    if (outcome.success) setResult(outcome.result);
  };

  if (result) {
    const hasFailures = result.failedCount > 0;
    return (
      <div className="space-y-4">
        <p className={`text-sm rounded-lg border px-4 py-2 ${theme.alert.success.background} ${theme.alert.success.border} ${theme.alert.success.text}`}>
          Processed {result.totalRows} row(s): {result.successCount} added, {result.failedCount} failed.
        </p>

        {hasFailures && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Row</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Category Path</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.failedRecords.map((record) => (
                  <tr key={record.rowNumber}>
                    <td className="px-3 py-2 text-gray-500">{record.rowNumber}</td>
                    <td className="px-3 py-2 text-gray-700">{record.data?.categoryPath || '—'}</td>
                    <td className={`px-3 py-2 ${theme.text.error}`}>{record.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant={theme.button.primary} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className={`text-sm ${theme.text.body}`}>
        Upload an Excel sheet with columns <code className="px-1 py-0.5 rounded bg-gray-100">categoryPath</code>{' '}
        (e.g. <code className="px-1 py-0.5 rounded bg-gray-100">Men &gt; Shirts &gt; Formal</code>),{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">imagePath</code> (optional), and{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">status</code> (optional, A/I), plus a zip of the images
        referenced by <code className="px-1 py-0.5 rounded bg-gray-100">imagePath</code>.
      </p>

      {formError && (
        <p className={`text-sm rounded-lg border px-4 py-2 ${theme.alert.error.background} ${theme.alert.error.border} ${theme.alert.error.text}`}>
          {formError}
        </p>
      )}

      <FileUpload
        label="Excel File (.xlsx)"
        accept=".xlsx"
        onFilesSelected={(files) => setExcelFile(files[0] || null)}
      />

      <FileUpload
        label="Image Zip (.zip)"
        accept=".zip"
        onFilesSelected={(files) => setZipFile(files[0] || null)}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant={theme.button.ghost} onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" variant={theme.button.primary} onClick={handleSubmit} loading={submitting}>
          Upload
        </Button>
      </div>
    </div>
  );
};

export default BulkUploadModal;
