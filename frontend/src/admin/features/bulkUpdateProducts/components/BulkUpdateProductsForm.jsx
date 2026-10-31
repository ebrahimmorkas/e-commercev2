import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import FileUpload from '../../../../components/common/FileUpload';
import { useToast } from '../../../../components/common/Toast';
import { saveBlob } from '../../../../utils/saveBlob';
import { downloadBulkUpdateSampleFile } from '../api/bulkUpdateProductsApi';
import theme from '../theme/theme';

/**
 * Bulk-update existing products from an Excel sheet (+ optional image zips).
 * Matches the backend contract exactly (services/productService.js,
 * bulkUpdateProducts / PRODUCT_SHEET_COLUMNS & friends):
 *  - excelFile (.xlsx): the same Products/Variants/Sizes/MeasurementValues/
 *    Descriptions/BulkPricing sheets used for adding products. Each
 *    Products row is matched to an EXISTING product by Name (case-
 *    insensitive) - a name that doesn't match any product is skipped.
 *    On the Products sheet a blank cell keeps the product's current value
 *    and CLEAR empties it (ProductCode never changes).
 *    Variant/Size rows are matched to that product's existing ones by
 *    VariantCode/SizeCode; a blank code adds a brand-new variant/size, and
 *    any existing variant/size not referenced anywhere in the file for that
 *    product is removed.
 *  - mainImagesZip / additionalImagesZip (.zip, optional): the images
 *    referenced by MainImageFileName / AdditionalImageFileNames on the
 *    Sizes sheet. A blank file name keeps the size's current image(s);
 *    RemoveMainImage / RemoveAdditionalImages = TRUE removes them.
 *  - videosZip (.zip, optional): the videos referenced by VideoFileNames
 *    (blank keeps the size's current videos; RemoveVideos = TRUE removes them).
 */
const BulkUpdateProductsForm = ({ onSubmit, submitting = false }) => {
  const toast = useToast();
  const [excelFile, setExcelFile] = useState(null);
  const [mainImagesZip, setMainImagesZip] = useState(null);
  const [additionalImagesZip, setAdditionalImagesZip] = useState(null);
  const [videosZip, setVideosZip] = useState(null);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [downloadingSample, setDownloadingSample] = useState(false);

  const handleSubmit = async () => {
    setFormError('');
    if (!excelFile) return setFormError('An excel file is required.');

    const outcome = await onSubmit(excelFile, mainImagesZip, additionalImagesZip, videosZip);
    if (outcome.success) setResult(outcome.result);
  };

  const handleDownloadSample = async () => {
    setDownloadingSample(true);
    try {
      const { blob, filename } = await downloadBulkUpdateSampleFile();
      saveBlob(blob, filename || 'product-bulk-update-sample.xlsx');
    } catch (err) {
      toast.error(err.message || 'Could not download the sample file');
    } finally {
      setDownloadingSample(false);
    }
  };

  const handleRunAnother = () => {
    setResult(null);
    setFormError('');
    setExcelFile(null);
    setMainImagesZip(null);
    setAdditionalImagesZip(null);
  };

  if (result) {
    const hasFailures = result.failedCount > 0;
    return (
      <div className="space-y-4">
        <p className={`text-sm rounded-lg border px-4 py-2 ${theme.alert.success.background} ${theme.alert.success.border} ${theme.alert.success.text}`}>
          Processed {result.totalRows} row(s): {result.successCount} updated, {result.failedCount} failed.
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
          <Button variant={theme.button.primary} onClick={handleRunAnother}>
            Run Another File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className={`text-sm ${theme.text.body}`}>
        Upload an Excel sheet with the same <code className="px-1 py-0.5 rounded bg-gray-100">Products</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Variants</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Sizes</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">MeasurementValues</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Descriptions</code> and{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">BulkPricing</code> sheets used for adding products. Each
        Products row is matched to an <span className="font-medium">existing</span> product by{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Name</code> - a name that doesn't match any product is
        skipped. A Variant/Size row is matched to an existing one by its{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">VariantCode</code>/
        <code className="px-1 py-0.5 rounded bg-gray-100">SizeCode</code> - leave the code blank to add a brand-new
        variant or size. Any existing variant/size not listed anywhere in the file for that product is removed.
      </p>

      <p className={`text-sm ${theme.text.body}`}>
        On the <code className="px-1 py-0.5 rounded bg-gray-100">Products</code> sheet a blank cell keeps the
        product's current value; type <code className="px-1 py-0.5 rounded bg-gray-100">CLEAR</code> to empty a field
        (not possible for Colors and Precedence). On the{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">Sizes</code> sheet a blank image file name keeps the size's
        current image(s); set <code className="px-1 py-0.5 rounded bg-gray-100">RemoveMainImage</code> /{' '}
        <code className="px-1 py-0.5 rounded bg-gray-100">RemoveAdditionalImages</code> to TRUE to remove them.
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

      <FileUpload
        label="Videos Zip (.zip, optional)"
        accept=".zip"
        onFilesSelected={(files) => setVideosZip(files[0] || null)}
        helperText="The product videos named in VideoFileNames on the Sizes sheet. Needs product videos on your plan."
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant={theme.button.primary} onClick={handleSubmit} loading={submitting}>
          Upload
        </Button>
      </div>
    </div>
  );
};

export default BulkUpdateProductsForm;
