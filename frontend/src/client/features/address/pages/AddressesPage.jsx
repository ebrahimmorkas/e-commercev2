import { useState } from 'react';
import theme from '../../Home/theme/theme';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useToast } from '../../../../components/common/Toast';
import { useAddresses } from '../hooks/useAddresses';
import AddressForm from '../components/AddressForm';
import { formatAddress } from '../utils/formatAddress';

/**
 * My Addresses: full CRUD for the logged-in customer's saved addresses.
 * Backed by /api/address/* (login required - see addressApi.js).
 */
const AddressesPage = ({ onBack }) => {
  const { addresses, loading, error, reload, addAddress, editAddress, removeAddress } = useAddresses();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const openAddForm = () => {
    setEditingAddress(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (address) => {
    setEditingAddress(address);
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (editingAddress) {
        await editAddress(editingAddress._id, payload);
        toast.success('Address updated');
      } else {
        await addAddress(payload);
        toast.success('Address added');
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (address) => {
    setDeletingId(address._id);
    try {
      await removeAddress(address._id);
      toast.success('Address removed');
    } catch (err) {
      toast.error(err.message || 'Could not remove address');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-4 sm:mb-6"
      >
        ← Continue shopping
      </button>

      <div className="flex items-center justify-between gap-3">
        <h1 className={`text-xl sm:text-2xl font-bold ${theme.section.heading}`}>My Addresses</h1>
        {!loading && !error && addresses.length > 0 && (
          <button
            type="button"
            onClick={openAddForm}
            className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
          >
            + Add address
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-24">
          <Spinner size="lg" label="Loading addresses" />
        </div>
      )}

      {!loading && error && (
        <EmptyState
          title="Couldn't load your addresses"
          description={error}
          action={
            <button
              type="button"
              onClick={reload}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Try Again
            </button>
          }
        />
      )}

      {!loading && !error && addresses.length === 0 && (
        <EmptyState
          title="No saved addresses"
          description="Add a shipping address to speed up checkout."
          action={
            <button
              type="button"
              onClick={openAddForm}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Add Address
            </button>
          }
        />
      )}

      {!loading && !error && addresses.length > 0 && (
        <div className="mt-6 space-y-3">
          {addresses.map((address) => (
            <div key={address._id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {address.address_name}
                  {address.isDefault && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase align-middle">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{formatAddress(address)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => openEditForm(address)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(address)}
                  disabled={deletingId === address._id}
                  className="text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-60"
                >
                  {deletingId === address._id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddressForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        editingAddress={editingAddress}
        saving={saving}
        error={formError}
      />
    </div>
  );
};

export default AddressesPage;
