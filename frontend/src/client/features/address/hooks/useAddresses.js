import { useCallback, useEffect, useState } from 'react';
import { listAddresses, createAddress, updateAddress, deleteAddress } from '../api/addressApi';

/**
 * backend/services/addressService.js's listAddresses returns a 400 "No
 * address to show" instead of a 200 with an empty array when the user has
 * none yet - treat that one specific message as "empty list", not a real
 * error, so a brand-new customer doesn't see an error banner before they've
 * ever added an address.
 */
const NO_ADDRESSES_MESSAGE = 'No address to show';

export const useAddresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAddresses();
      setAddresses(result?.addresses || []);
    } catch (err) {
      if (err.message === NO_ADDRESSES_MESSAGE) {
        setAddresses([]);
      } else {
        setError(err.message || 'Failed to load addresses');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // createAddress's response carries no address back (backend bug - see
  // addressApi.js), so the only way to pick up the new row is to reload.
  const addAddress = useCallback(
    async (payload) => {
      await createAddress(payload);
      await load();
    },
    [load]
  );

  const editAddress = useCallback(
    async (id, payload) => {
      await updateAddress(id, payload);
      await load();
    },
    [load]
  );

  const removeAddress = useCallback(
    async (id) => {
      await deleteAddress(id);
      await load();
    },
    [load]
  );

  return { addresses, loading, error, reload: load, addAddress, editAddress, removeAddress };
};

export default useAddresses;
