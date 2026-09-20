import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import CategoryPathPicker from '../../../../components/common/CategoryPathPicker';
import Spinner from '../../../../components/common/Spinner';
import { useEditOrderProducts } from '../hooks/useEditOrderProducts';
import { formatOrderMoney } from '../utils/formatOrder';
import theme from '../theme/theme';

const MAX_QUANTITY = 100000;

// Grid whose cells wrap by the container's width (the modal is narrower than the viewport, so
// fixed sm:grid-cols-3 columns were too tight and let neighbouring text overlap).
const FIELD_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3';

/**
 * Edit Order: add more products to an order that has already been placed. The
 * picker is the one Place Order uses (category -> product -> variant -> size ->
 * quantity). Added lines are priced at the live price and taxed like any other
 * line; the order's total grows by their subtotal plus tax (backend
 * orderEditService.addProductsToOrder). Existing items, discount and shipping
 * are left as they are.
 *
 * @param {Object} order - The order being edited (currency + existing items).
 * @param {Function} onSubmit - (items: [{ productId, variantId, sizeId, quantity }]) => Promise<boolean>
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

  const addedSubtotal = items.reduce((sum, line) => sum + line.unitPrice * (lineQuantityError(line) ? 0 : lineQuantity(line)), 0);

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
    setSubmitError('');
    await onSubmit(items.map((line) => ({ productId: line.productId, variantId: line.variantId, sizeId: line.sizeId, quantity: lineQuantity(line) })));
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

      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {items.map((line) => {
            const error = lineQuantityError(line);
            return (
              <div key={line.key} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-medium text-gray-900 wrap-break-word">{line.productName}</p>
                  <p className="text-xs text-gray-500 wrap-break-word">
                    {line.variantName} / {line.sizeName} · {formatOrderMoney(order, line.unitPrice)} each
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
                    {formatOrderMoney(order, error ? 0 : line.unitPrice * lineQuantity(line))}
                  </span>
                  <Button type="button" variant={theme.button.ghost} size="sm" onClick={() => removeItem(line.key)} disabled={submitting}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-between px-3 py-2 text-sm font-semibold text-gray-900 bg-gray-50">
            <span>Added subtotal (tax is added automatically)</span>
            <span>{formatOrderMoney(order, addedSubtotal)}</span>
          </div>
        </div>
      )}
      {submitError && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {submitError}
        </p>
      )}

      <p className="text-xs text-gray-400">
        New products are priced at today&apos;s price and taxed like any other item. The order total goes up by their subtotal plus tax; the existing discount and shipping price are not changed (use Edit Shipping Price for that).
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
