import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import FileUpload from '../../../../components/common/FileUpload';
import { useToast } from '../../../../components/common/Toast';
import { saveBlob } from '../../../../utils/saveBlob';
import { downloadBulkUploadSampleFile } from '../api/productApi';
import theme from '../theme/theme';

/**
 * Bulk-add products from an Excel workbook (+ optional image zips).
 * Matches the backend contract exactly (services/productService.js,
 * bulkUploadProducts / PRODUCT_SHEET_COLUMNS & friends):
 *  - excelFile (.xlsx): Products/Variants/Sizes/MeasurementValues/
 *    Descriptions/BulkPricing sheets, linked to each other through their
 *    TempCode columns. Every Products row adds one product, with the same
 *    fields and rules as the Add Product form.
 *  - mainImagesZip / additionalImagesZip (.zip, optional): the images
 *    referenced by MainImageFileName / AdditionalImageFileNames on the
 *    Sizes sheet.
 */
const BulkUploadProductsModal = ({ onSubmit, onClose, submitting = false }) => {
  const toast = useToast();
  const [excelFile, setExcelFile] = useState(null);
  const [mainImagesZip, setMainImagesZip] = useState(null);
  const [additionalImagesZip, setAdditionalImagesZip] = useState(null);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [downloadingSample, setDownloadingSample] = useState(false);

  const handleSubmit = async () => {
    setFormError('');
    if (!excelFile) return setFormError('An excel file is required.');

    const outcome = await onSubmit(excelFile, mainImagesZip, additionalImagesZip);
    if (outcome.success) setResult(outcome.result);
  };

  const handleDownloadSample = async () => {
    setDownloadingSample(true);
    try {
      const { blob, filename } = await downloadBulkUploadSampleFile();
      saveBlob(blob, filename || 'product-bulk-upload-sample.xlsx');
    } catch (err) {
      toast.error(err.message || 'Could not download the sample file');
    } finally {
      setDownloadingSample(false);
    }
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
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Product Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.failedRecords.map((record) => (
                  <tr key={record.rowNumber}>
                    <td className="px-3 py-2 text-gray-500">{record.rowNumber}</td>
                    <td className="px-3 py-2 text-gray-700">{record.data?.name || '—'}</td>
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
        Upload an Excel workbook with the <code className="px-1 py-0.5 rounded bg-gray-100">Products</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Variants</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Sizes</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">MeasurementValues</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Descriptions</code> and{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">BulkPricing</code> sheets. Each Products row adds one new
        product with the same fields and rules as the Add Product form; a product with anything wrong in it is skipped
        and reported, the rest are still added.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={theme.button.secondary} size="sm" onClick={handleDownloadSample} loading={downloadingSample}>
          Download sample file
        </Button>
        <span className={`text-xs ${theme.text.muted}`}>
          One .xlsx with every sheet ready to fill in, plus an Instructions sheet explaining each column.
        </span>
      </div>

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
        label="Main Images Zip (.zip, optional)"
        accept=".zip"
        onFilesSelected={(files) => setMainImagesZip(files[0] || null)}
      />

      <FileUpload
        label="Additional Images Zip (.zip, optional)"
        accept=".zip"
        onFilesSelected={(files) => setAdditionalImagesZip(files[0] || null)}
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

export default BulkUploadProductsModal;
