import Card from '../../../../components/common/Card';
import BulkUpdateProductsForm from '../components/BulkUpdateProductsForm';
import { useBulkUpdateProducts } from '../hooks/useBulkUpdateProducts';

/**
 * Standalone action page (no list/table - there's nothing to browse here,
 * just the one bulk-update action) - same "whole page is a form" pattern as
 * CompanySettingsPage rather than the list+modal CRUD pattern most masters
 * use.
 */
const BulkUpdateProductsPage = () => {
  const { submitting, runBulkUpdate } = useBulkUpdateProducts();

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Bulk Update Products</span>}
        subtitle="Update your existing products - and add new variants or sizes to them - from an Excel file"
      >
        <BulkUpdateProductsForm onSubmit={runBulkUpdate} submitting={submitting} />
      </Card>
    </div>
  );
};

export default BulkUpdateProductsPage;
