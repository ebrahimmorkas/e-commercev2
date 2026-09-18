import Card from '../../../../components/common/Card';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import AddUserForm from '../components/AddUserForm';
import { useAddUser } from '../hooks/useAddUser';
import { useAddUserLookups } from '../hooks/useAddUserLookups';
import theme from '../theme/theme';

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

/**
 * Standalone module reached either from the sidebar (its own ADD_USER
 * ModuleMaster entry) or from the "Add User" button on the Customers page -
 * same "whole page is a form" pattern as BulkUpdateProductsPage rather than
 * the view-swap-within-the-list-page pattern ProductsPage uses, since this
 * is its own separately-assignable module rather than an action nested
 * inside Customers.
 *
 * @param {Function} props.onDone - navigates back to the Customers page,
 * called after a successful create and from the Back/Cancel buttons.
 */
const AddUserPage = ({ onDone }) => {
  const { submitting, createUser } = useAddUser();
  const lookups = useAddUserLookups();
  const { companyMaster, loading } = lookups;

  const handleSubmit = async (payload) => {
    const success = await createUser(payload);
    if (success) onDone?.();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Button type="button" isIconOnly size="sm" variant={theme.button.ghost} ariaLabel="Back to Customers" onClick={onDone}>
          <BackIcon />
        </Button>
        <div>
          <p className={`text-xs ${theme.text.muted}`}>Customers</p>
          <h1 className={`text-xl font-bold leading-tight ${theme.text.heading}`}>Add User</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !companyMaster?.isAdminAddingUserFeatureAllowed ? (
        <EmptyState
          title="Add User is not enabled"
          description="Creating customer accounts directly isn't enabled for your account. Contact support to enable it."
          action={
            <Button variant={theme.button.secondary} leftIcon={<BackIcon />} onClick={onDone}>
              Back to Customers
            </Button>
          }
        />
      ) : (
        <Card title={<span className="font-bold">New Customer</span>} subtitle="Create a customer account the same way a customer would sign up">
          {lookups.error && (
            <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{lookups.error}</p>
          )}
          <AddUserForm lookups={lookups} onSubmit={handleSubmit} onCancel={onDone} submitting={submitting} />
        </Card>
      )}
    </div>
  );
};

export default AddUserPage;
