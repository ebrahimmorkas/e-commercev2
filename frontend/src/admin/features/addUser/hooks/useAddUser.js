import { useState } from 'react';
import * as addUserApi from '../api/addUserApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the create-customer mutation for the Add User page. Mirrors
 * admin/features/bulkUpdateProducts/hooks/useBulkUpdateProducts.js's shape -
 * a single action, no list to maintain.
 */
export const useAddUser = () => {
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const createUser = async (payload) => {
    setSubmitting(true);
    try {
      await addUserApi.createUser(payload);
      toast.success('Customer account created successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to create customer account');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, createUser };
};

export default useAddUser;
