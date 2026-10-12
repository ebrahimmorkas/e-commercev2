import { useEffect, useState } from 'react';
import Button from '../../../../components/common/Buttons';
import InputField from '../../../../components/common/InputField';
import Checkbox from '../../../../components/common/Checkbox';
import Alert from '../../../../components/common/Alert';
import { formatOrderMoney } from '../utils/formatOrder';
import { previewOrderItemChanges } from '../api/orderAdminApi';
import { getCompanyMasterData } from '../../adminPlaceOrder/api/adminPlaceOrderApi';
import { useTaxPreview } from '../../adminPlaceOrder/hooks/useTaxPreview';
import theme from '../theme/theme';

const MAX_QUANTITY = 100000;

const lineKey = (line) => `${line.productId}:${line.variantId}:${line.sizeId}`;

/**
 * Edit Order: change the quantity of, or remove, the products already on a
 * placed order (backend orderEditService.updateOrderItems). Nothing is saved
 * until "Save changes"; until then the server previews the new totals, any
 * discount / Free Cash the smaller order would lose, and stock problems.
 *
 * Increasing a quantity re-prices that line at today's price (or its bulk
 * pricing tier price when "Apply Bulk Pricing" is ticked); decreasing keeps
 * the price saved on the order. Whether a quantity may go over the stock is
 * the store's "Allow Out-of-Stock Products to Be Added to Cart for admin" setting.
 *
 * @param {Object} order - The order being edited.
 * @param {Function} onSubmit - (items: [{ productId, variantId, sizeId, quantity }], applyBulkPricing: boolean) => Promise<boolean>; quantity 0 removes the line.
 * @param {boolean} submitting - Another change to this order is being saved.
 */
const EditOrderItemsForm = ({ order, onSubmit, submitting }) => {
  // Only the lines the admin touched: { [lineKey]: { quantityText, removed } }.
  const [drafts, setDrafts] = useState({});
  const [applyBulkPricing, setApplyBulkPricing] = useState(false);
  const [isBulkPricingFeatureOn, setIsBulkPricingFeatureOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCompanyMasterData()
      .then((master) => {
        if (!cancelled) setIsBulkPricingFeatureOn(!!master?.isBulkPricingFeatureOn);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const lines = order.items || [];
  const money = (value) => formatOrderMoney(order, value);
  const busy = submitting || saving;

  const draftOf = (line) => drafts[lineKey(line)] || { quantityText: String(line.quantity), removed: false };
  const setDraft = (line, patch) => {
    setDrafts((current) => ({ ...current, [lineKey(line)]: { ...draftOf(line), ...patch } }));
    setSubmitError('');
  };

  const quantityError = (line) => {
    const draft = draftOf(line);
    if (draft.removed) return '';
    const qty = Number(draft.quantityText);
    if (!String(draft.quantityText).trim() || !Number.isInteger(qty) || qty < 1) return 'Whole number, at least 1';
    if (qty > MAX_QUANTITY) return `At most ${MAX_QUANTITY}`;
    return '';
  };

  const step = (line, delta) => {
    const current = Number(draftOf(line).quantityText);
    const base = Number.isInteger(current) && current >= 1 ? current : line.quantity;
    setDraft(line, { quantityText: String(Math.min(MAX_QUANTITY, Math.max(1, base + delta))) });
  };

  const remainingCount = lines.filter((line) => !draftOf(line).removed).length;
  const hasInvalid = lines.some((line) => quantityError(line));
  // What is sent: only the lines that really change; quantity 0 removes the line.
  const changes = hasInvalid
    ? []
    : lines
        .filter((line) => draftOf(line).removed || Number(draftOf(line).quantityText) !== line.quantity)
        .map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          sizeId: line.sizeId,
          quantity: draftOf(line).removed ? 0 : Number(draftOf(line).quantityText),
        }));
  const hasIncrease = !hasInvalid && lines.some((line) => !draftOf(line).removed && Number(draftOf(line).quantityText) > line.quantity);
  const bulkPricingOn = isBulkPricingFeatureOn && applyBulkPricing && hasIncrease;

  const request = changes.length > 0 ? { orderId: order._id, items: changes, applyBulkPricing: bulkPricingOn } : null;
  const { preview, loading: previewLoading, error: previewError } = useTaxPreview(previewOrderItemChanges, request);
  const previewLineOf = (line) => (preview?.lines || []).find((entry) => lineKey(entry) === lineKey(line)) || null;

  const handleSave = async () => {
    if (hasInvalid) {
      setSubmitError('Fix the quantities marked in red first.');
      return;
    }
    if (changes.length === 0) {
      setSubmitError('Change a quantity or remove a product first.');
      return;
    }
    setSubmitError('');
    setSaving(true);
    try {
      await onSubmit(changes, bulkPricingOn);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDrafts({});
    setSubmitError('');
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Products on this order</h4>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {lines.map((line) => {
          const draft = draftOf(line);
          const error = quantityError(line);
          const changed = draft.removed || (!error && Number(draft.quantityText) !== line.quantity);
          const previewLine = changed ? previewLineOf(line) : null;
          const unitPrice = previewLine && !previewLine.isRemoved ? previewLine.unitPrice : line.unitPrice;
          const isLastRemaining = !draft.removed && remainingCount <= 1;
          return (
            <div key={lineKey(line)} className={`flex flex-wrap items-start justify-between gap-3 px-3 py-2 text-sm ${draft.removed ? 'bg-gray-50' : ''}`}>
              <div className="min-w-0 flex-1 basis-40">
                <p className={`font-medium wrap-break-word ${draft.removed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{line.productName}</p>
                <p className="text-xs text-gray-500 wrap-break-word">
                  {line.variantName} / {line.sizeName} · {money(unitPrice)} each
                  {unitPrice !== line.unitPrice && (
                    <>
                      {' '}
                      <span className="line-through text-gray-400">{money(line.unitPrice)}</span> <span className="text-emerald-600">Today&apos;s price</span>
                    </>
                  )}
                </p>
                {draft.removed ? (
                  <p className="mt-0.5 text-xs text-red-600">Will be removed from the order</p>
                ) : (
                  changed && <p className="mt-0.5 text-xs text-gray-500">Was {line.quantity}</p>
                )}
              </div>

              {!draft.removed && (
                <div className="shrink-0">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={theme.button.secondary}
                      size="sm"
                      ariaLabel={`Decrease quantity of ${line.productName}`}
                      onClick={() => step(line, -1)}
                      disabled={busy || Number(draft.quantityText) <= 1}
                    >
                      -
                    </Button>
                    <div className="w-20">
                      <InputField
                        name={`order-qty-${lineKey(line)}`}
                        type="number"
                        min={1}
                        value={draft.quantityText}
                        onChange={(e) => setDraft(line, { quantityText: e.target.value })}
                        // A number input has its own intrinsic width; w-full keeps it inside its cell.
                        className="w-full min-w-0 text-center"
                        disabled={busy}
                        showError={false}
                      />
                    </div>
                    <Button
                      type="button"
                      variant={theme.button.secondary}
                      size="sm"
                      ariaLabel={`Increase quantity of ${line.productName}`}
                      onClick={() => step(line, 1)}
                      disabled={busy || Number(draft.quantityText) >= MAX_QUANTITY}
                    >
                      +
                    </Button>
                  </div>
                  {error && (
                    <p className={`mt-1 text-xs ${theme.text.error}`} role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0 pt-1.5">
                <span className={`font-semibold whitespace-nowrap ${draft.removed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {money(previewLine && !previewLine.isRemoved ? previewLine.lineAmount : line.lineAmount)}
                </span>
                {draft.removed ? (
                  <Button type="button" variant={theme.button.ghost} size="sm" onClick={() => setDraft(line, { removed: false })} disabled={busy}>
                    Undo
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={theme.button.ghost}
                    size="sm"
                    onClick={() => setDraft(line, { removed: true })}
                    disabled={busy || isLastRemaining}
                    title={isLastRemaining ? 'An order must keep at least one product' : undefined}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {changes.length > 0 && (
          <dl className="px-3 py-2 text-sm space-y-1 bg-gray-50">
            {previewLoading && <p className="text-xs text-gray-500">Calculating the new total...</p>}
            {preview && (
              <>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd>{money(preview.updated.subtotal)}</dd>
                </div>
                {(preview.previous.totalDiscountAmount > 0 || preview.updated.totalDiscountAmount > 0) && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Discount</dt>
                    <dd>- {money(preview.updated.totalDiscountAmount)}</dd>
                  </div>
                )}
                {(preview.previous.totalFreeCashAmount > 0 || preview.updated.totalFreeCashAmount > 0) && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Free cash used</dt>
                    <dd>- {money(preview.updated.totalFreeCashAmount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-600">Tax</dt>
                  <dd>{money(preview.updated.totalTaxAmount)}</dd>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                  <dt>Order total</dt>
                  <dd>
                    <span className="font-normal text-gray-400 line-through mr-2">{money(preview.previous.grandTotal)}</span>
                    {money(preview.updated.grandTotal)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
      </div>

      {preview?.promotionChanges?.length > 0 && (
        <Alert variant="warning" title="Discounts and Free Cash on this order">
          <ul className="list-disc pl-4 space-y-0.5">
            {preview.promotionChanges.map((change) => (
              <li key={`${change.type}-${change.name}`}>
                {change.isRemoved
                  ? `"${change.name}" no longer applies to this order. It will be removed (${money(change.previousAmount)}) and given back to the customer to use again.`
                  : `"${change.name}" goes down from ${money(change.previousAmount)} to ${money(change.newAmount)}.`}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {preview?.warnings?.length > 0 && (
        <Alert variant="info" title="Not enough stock">
          <ul className="list-disc pl-4 space-y-0.5">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p className="mt-1">Your store allows the admin to add out-of-stock products, so the order can still be saved - stock will stay at 0.</p>
        </Alert>
      )}

      {isBulkPricingFeatureOn && hasIncrease && (
        <div>
          <Checkbox
            name="applyBulkPricingToChanges"
            label="Apply Bulk Pricing"
            checked={applyBulkPricing}
            onChange={(e) => setApplyBulkPricing(e.target.checked)}
            disabled={busy}
          />
          <p className="mt-1 ml-6 text-xs text-gray-500">Charge each increased item its bulk pricing tier price for its new quantity. Untick to charge the normal price.</p>
        </div>
      )}

      {(previewError || submitError) && (
        <p className={`text-sm ${theme.text.error}`} role="alert">
          {previewError || submitError}
        </p>
      )}

      <p className="text-xs text-gray-400">
        Increasing a quantity charges that item at today&apos;s price; decreasing keeps the price on the order. Removed and reduced quantities go back into stock. The shipping price is not changed (use Edit Shipping Price for that).
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={reset} disabled={busy || Object.keys(drafts).length === 0}>
          Reset
        </Button>
        <Button
          type="button"
          variant={theme.button.primary}
          onClick={handleSave}
          loading={saving}
          disabled={submitting || changes.length === 0 || previewLoading || !!previewError}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
};

export default EditOrderItemsForm;
