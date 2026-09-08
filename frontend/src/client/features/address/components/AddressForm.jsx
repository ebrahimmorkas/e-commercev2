import { useEffect, useState } from 'react';
import Modal from '../../../../components/common/Modal/Modal';
import { useLocations } from '../hooks/useLocations';
import { getStatesForCountry, getCitiesForState } from '../utils/shapeLocations';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';

const EMPTY_FORM = {
  address_name: '',
  room_no: '',
  building: '',
  address_in_words: '',
  floor: '',
  country_id: '',
  state_id: '',
  city_id: '',
  pincode: '',
};

// Address docs come back from the API with country_id/state_id/city_id
// populated to { _id, ...name } (see addressService.js's .populate calls) -
// pull the raw ids back out for editing.
const toFormValues = (address) => {
  if (!address) return EMPTY_FORM;
  const idOf = (field) => (typeof field === 'object' && field !== null ? field._id : field || '');
  return {
    address_name: address.address_name || '',
    room_no: address.room_no || '',
    building: address.building || '',
    address_in_words: address.address_in_words || '',
    floor: address.floor || '',
    country_id: idOf(address.country_id),
    state_id: idOf(address.state_id),
    city_id: idOf(address.city_id),
    pincode: address.pincode || '',
  };
};

/**
 * Add/edit address form, shown in a modal. Country/state/city are cascading
 * selects backed by useLocations (see hooks/useLocations.js).
 *
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {Function} onSubmit - Called with the address payload; caller handles the API call.
 * @param {Object} [editingAddress] - Present when editing an existing address.
 * @param {boolean} [saving]
 * @param {string} [error]
 */
const AddressForm = ({ isOpen, onClose, onSubmit, editingAddress = null, saving = false, error = '' }) => {
  const { countries, stateGroups, cityGroups, loading: locationsLoading, error: locationsError } = useLocations();
  const [form, setForm] = useState(() => toFormValues(editingAddress));

  useEffect(() => {
    if (isOpen) setForm(toFormValues(editingAddress));
  }, [isOpen, editingAddress]);

  const availableStates = getStatesForCountry(stateGroups, form.country_id);
  const availableCities = getCitiesForState(cityGroups, form.country_id, form.state_id);

  const handleCountryChange = (country_id) => setForm((f) => ({ ...f, country_id, state_id: '', city_id: '' }));
  const handleStateChange = (state_id) => setForm((f) => ({ ...f, state_id, city_id: '' }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, floor: form.floor || null });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingAddress ? 'Edit address' : 'Add a new address'} size="md">
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          {error}
        </div>
      )}
      {locationsError && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700" role="alert">
          Couldn't load countries/states/cities: {locationsError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Label (e.g. Home, Office)"
          value={form.address_name}
          onChange={(e) => setForm((f) => ({ ...f, address_name: e.target.value }))}
          className={inputClass}
          required
          disabled={saving}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Room / flat no."
            value={form.room_no}
            onChange={(e) => setForm((f) => ({ ...f, room_no: e.target.value }))}
            className={inputClass}
            required
            disabled={saving}
          />
          <input
            type="text"
            placeholder="Floor (optional)"
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
            className={inputClass}
            disabled={saving}
          />
        </div>
        <input
          type="text"
          placeholder="Building / society name"
          value={form.building}
          onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
          className={inputClass}
          required
          disabled={saving}
        />
        <textarea
          placeholder="Address in words (street, landmark, area)"
          value={form.address_in_words}
          onChange={(e) => setForm((f) => ({ ...f, address_in_words: e.target.value }))}
          className={`${inputClass} min-h-20 resize-none`}
          required
          disabled={saving}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={form.country_id}
            onChange={(e) => handleCountryChange(e.target.value)}
            className={inputClass}
            required
            disabled={saving || locationsLoading}
          >
            <option value="">Country</option>
            {countries.map((country) => (
              <option key={country._id} value={country._id}>
                {country.country_name}
              </option>
            ))}
          </select>
          <select
            value={form.state_id}
            onChange={(e) => handleStateChange(e.target.value)}
            className={inputClass}
            required
            disabled={saving || locationsLoading || !form.country_id}
          >
            <option value="">State</option>
            {availableStates.map((state) => (
              <option key={state._id} value={state._id}>
                {state.state_name}
              </option>
            ))}
          </select>
          <select
            value={form.city_id}
            onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
            className={inputClass}
            required
            disabled={saving || locationsLoading || !form.state_id}
          >
            <option value="">City</option>
            {availableCities.map((city) => (
              <option key={city._id} value={city._id}>
                {city.city_name}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Pincode"
          value={form.pincode}
          onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
          className={inputClass}
          required
          disabled={saving}
        />

        <button
          type="submit"
          disabled={saving || locationsLoading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-60"
        >
          {saving ? 'Saving...' : editingAddress ? 'Save changes' : 'Add address'}
        </button>
      </form>
    </Modal>
  );
};

export default AddressForm;
