import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import CategoryPathPicker from '../../../../components/common/CategoryPathPicker';
import Checkbox from '../../../../components/common/Checkbox';
import Spinner from '../../../../components/common/Spinner';
import { useEditOrderProducts } from '../hooks/useEditOrderProducts';
import { formatOrderMoney } from '../utils/formatOrder';
import { bulkUnitPrice } from '../../../../utils/bulkPricing';
import { previewAddProductsTax } from '../api/orderAdminApi';
import { useTaxPreview } from '../../adminPlaceOrder/hooks/useTaxPreview';
import TaxPreviewRow from '../../adminPlaceOrder/components/TaxPreviewRow';
import theme from '../theme/theme';

const MAX_QUANTITY = 100000;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

// Grid whose cells wrap by the container's width (the modal is narrower than the viewport, so
// fixed sm:grid-cols-3 columns were too tight and let neighbouring text overlap).
const FIELD_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3';

/**
 * Edit Order: add more products to an order that has already been placed. The
 * picker is the one Place Order uses (category -> product -> variant -> size ->
 * quantity). Added lines are priced at the live price (or their bulk pricing
 * tier price when "Apply Bulk Pricing" is ticked) and taxed like any other
 * line; the order's total grows by their subtotal plus tax (backend
 * orderEditService.addProductsToOrder). Existing items, discount and shipping
 * are left as they are.
 *
 * @param {Object} order - The order being edited (currency + existing items).
 * @param {Function} onSubmit - (items: [{ productId, variantId, sizeId, quantity }], applyBulkPricing: boolean, manualTaxAmount: number|null) => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const EditOrderForm = ({ order, onSubmit, onCancel, submitting }) => {
  const picker = useEditOrderProducts();
  const [mainCategory, setMainCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState([]);
  const [lineError, setLineError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [applyBulkPricing, setApplyBulkPricing] = useState(false);
  const [isTaxManual, setIsTaxManual] = useState(false);
  const [manualTax, setManualTax] = useState('');

  // A walk-in sale placed with tax switched off stays untaxed (backend orderEditService).
  const orderIsUntaxed = !!order.isWalkInCustomer && (order.items || []).every((line) => !(line.taxBreakdown || []).length);
  const isManual = !orderIsUntaxed && isTaxManual;
  const manualTaxValid = MONEY_PATTERN.test(manualTax.trim());
  const manualAmount = manualTaxValid ? Number(manualTax) : 0;

  const variants = picker.productOptions?.variants || [];
  const selectedVariant = variants.find((v) => v.variantId === variantId) || null;
  const selectedSize = selectedVariant?.sizes.find((s) => s.sizeId === sizeId) || null;
  const allowOutOfStock = picker.productOptions?.allowOutOfStockProductsAdding === true;

  const productOptionsList = picker.products.map((p) => ({ value: p._id, label: p.productCode ? `${p.name} (${p.productCode})` : p.name }));
  const sizeOptions = (selectedVariant?.sizes || []).map((size) => ({
    value: size.sizeId,
    label: `${size.sizeName} - ${formatOrderMoney(order, size.price)}${size.isOutOfStock ? ' (out of stock)' : ` (${size.stock} in stock)`}`,
    disabled: !size.isSelectable,
  }));

  const resetPicker = () => {
    setProductId('');
    setVariantId('');
    setSizeId('');
    setQuantity('');
    picker.clearProductOptions();
  };

  const handleCategoryChange = (main, sub) => {
    setMainCategory(main);
    setSubCategory(sub);
    setProductId('');
    setVariantId('');
    setSizeId('');
    picker.clearProductOptions();
    // Products narrow to the deepest category picked so far.
    picker.loadProducts(sub || main || undefined);
  };

  const handleProductChange = (value) => {
    setProductId(value);
    setVariantId('');
    setSizeId('');
    picker.loadProductOptions(value);
  };

  const addItem = () => {
    const qty = Number(quantity);
    if (!productId || !selectedVariant || !selectedSize) return setLineError('Select a product, variant and size first.');
    if (!String(quantity).trim() || !Number.isInteger(qty) || qty < 1) return setLineError('Quantity must be a whole number of at least 1.');
    if (qty > MAX_QUANTITY) return setLineError(`Quantity cannot exceed ${MAX_QUANTITY}.`);
    if (!selectedSize.isSelectable) return setLineError('This size is out of stock.');
    if (!allowOutOfStock && qty > selectedSize.stock) return setLineError(`Only ${selectedSize.stock} in stock.`);

    const key = `${productId}:${variantId}:${sizeId}`;
    if (items.some((line) => line.key === key)) return setLineError('This product, variant and size is already in the list below.');
    // A line can only be on an order once (returns/exchanges are matched per line).
    if ((order.items || []).some((line) => `${line.productId}:${line.variantId}:${line.sizeId}` === key)) {
      return setLineError('This product, variant and size is already on the order.');
    }

    setItems((current) => [
      ...current,
      {
        key,
        productId,
        variantId,
        sizeId,
        productName: picker.productOptions.product.name,
        variantName: selectedVariant.variantName,
        sizeName: selectedSize.sizeName,
        unitPrice: selectedSize.price,
        bulkPricing: selectedSize.bulkPricing || [],
        stock: selectedSize.stock,
        allowOutOfStock,
        quantityText: String(qty),
      },
    ]);
    setLineError('');
    setSubmitError('');
    resetPicker();
  };

  const lineQuantity = (line) => Number(line.quantityText);

  // Same rules the picker enforces when a line is first added - re-checked as the quantity is edited.
  const lineQuantityError = (line) => {
    const qty = lineQuantity(line);
    if (!String(line.quantityText).trim() || !Number.isInteger(qty) || qty < 1) return 'Whole number, at least 1';
    if (qty > MAX_QUANTITY) return `At most ${MAX_QUANTITY}`;
    if (!line.allowOutOfStock && qty > line.stock) return `Only ${line.stock} in stock`;
    return '';
  };

  const updateQuantity = (key, quantityText) => {
    setItems((current) => current.map((line) => (line.key === key ? { ...line, quantityText } : line)));
    setSubmitError('');
  };

  const removeItem = (key) => setItems((current) => current.filter((line) => line.key !== key));

  // Preview of what "Apply Bulk Pricing" charges - the backend re-prices on submit.
  const bulkPricingOn = picker.isBulkPricingFeatureOn && applyBulkPricing;
  const lineUnitPrice = (line) => (bulkPricingOn ? bulkUnitPrice(line.unitPrice, line.bulkPricing, lineQuantity(line)) : line.unitPrice);

  const addedSubtotal = items.reduce((sum, line) => sum + lineUnitPrice(line) * (lineQuantityError(line) ? 0 : lineQuantity(line)), 0);

  // Server-calculated tax for the lines being added (only when it is auto-calculated).
  const itemsValid = items.length > 0 && !items.some((line) => lineQuantityError(line));
  const taxRequest = itemsValid && !orderIsUntaxed && !isManual
    ? {
        orderId: order._id,
        applyBulkPricing: bulkPricingOn,
        items: items.map((line) => ({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, quantity: lineQuantity(line) })),
      }
    : null;
  const taxPreview = useTaxPreview(previewAddProductsTax, taxRequest);
  const addedTax = orderIsUntaxed ? 0 : isManual ? manualAmount : taxPreview.preview?.totalTaxAmount || 0;
  const money = (value) => formatOrderMoney(order, value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setSubmitError('Add at least one product first.');
      return;
    }
    if (items.some((line) => lineQuantityError(line))) {
      setSubmitError('Fix the quantities marked in red first.');
      return;
    }
    if (isManual && !manualTaxValid) {
      setSubmitError('Enter the tax amount (up to 2 decimals), or untick "Enter tax manually".');
      return;
    }
    setSubmitError('');
    await onSubmit(
      items.map((line) => ({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, quantity: lineQuantity(line) })),
      bulkPricingOn,
      isManual ? manualAmount : null
    );
  };

  if (picker.loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Add products to this order</h4>

      <CategoryPathPicker
        categories={picker.categories}
        mainCategoryId={mainCategory}
        subCategoryId={subCategory}
        nestingAllowed={picker.isCategoryNestingAllowed}
        onChange={handleCategoryChange}
      />

      <div className={FIELD_GRID}>
        <Dropdown
          label="Product"
          placeholder={productOptionsList.length ? 'Select a product' : 'No active products found'}
          options={productOptionsList}
          value={productId}
          onChange={handleProductChange}
          disabled={productOptionsList.length === 0}
          searchable
        />
        <Dropdown
          label="Variant"
          placeholder={productId ? 'Select a variant' : 'Select a product first'}
          options={variants.map((v) => ({ value: v.variantId, label: v.variantName }))}
          value={variantId}
          onChange={(value) => {
            setVariantId(value);
            setSizeId('');
          }}
          disabled={!productId || variants.length === 0}
          searchable
        />
        <Dropdown
          label="Size"
          placeholder={variantId ? 'Select a size' : 'Select a variant first'}
          options={sizeOptions}
          value={sizeId}
          onChange={setSizeId}
          disabled={!variantId}
        />
      </div>

      {selectedSize?.isOutOfStock && allowOutOfStock && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This size is out of stock. Your store allows adding out-of-stock products, so it can still be added - stock will stay at 0.
        </p>
      )}

      <div className={`${FIELD_GRID} items-end`}>
        <InputField
          label="Quantity"
          type="number"
          placeholder="e.g. 2"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={!sizeId}
          showError={false}
        />
        <div className="text-sm text-gray-600 pb-2 min-w-0 wrap-break-word">
          {selectedSize ? (
            <>
              Unit price: <span className="font-semibold">{formatOrderMoney(order, selectedSize.price)}</span>
            </>
          ) : null}
        </div>
        <Button type="button" variant={theme.button.secondary} onClick={addItem} disabled={!sizeId}>
          Add item
        </Button>
      </div>
      {lineError && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {lineError}
        </p>
      )}

      {picker.isBulkPricingFeatureOn && (
        <div>
          <Checkbox
            name="applyBulkPricing"
            label="Apply Bulk Pricing"
            checked={applyBulkPricing}
            onChange={(e) => setApplyBulkPricing(e.target.checked)}
            disabled={submitting}
          />
          <p className="mt-1 ml-6 text-xs text-gray-500">Charge each added item its bulk pricing tier price for the quantity added. Untick to charge the normal price.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {items.map((line) => {
            const error = lineQuantityError(line);
            const unitPrice = lineUnitPrice(line);
            return (
              <div key={line.key} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-medium text-gray-900 wrap-break-word">{line.productName}</p>
                  <p className="text-xs text-gray-500 wrap-break-word">
                    {line.variantName} / {line.sizeName} · {formatOrderMoney(order, unitPrice)} each
                    {unitPrice !== line.unitPrice && (
                      <>
                        {' '}
                        <span className="line-through text-gray-400">{formatOrderMoney(order, line.unitPrice)}</span>{' '}
                        <span className="text-emerald-600">Bulk price</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <InputField
                    name={`qty-${line.key}`}
                    type="number"
                    min={1}
                    value={line.quantityText}
                    onChange={(e) => updateQuantity(line.key, e.target.value)}
                    // A number input has its own intrinsic width; w-full keeps it inside its w-28 cell.
                    className="w-full min-w-0"
                    disabled={submitting}
                    showError={false}
                  />
                  {error && (
                    <p className={`mt-1 text-xs ${theme.text.error}`} role="alert">
                      {error}
                    </p>
                  )}
                  {!error && line.allowOutOfStock && lineQuantity(line) > line.stock && (
                    <p className="mt-1 text-xs text-amber-700">Only {line.stock} in stock</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-1.5">
                  <span className="font-semibold text-gray-900 whitespace-nowrap">
                    {formatOrderMoney(order, error ? 0 : unitPrice * lineQuantity(line))}
                  </span>
                  <Button type="button" variant={theme.button.ghost} size="sm" onClick={() => removeItem(line.key)} disabled={submitting}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <dl className="px-3 py-2 text-sm space-y-1 bg-gray-50">
            <div className="flex justify-between">
              <dt className="text-gray-600">Added subtotal</dt>
              <dd>{money(addedSubtotal)}</dd>
            </div>
            <TaxPreviewRow
              preview={taxPreview.preview}
              loading={taxPreview.loading}
              error={taxPreview.error}
              isManual={isManual}
              manualAmount={manualAmount}
              isTaxOff={orderIsUntaxed}
              hasItems={itemsValid}
              formatMoney={money}
              label="Added tax"
            />
            <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
              <dt>Order total goes up by</dt>
              <dd>{money(addedSubtotal + addedTax)}</dd>
            </div>
          </dl>
        </div>
      )}
      {!orderIsUntaxed && items.length > 0 && (
        <div>
          <Checkbox
            name="isTaxManual"
            label="Enter tax manually"
            checked={isTaxManual}
            onChange={(e) => {
              setIsTaxManual(e.target.checked);
              if (!e.target.checked) setManualTax('');
              setSubmitError('');
            }}
            disabled={submitting}
          />
          <p className="mt-1 ml-6 text-xs text-gray-500">Type one tax total for the added products instead of the automatically calculated tax.</p>
          {isTaxManual && (
            <div className="mt-2 ml-6 w-40">
              <InputField
                label="Tax amount"
                name="manualTax"
                type="number"
                placeholder="0.00"
                value={manualTax}
                onChange={(e) => {
                  setManualTax(e.target.value);
                  setSubmitError('');
                }}
                className="w-full min-w-0"
                disabled={submitting}
                showError={false}
              />
            </div>
          )}
        </div>
      )}

      {submitError && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {submitError}
        </p>
      )}

      <p className="text-xs text-gray-400">
        New products are priced at today&apos;s price (or their bulk price, if ticked above) and taxed like any other item (or with the tax you enter). The order total goes up by their subtotal plus tax; the existing discount and shipping price are not changed (use Edit Shipping Price for that).
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting}>
          Add to order
        </Button>
      </div>
    </form>
  );
};

export default EditOrderForm;
