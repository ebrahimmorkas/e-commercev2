import { useState } from 'react';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useAddresses } from '../hooks/useAddresses';
import AddressForm from './AddressForm';
import { useToast } from '../../../../components/common/Toast';

const formatAddress = (address) => {
  const idOf = (field) => (typeof field === 'object' && field !== null ? field : null);
  const country = idOf(address.country_id);
  const state = idOf(address.state_id);
  const city = idOf(address.city_id);
  const parts = [
    address.floor ? `Floor ${address.floor}` : null,
    address.building,
    address.address_in_words,
    [city?.city_name, state?.state_name].filter(Boolean).join(', '),
    country?.country_name,
    address.pincode,
  ].filter(Boolean);
  return parts.join(', ');
};

/**
 * Saved-address radio list for checkout, with inline add/edit/delete. Used
 * by CheckoutPage - see features/orders/pages/CheckoutPage.jsx.
 *
 * @param {string} [selectedId]
 * @param {Function} onSelect - Called with an address _id.
 */
const AddressPicker = ({ selectedId, onSelect }) => {
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
      if (selectedId === address._id) onSelect?.(null);
      toast.success('Address removed');
    } catch (err) {
      toast.error(err.message || 'Could not remove address');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Loading addresses" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load your addresses"
        description={error}
        action={
          <button
            type="button"
            onClick={reload}
            className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-900"
          >
            Try Again
          </button>
        }
      />
    );
  }

  return (
    <div>
      {addresses.length === 0 ? (
        <EmptyState size="sm" title="No saved addresses" description="Add a shipping address to continue." />
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <label
              key={address._id}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors duration-150 ${
                selectedId === address._id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="shipping-address"
                className="mt-1 shrink-0"
                checked={selectedId === address._id}
                onChange={() => onSelect?.(address._id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{address.address_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatAddress(address)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs font-medium">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openEditForm(address);
                  }}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(address);
                  }}
                  disabled={deletingId === address._id}
                  className="text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-60"
                >
                  {deletingId === address._id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openAddForm}
        className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
      >
        + Add a new address
      </button>

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

export default AddressPicker;
