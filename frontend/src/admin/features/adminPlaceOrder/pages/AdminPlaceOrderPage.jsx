import { useEffect, useState } from 'react';
import Card from '../../../../components/common/Card';
import Form from '../../../../components/common/Form';
import Table from '../../../../components/common/tables';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Checkbox from '../../../../components/common/Checkbox';
import CategoryPathPicker from '../../../../components/common/CategoryPathPicker';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import { useToast } from '../../../../components/common/Toast';
import * as api from '../api/adminPlaceOrderApi';
import { bulkUnitPrice } from '../../../../utils/bulkPricing';
import { useTaxPreview } from '../hooks/useTaxPreview';
import TaxPreviewRow from '../components/TaxPreviewRow';

// Mirror backend/middlewares/validations/adminPlaceOrderValidations.js so the
// form rejects what the API would reject, before a round-trip.
const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_MONEY = 100000000;
const MAX_QUANTITY = 100000;
const MAX_ADDRESS_LENGTH = 1000;
const MAX_REMARKS_LENGTH = 500;

const moneyRule = (label) => ({
  validations: [
    (v) => (!v.trim() || MONEY_PATTERN.test(v.trim()) ? true : `${label} must be a non-negative number with at most 2 decimals`),
    (v) => (!v.trim() || Number(v) <= MAX_MONEY ? true : `${label} is too large`),
  ],
});

const optionalPhoneRule = {
  validations: [(v) => (!v.trim() || PHONE_PATTERN.test(v.trim()) ? true : 'Enter a valid number (10-14 digits, optional leading +)')],
};

const EMPTY_VALUES = {
  isWalkIn: false,
  searchField: '',
  userId: '',
  addressId: '',
  wName: '',
  wPhone: '',
  wWhatsapp: '',
  wEmail: '',
  wAddress: '',
  applyTax: true,
  applyBulkPricing: false,
  isTaxManual: false,
  manualTax: '',
  mainCategory: '',
  subCategory: '',
  productId: '',
  variantId: '',
  sizeId: '',
  quantity: '',
  addressText: '',
  discount: '',
  shipping: '',
  remarks: '',
};

// Rules that depend on the customer mode, so a hidden field never blocks submit.
const buildValidationSchema = (isWalkIn) => ({
  ...(isWalkIn
    ? {
        wName: {
          required: true,
          validations: [
            (v) => (v.trim().length >= 2 ? true : 'Name must be at least 2 characters'),
            (v) => (v.trim().length <= 50 ? true : 'Name must not exceed 50 characters'),
          ],
        },
        wPhone: {
          required: true,
          validations: [(v) => (PHONE_PATTERN.test(v.trim()) ? true : 'Enter a valid phone number (10-14 digits, optional leading +)')],
        },
        wWhatsapp: optionalPhoneRule,
        wEmail: {
          validations: [(v) => (!v.trim() || (EMAIL_PATTERN.test(v.trim()) && v.trim().length <= 254) ? true : 'Enter a valid email address')],
        },
        wAddress: {
          validations: [(v) => (v.trim().length <= MAX_ADDRESS_LENGTH ? true : `Address cannot exceed ${MAX_ADDRESS_LENGTH} characters`)],
        },
      }
    : {
        searchField: { required: true },
        userId: { required: true },
        addressText: {
          validations: [(v) => (v.trim().length <= MAX_ADDRESS_LENGTH ? true : `Address cannot exceed ${MAX_ADDRESS_LENGTH} characters`)],
        },
      }),
  discount: moneyRule('Discount'),
  shipping: moneyRule('Shipping amount'),
  manualTax: moneyRule('Tax amount'),
  remarks: {
    validations: [(v) => (v.trim().length <= MAX_REMARKS_LENGTH ? true : `Remarks cannot exceed ${MAX_REMARKS_LENGTH} characters`)],
  },
});

const formatMoney = (value) => Number(value).toFixed(2);

// A line's quantity is edited as text in the table; these read it back.
const lineQuantity = (line) => {
  const quantity = Number(line.quantityText);
  return Number.isInteger(quantity) && quantity >= 1 ? quantity : 0;
};

const lineQuantityError = (line) => {
  const text = line.quantityText.trim();
  if (!text) return 'Enter a quantity';
  const quantity = Number(text);
  if (!Number.isInteger(quantity) || quantity < 1) return 'Whole number, at least 1';
  if (quantity > MAX_QUANTITY) return `At most ${MAX_QUANTITY}`;
  if (!line.allowOutOfStock && quantity > line.stock) return `Only ${line.stock} in stock`;
  return '';
};

// Preview of what "Apply Bulk Pricing" charges - the backend re-prices on submit.
const lineUnitPrice = (line, applyBulkPricing) =>
  applyBulkPricing ? bulkUnitPrice(line.unitPrice, line.bulkPricing, lineQuantity(line)) : line.unitPrice;

// "Enter tax manually" is offered whenever the order is taxed at all - a
// walk-in sale with "Apply tax" unticked has no tax to enter.
const isTaxAllowed = (values) => !(values.isWalkIn && !values.applyTax);

/**
 * Summary card with a live, server-calculated tax preview (or the admin's typed
 * tax) - a component of its own so the preview hook can use the Form's values.
 */
const OrderSummaryCard = ({ values, items, subtotal, discountValue, shippingValue }) => {
  const taxAllowed = isTaxAllowed(values);
  const isManual = taxAllowed && values.isTaxManual;
  const itemsValid = items.length > 0 && !items.some((line) => lineQuantityError(line));
  const hasCustomer = values.isWalkIn || !!values.userId;

  // Only asked for when the tax is actually auto-calculated.
  const request = taxAllowed && !isManual && itemsValid && hasCustomer
    ? {
        isWalkInCustomer: values.isWalkIn,
        ...(values.isWalkIn
          ? { applyTax: values.applyTax }
          : { userId: values.userId, ...(values.addressId ? { addressId: values.addressId } : {}) }),
        applyBulkPricing: values.applyBulkPricing,
        items: items.map((line) => ({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, quantity: lineQuantity(line) })),
      }
    : null;
  const { preview, loading, error } = useTaxPreview(api.previewTax, request);

  const manualAmount = MONEY_PATTERN.test(values.manualTax.trim()) ? Number(values.manualTax) : 0;
  const taxValue = !taxAllowed ? 0 : isManual ? manualAmount : preview?.totalTaxAmount || 0;
  const estimatedTotal = Math.max(0, subtotal - discountValue) + shippingValue + taxValue;

  return (
    <Card title={<span className="font-bold">Summary</span>}>
      <dl className="text-sm space-y-1 max-w-sm ml-auto">
        <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-600">Discount</dt><dd>- {formatMoney(discountValue)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-600">Shipping</dt><dd>{formatMoney(shippingValue)}</dd></div>
        <TaxPreviewRow
          preview={preview}
          loading={loading}
          error={error}
          isManual={isManual}
          manualAmount={manualAmount}
          isTaxOff={!taxAllowed}
          hasItems={itemsValid}
          formatMoney={formatMoney}
        />
        <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
          <dt>Estimated total</dt><dd>{formatMoney(estimatedTotal)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-right text-gray-400">
        Tax is confirmed when the order is placed. Payment is Cash on Delivery.
      </p>
    </Card>
  );
};

/**
 * Admin places an order on behalf of one customer, or for a walk-in ("User out
 * of System") customer typed in by hand. Gated by the ADMIN_PLACE_ORDER module
 * (sidebar) and, as defense in depth, by
 * companyMaster.isAdminPlacingOrderOnBehalfOfUserIsOn - same two-layer check
 * AddUserPage does. Built entirely from the shared components.
 */
const AdminPlaceOrderPage = () => {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [companyMaster, setCompanyMaster] = useState(null);
  const [searchFields, setSearchFields] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [users, setUsers] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [productOptions, setProductOptions] = useState(null);

  const [items, setItems] = useState([]);
  const [lineError, setLineError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Read by the Form's schema/render, which sit outside the Form's own state.
  const [isWalkIn, setIsWalkIn] = useState(false);
  // Mirrors values.applyBulkPricing for the items table columns, which are built outside the Form.
  const [applyBulkPricing, setApplyBulkPricing] = useState(false);
  // Bumped after a successful order so the Form remounts with empty values.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled([
        api.getCompanyMasterData(),
        api.getUserSearchFields(),
        api.getCategories(),
        api.getProducts(),
      ]);
      if (cancelled) return;
      const [masterRes, fieldsRes, categoriesRes, productsRes] = results;
      setCompanyMaster(masterRes.status === 'fulfilled' ? masterRes.value || null : null);
      setSearchFields(fieldsRes.status === 'fulfilled' && Array.isArray(fieldsRes.value) ? fieldsRes.value : []);
      setCategories(categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value) ? categoriesRes.value : []);
      setProducts(productsRes.status === 'fulfilled' && Array.isArray(productsRes.value) ? productsRes.value : []);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isCategoryNestingAllowed = companyMaster ? !!companyMaster.isCategoryNestingAllowed : true;
  const isBulkPricingFeatureOn = !!companyMaster?.isBulkPricingFeatureOn;

  const loadUsers = async (searchField) => {
    setUsers([]);
    if (!searchField) return;
    try {
      const list = await api.getUsers({ searchField });
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    }
  };

  const loadAddresses = async (userId) => {
    setAddresses([]);
    if (!userId) return;
    try {
      const list = await api.getUserAddresses(userId);
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      setAddresses([]);
    }
  };

  const loadProducts = async (categoryId) => {
    try {
      const list = await api.getProducts(categoryId);
      setProducts(Array.isArray(list) ? list : []);
    } catch {
      setProducts([]);
    }
  };

  const loadProductOptions = async (productId) => {
    setProductOptions(null);
    if (!productId) return;
    try {
      setProductOptions(await api.getProductOptions(productId));
    } catch (err) {
      toast.error(err.message || 'Failed to load product options');
    }
  };

  const addItem = (values, setFieldValue) => {
    const variant = productOptions?.variants.find((v) => v.variantId === values.variantId);
    const size = variant?.sizes.find((s) => s.sizeId === values.sizeId);
    const quantity = Number(values.quantity);
    const allowOutOfStock = productOptions?.allowOutOfStockProductsAdding === true;

    if (!values.productId || !variant || !size) return setLineError('Select a product, variant and size first.');
    if (!String(values.quantity).trim() || !Number.isInteger(quantity) || quantity < 1) return setLineError('Quantity must be a whole number of at least 1.');
    if (quantity > MAX_QUANTITY) return setLineError(`Quantity cannot exceed ${MAX_QUANTITY}.`);
    if (!size.isSelectable) return setLineError('This size is out of stock.');
    if (!allowOutOfStock && quantity > size.stock) return setLineError(`Only ${size.stock} in stock.`);
    if (items.some((line) => line.productId === values.productId && line.variantId === values.variantId && line.sizeId === values.sizeId)) {
      return setLineError('This product, variant and size is already on the order. Change its quantity in the table below.');
    }

    setItems((current) => [
      ...current,
      {
        key: `${values.productId}:${values.variantId}:${values.sizeId}`,
        productId: values.productId,
        variantId: values.variantId,
        sizeId: values.sizeId,
        productName: productOptions.product.name,
        variantName: variant.variantName,
        sizeName: size.sizeName,
        sku: size.sku,
        unitPrice: size.price,
        bulkPricing: size.bulkPricing || [],
        stock: size.stock,
        allowOutOfStock,
        quantityText: String(quantity),
      },
    ]);
    setLineError('');
    setItemsError('');
    setFieldValue('productId', '');
    setFieldValue('variantId', '');
    setFieldValue('sizeId', '');
    setFieldValue('quantity', '');
    setProductOptions(null);
  };

  const updateQuantity = (key, quantityText) => {
    setItems((current) => current.map((line) => (line.key === key ? { ...line, quantityText } : line)));
    setItemsError('');
  };

  const itemColumns = [
    {
      key: 'productName',
      label: 'Product',
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.productName}</div>
          <div className="text-xs text-gray-400">{row.sku}</div>
        </div>
      ),
    },
    { key: 'variant', label: 'Variant / Size', render: (row) => `${row.variantName} / ${row.sizeName}` },
    {
      key: 'unitPrice',
      label: 'Unit price',
      align: 'right',
      render: (row) => {
        const price = lineUnitPrice(row, applyBulkPricing);
        if (price === row.unitPrice) return formatMoney(row.unitPrice);
        return (
          <div>
            <div className="font-medium text-gray-900">{formatMoney(price)}</div>
            <div className="text-xs text-gray-400"><span className="line-through">{formatMoney(row.unitPrice)}</span> <span className="text-emerald-600">Bulk price</span></div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: 'Qty',
      align: 'right',
      width: '140px',
      render: (row) => {
        const error = lineQuantityError(row);
        return (
          <div className="w-28 ml-auto text-left">
            <InputField
              name={`qty-${row.key}`}
              type="number"
              value={row.quantityText}
              onChange={(e) => updateQuantity(row.key, e.target.value)}
              className="w-full"
              showError={false}
            />
            {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
            {!error && row.allowOutOfStock && lineQuantity(row) > row.stock && (
              <p className="mt-1 text-xs text-amber-700">Only {row.stock} in stock</p>
            )}
          </div>
        );
      },
    },
    { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatMoney(lineUnitPrice(row, applyBulkPricing) * lineQuantity(row)) },
  ];

  const itemActions = [
    {
      label: 'Remove',
      variant: 'ghost',
      onClick: (row) => setItems((current) => current.filter((line) => line.key !== row.key)),
    },
  ];

  const handleSubmit = async (values) => {
    const subtotal = items.reduce((sum, line) => sum + lineUnitPrice(line, values.applyBulkPricing) * lineQuantity(line), 0);
    const discount = values.discount.trim() ? Number(values.discount) : 0;
    const shipping = values.shipping.trim() ? Number(values.shipping) : 0;

    if (items.length === 0) {
      setItemsError('Add at least one product to the order.');
      return;
    }
    if (items.some((line) => lineQuantityError(line))) {
      setItemsError('Fix the highlighted quantities before placing the order.');
      return;
    }
    if (discount > subtotal) {
      toast.error('Discount cannot be greater than the order subtotal.');
      return;
    }
    const isTaxManual = isTaxAllowed(values) && values.isTaxManual;
    if (isTaxManual && !values.manualTax.trim()) {
      toast.error('Enter the tax amount, or untick "Enter tax manually".');
      return;
    }

    const payload = {
      items: items.map((line) => ({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, quantity: lineQuantity(line) })),
      shippingAmount: shipping,
      discountAmount: discount,
      applyBulkPricing: isBulkPricingFeatureOn && values.applyBulkPricing,
    };
    if (isTaxManual) {
      payload.isTaxManual = true;
      payload.manualTaxAmount = Number(values.manualTax);
    }
    if (values.remarks.trim()) payload.remarks = values.remarks.trim();

    if (values.isWalkIn) {
      payload.isWalkInCustomer = true;
      payload.applyTax = values.applyTax;
      payload.walkInCustomer = { name: values.wName.trim(), phone: values.wPhone.trim() };
      if (values.wWhatsapp.trim()) payload.walkInCustomer.whatsapp = values.wWhatsapp.trim();
      if (values.wEmail.trim()) payload.walkInCustomer.email = values.wEmail.trim();
      if (values.wAddress.trim()) payload.walkInCustomer.address = values.wAddress.trim();
    } else {
      payload.userId = values.userId;
      if (values.addressId) payload.addressId = values.addressId;
      if (values.addressText.trim()) payload.addressText = values.addressText.trim();
    }

    setSubmitting(true);
    try {
      const order = await api.placeOrder(payload);
      toast.success(`Order ${order?.orderNumber || ''} placed successfully`);
      setItems([]);
      setUsers([]);
      setAddresses([]);
      setProductOptions(null);
      setLineError('');
      setItemsError('');
      setIsWalkIn(false);
      setApplyBulkPricing(false);
      setFormKey((key) => key + 1);
      loadProducts();
    } catch (err) {
      const firstFieldError = err.errors?.[0]?.message;
      toast.error(firstFieldError ? `${err.message}: ${firstFieldError}` : err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-5">
        <p className="text-xs text-gray-400">Orders</p>
        <h1 className="text-xl font-bold leading-tight text-gray-900">Place Order for Customer</h1>
      </div>

      {!companyMaster?.isAdminPlacingOrderOnBehalfOfUserIsOn ? (
        <EmptyState
          title="Placing orders for customers is not enabled"
          description="Placing an order on behalf of a customer isn't enabled for your account. Contact support to enable it."
        />
      ) : (
        <Form key={formKey} initialValues={EMPTY_VALUES} validationSchema={buildValidationSchema(isWalkIn)} onSubmit={handleSubmit}>
          {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur, handleReset }) => {
            const showError = (name) => ((touched[name] || submitAttempted) && errors[name]) || '';
            const textError = (name) => showError(name) && <p className="mt-1 text-sm text-red-600" role="alert">{showError(name)}</p>;

            const handleWalkInToggle = (e) => {
              const checked = e.target.checked;
              setIsWalkIn(checked);
              setFieldValue('isWalkIn', checked);
              // The two modes never share a customer: drop whichever one is being left.
              ['searchField', 'userId', 'addressId', 'addressText', 'wName', 'wPhone', 'wWhatsapp', 'wEmail', 'wAddress'].forEach((field) => setFieldValue(field, ''));
              setFieldValue('applyTax', true);
              setFieldValue('isTaxManual', false);
              setFieldValue('manualTax', '');
              setUsers([]);
              setAddresses([]);
            };

            const handleSearchFieldChange = (value) => {
              setFieldValue('searchField', value);
              setFieldValue('userId', '');
              setFieldValue('addressId', '');
              setAddresses([]);
              loadUsers(value);
            };

            const handleUserChange = (value) => {
              setFieldValue('userId', value);
              setFieldValue('addressId', '');
              loadAddresses(value);
            };

            const handleCategoryChange = (mainCategory, subCategory) => {
              setFieldValue('mainCategory', mainCategory);
              setFieldValue('subCategory', subCategory);
              setFieldValue('productId', '');
              setFieldValue('variantId', '');
              setFieldValue('sizeId', '');
              setProductOptions(null);
              // Products narrow to the deepest category picked so far.
              loadProducts(subCategory || mainCategory || undefined);
            };

            const handleProductChange = (value) => {
              setFieldValue('productId', value);
              setFieldValue('variantId', '');
              setFieldValue('sizeId', '');
              loadProductOptions(value);
            };

            const userOptions = users.map((user) => ({
              value: user.userId,
              label: user.name && values.searchField !== 'name' ? `${user.value} (${user.name})` : user.value,
            }));
            const addressOptions = addresses.map((address) => ({
              value: address._id,
              label: `${address.address_name} - ${[address.room_no, address.building, address.address_in_words].filter(Boolean).join(', ')} (${address.pincode})`,
            }));
            const productDropdownOptions = products.map((product) => ({
              value: product._id,
              label: product.productCode ? `${product.name} (${product.productCode})` : product.name,
            }));

            const variants = productOptions?.variants || [];
            const selectedVariant = variants.find((variant) => variant.variantId === values.variantId) || null;
            const selectedSize = selectedVariant?.sizes.find((size) => size.sizeId === values.sizeId) || null;
            const allowOutOfStock = productOptions?.allowOutOfStockProductsAdding === true;
            const sizeOptions = (selectedVariant?.sizes || []).map((size) => ({
              value: size.sizeId,
              label: `${size.sizeName} - ${formatMoney(size.price)}${size.isOutOfStock ? ' (out of stock)' : ` (${size.stock} in stock)`}`,
              disabled: !size.isSelectable,
            }));

            const subtotal = items.reduce((sum, line) => sum + lineUnitPrice(line, values.applyBulkPricing) * lineQuantity(line), 0);
            const discountValue = MONEY_PATTERN.test(values.discount.trim()) ? Number(values.discount) : 0;
            const shippingValue = MONEY_PATTERN.test(values.shipping.trim()) ? Number(values.shipping) : 0;

            const canPickProducts = values.isWalkIn || !!values.userId;

            return (
              <div className="space-y-5">
                <Card title={<span className="font-bold">1. Customer</span>} subtitle={values.isWalkIn ? 'Enter the walk-in customer details' : 'Choose how to search, then pick the customer this order is for'}>
                  <div className="space-y-4">
                    <div>
                      <Checkbox name="isWalkIn" label="User out of System" checked={values.isWalkIn} onChange={handleWalkInToggle} />
                      <p className="mt-1 ml-6 text-sm text-gray-500">Tick for a cash counter sale where the customer has no account. No account is created.</p>
                    </div>

                    {values.isWalkIn ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <InputField label="Name" name="wName" placeholder="Customer name" value={values.wName} onChange={handleChange('wName')} onBlur={handleBlur('wName')} required maxLength={50} showError={false} />
                            {textError('wName')}
                          </div>
                          <div>
                            <InputField label="Phone" name="wPhone" type="tel" placeholder="e.g. +919876543210" value={values.wPhone} onChange={handleChange('wPhone')} onBlur={handleBlur('wPhone')} required maxLength={14} showError={false} />
                            {textError('wPhone')}
                          </div>
                          <div>
                            <InputField label="WhatsApp (optional)" name="wWhatsapp" type="tel" placeholder="e.g. +919876543210" value={values.wWhatsapp} onChange={handleChange('wWhatsapp')} onBlur={handleBlur('wWhatsapp')} maxLength={14} showError={false} />
                            {textError('wWhatsapp')}
                          </div>
                          <div>
                            <InputField label="Email (optional)" name="wEmail" type="email" placeholder="name@example.com" value={values.wEmail} onChange={handleChange('wEmail')} onBlur={handleBlur('wEmail')} showError={false} />
                            {textError('wEmail')}
                          </div>
                        </div>
                        <div>
                          <TextArea label="Address (optional)" name="wAddress" placeholder="Customer address" value={values.wAddress} onChange={handleChange('wAddress')} onBlur={handleBlur('wAddress')} rows={3} maxLength={MAX_ADDRESS_LENGTH} showCharCount showError={false} />
                          {textError('wAddress')}
                        </div>
                        <div>
                          <Checkbox
                            name="applyTax"
                            label="Apply tax"
                            checked={values.applyTax}
                            onChange={(e) => {
                              handleChange('applyTax')(e);
                              // No tax at all - nothing left to enter by hand.
                              if (!e.target.checked) {
                                setFieldValue('isTaxManual', false);
                                setFieldValue('manualTax', '');
                              }
                            }}
                          />
                          <p className="mt-1 ml-6 text-sm text-gray-500">Taxes are worked out using the store's own country and state. Untick for a tax-free sale.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Dropdown
                            label="Search user by"
                            name="searchField"
                            placeholder="Select an option"
                            options={searchFields.map((field) => ({ value: field.key, label: field.label }))}
                            value={values.searchField}
                            onChange={handleSearchFieldChange}
                            required
                            error={showError('searchField')}
                          />
                          <Dropdown
                            label="User"
                            name="userId"
                            placeholder={values.searchField ? (userOptions.length ? 'Select a user' : 'No active users found') : 'Select "Search user by" first'}
                            options={userOptions}
                            value={values.userId}
                            onChange={handleUserChange}
                            disabled={!values.searchField || userOptions.length === 0}
                            required
                            searchable
                            error={showError('userId')}
                          />
                        </div>
                        {values.userId && (
                          <Dropdown
                            label="Saved address (optional)"
                            name="addressId"
                            placeholder={addressOptions.length ? 'Select a saved address' : 'This user has no saved addresses'}
                            options={addressOptions}
                            value={values.addressId}
                            onChange={(value) => {
                              setFieldValue('addressId', value);
                              // A saved address replaces the typed one, so drop any typed text.
                              if (value) setFieldValue('addressText', '');
                            }}
                            disabled={addressOptions.length === 0}
                            clearable
                            searchable
                          />
                        )}
                      </>
                    )}
                  </div>
                </Card>

                {canPickProducts && (
                  <>
                    <Card title={<span className="font-bold">2. Products</span>} subtitle="Pick a product, variant and size, then add it to the order">
                      <div className="space-y-5">
                        <CategoryPathPicker
                          categories={categories}
                          mainCategoryId={values.mainCategory}
                          subCategoryId={values.subCategory}
                          nestingAllowed={isCategoryNestingAllowed}
                          onChange={handleCategoryChange}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <Dropdown
                            label="Product"
                            name="productId"
                            placeholder={productDropdownOptions.length ? 'Select a product' : 'No active products found'}
                            options={productDropdownOptions}
                            value={values.productId}
                            onChange={handleProductChange}
                            disabled={productDropdownOptions.length === 0}
                            searchable
                          />
                          <Dropdown
                            label="Variant"
                            name="variantId"
                            placeholder={values.productId ? 'Select a variant' : 'Select a product first'}
                            options={variants.map((variant) => ({ value: variant.variantId, label: variant.variantName }))}
                            value={values.variantId}
                            onChange={(value) => {
                              setFieldValue('variantId', value);
                              setFieldValue('sizeId', '');
                            }}
                            disabled={!values.productId || variants.length === 0}
                            searchable
                          />
                          <Dropdown
                            label="Size"
                            name="sizeId"
                            placeholder={values.variantId ? 'Select a size' : 'Select a variant first'}
                            options={sizeOptions}
                            value={values.sizeId}
                            onChange={(value) => setFieldValue('sizeId', value)}
                            disabled={!values.variantId}
                          />
                        </div>

                        {selectedSize?.isOutOfStock && allowOutOfStock && (
                          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                            This size is out of stock. Your store allows adding out-of-stock products, so it can still be ordered - stock will stay at 0.
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                          <InputField
                            label="Quantity"
                            name="quantity"
                            type="number"
                            placeholder="e.g. 2"
                            value={values.quantity}
                            onChange={handleChange('quantity')}
                            disabled={!values.sizeId}
                            showError={false}
                          />
                          <div className="text-sm text-gray-600 pb-2">
                            {selectedSize ? <>Unit price: <span className="font-semibold">{formatMoney(selectedSize.price)}</span></> : null}
                          </div>
                          <Button type="button" variant="secondary" onClick={() => addItem(values, setFieldValue)} disabled={!values.sizeId}>
                            Add item
                          </Button>
                        </div>
                        {lineError && <p className="text-sm text-red-600" role="alert">{lineError}</p>}

                        {isBulkPricingFeatureOn && (
                          <div>
                            <Checkbox
                              name="applyBulkPricing"
                              label="Apply Bulk Pricing"
                              checked={values.applyBulkPricing}
                              onChange={(e) => {
                                setFieldValue('applyBulkPricing', e.target.checked);
                                setApplyBulkPricing(e.target.checked);
                              }}
                            />
                            <p className="mt-1 ml-6 text-sm text-gray-500">Charge each item its bulk pricing tier price for the quantity ordered. Untick to charge the normal price.</p>
                          </div>
                        )}

                        <Table
                          columns={itemColumns}
                          data={items}
                          keyField="key"
                          actions={itemActions}
                          emptyMessage="No items added yet."
                        />
                        {itemsError && <p className="text-sm text-red-600" role="alert">{itemsError}</p>}
                      </div>
                    </Card>

                    <Card title={<span className="font-bold">3. Delivery, discount, shipping and tax</span>} subtitle="Everything here is optional">
                      <div className="space-y-4">
                        {!values.isWalkIn && !values.addressId && (
                          <div>
                            <TextArea
                              label="Delivery address (optional)"
                              name="addressText"
                              placeholder="Type the full delivery address, if it is not one of the saved addresses"
                              value={values.addressText}
                              onChange={handleChange('addressText')}
                              onBlur={handleBlur('addressText')}
                              rows={3}
                              maxLength={MAX_ADDRESS_LENGTH}
                              showCharCount
                              showError={false}
                            />
                            {textError('addressText')}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <InputField label="Discount amount" name="discount" type="number" placeholder="0.00" value={values.discount} onChange={handleChange('discount')} onBlur={handleBlur('discount')} showError={false} />
                            {textError('discount')}
                          </div>
                          <div>
                            <InputField label="Shipping amount" name="shipping" type="number" placeholder="0.00" value={values.shipping} onChange={handleChange('shipping')} onBlur={handleBlur('shipping')} showError={false} />
                            {textError('shipping')}
                          </div>
                        </div>

                        {isTaxAllowed(values) && (
                          <div>
                            <Checkbox
                              name="isTaxManual"
                              label="Enter tax manually"
                              checked={values.isTaxManual}
                              onChange={(e) => {
                                setFieldValue('isTaxManual', e.target.checked);
                                if (!e.target.checked) setFieldValue('manualTax', '');
                              }}
                            />
                            <p className="mt-1 ml-6 text-sm text-gray-500">Type one tax total for the whole order instead of the automatically calculated tax.</p>
                            {values.isTaxManual && (
                              <div className="mt-2 ml-6 max-w-xs">
                                <InputField label="Tax amount" name="manualTax" type="number" placeholder="0.00" value={values.manualTax} onChange={handleChange('manualTax')} onBlur={handleBlur('manualTax')} required showError={false} />
                                {textError('manualTax')}
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <TextArea label="Remarks (optional)" name="remarks" placeholder="Internal note about this order" value={values.remarks} onChange={handleChange('remarks')} onBlur={handleBlur('remarks')} rows={2} maxLength={MAX_REMARKS_LENGTH} showError={false} />
                          {textError('remarks')}
                        </div>
                      </div>
                    </Card>

                    <OrderSummaryCard values={values} items={items} subtotal={subtotal} discountValue={discountValue} shippingValue={shippingValue} />

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => { handleReset(); setIsWalkIn(false); setApplyBulkPricing(false); setItems([]); setUsers([]); setAddresses([]); setProductOptions(null); setLineError(''); setItemsError(''); }} disabled={submitting}>
                        Reset
                      </Button>
                      <Button type="submit" variant="primary" loading={submitting}>
                        Place Order
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          }}
        </Form>
      )}
    </div>
  );
};

export default AdminPlaceOrderPage;
