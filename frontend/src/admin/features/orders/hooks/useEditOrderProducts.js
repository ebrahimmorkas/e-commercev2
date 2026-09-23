import { useCallback, useEffect, useState } from 'react';
import { getEditCategories, getEditProducts, getEditProductOptions } from '../api/orderAdminApi';
import { getCompanyMasterData } from '../../adminPlaceOrder/api/adminPlaceOrderApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Data for the "add products" picker inside Edit Order: the same
 * category -> product -> variant -> size picker Place Order uses (see
 * adminPlaceOrder/pages/AdminPlaceOrderPage.jsx), served by the gated
 * /api/orders/admin/edit/* endpoints. Categories load once on open; products
 * narrow as a category is chosen and a product's variants/sizes load on pick.
 */
export const useEditOrderProducts = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState(null);
  const [isCategoryNestingAllowed, setIsCategoryNestingAllowed] = useState(true);
  const [isBulkPricingFeatureOn, setIsBulkPricingFeatureOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadProducts = useCallback(async (categoryId) => {
    try {
      const list = await getEditProducts(categoryId);
      setProducts(Array.isArray(list) ? list : []);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getEditCategories(), getEditProducts(), getCompanyMasterData()]).then(([categoriesRes, productsRes, masterRes]) => {
      if (cancelled) return;
      setCategories(categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value) ? categoriesRes.value : []);
      setProducts(productsRes.status === 'fulfilled' && Array.isArray(productsRes.value) ? productsRes.value : []);
      setIsCategoryNestingAllowed(masterRes.status === 'fulfilled' && masterRes.value ? !!masterRes.value.isCategoryNestingAllowed : true);
      setIsBulkPricingFeatureOn(masterRes.status === 'fulfilled' && masterRes.value ? !!masterRes.value.isBulkPricingFeatureOn : false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProductOptions = useCallback(
    async (productId) => {
      setProductOptions(null);
      if (!productId) return;
      try {
        setProductOptions(await getEditProductOptions(productId));
      } catch (err) {
        toast.error(err.message || 'Failed to load product options');
      }
    },
    [toast]
  );

  const clearProductOptions = useCallback(() => setProductOptions(null), []);

  return { loading, categories, products, productOptions, isCategoryNestingAllowed, isBulkPricingFeatureOn, loadProducts, loadProductOptions, clearProductOptions };
};

export default useEditOrderProducts;
