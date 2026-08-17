import { useCallback, useEffect, useState } from 'react';
import * as categoryApi from '../api/categoryApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the categories list state for the admin page: fetching, and the
 * create/update/delete/toggle/bulk-upload mutations, each surfacing errors
 * via toast rather than throwing, so callers can just check the boolean
 * result. Every mutation refetches the full list afterwards rather than
 * patching local state, since the add/update endpoints don't reliably hand
 * back the saved category (see categoryController.addCategory).
 */
export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await categoryApi.getAdminCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (fields, imageFile) => {
    setMutating(true);
    try {
      await categoryApi.addCategory(fields, imageFile);
      toast.success('Category added successfully');
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to add category');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const editCategory = async (categoryId, fields, imageFile) => {
    setMutating(true);
    try {
      await categoryApi.updateCategory(categoryId, fields, imageFile);
      toast.success('Category updated successfully');
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to update category');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const removeCategory = async (categoryId) => {
    setMutating(true);
    try {
      await categoryApi.deleteCategory(categoryId);
      toast.success('Category deleted successfully');
      await fetchCategories();
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
      return false;
    } finally {
      setMutating(false);
    }
  };

  const toggleStatus = (category) => {
    const nextStatus = category.status === 'A' ? 'I' : 'A';
    return editCategory(
      category._id,
      {
        categoryName: category.categoryName,
        parent_category_id: category.parent_category_id || '',
        status: nextStatus,
      },
      null
    );
  };

  const runBulkUpload = async (excelFile, zipFile) => {
    setMutating(true);
    try {
      const result = await categoryApi.bulkUploadCategories(excelFile, zipFile);
      await fetchCategories();
      return { success: true, result };
    } catch (err) {
      toast.error(err.message || 'Bulk upload failed');
      return { success: false, error: err };
    } finally {
      setMutating(false);
    }
  };

  return {
    categories,
    loading,
    error,
    mutating,
    refetch: fetchCategories,
    createCategory,
    editCategory,
    removeCategory,
    toggleStatus,
    runBulkUpload,
  };
};

export default useCategories;
