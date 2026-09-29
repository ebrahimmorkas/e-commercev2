import { useState } from 'react';
import theme from '../../Home/theme/theme';

const formatEndDate = (dateValue) =>
  dateValue ? new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Cart page Discounts box, from a /cart/eligible-discounts result (see
 * hooks/useDiscounts.js): a checkbox per eligible discount plus a coupon code
 * field. Auto-apply discounts start ticked when nothing is applied yet.
 * Applied coupon discounts aren't in the list (codes are never listed), so
 * they show on their own and are kept whenever the selection is re-applied.
 * Render it with `key` = the applied ids (and whether the list has loaded) so
 * the selection resets whenever the server changes what is applied.
 *
 * @param {Object|null} props.info
 * @param {Array} props.appliedDiscounts - cart.discounts
 * @param {boolean} props.saving
 * @param {Array} props.rejections - [{ discountName?, reason }]
 * @param {Function} props.onApply - Called with { discountIds, couponCode }; resolves true on success.
 * @param {Function} props.onRemove
 * @param {Function} [props.onSignIn]
 * @param {(amount: number) => string} props.formatMoney
 */
const DiscountPanel = ({ info, appliedDiscounts = [], saving, rejections = [], onApply, onRemove, onSignIn, formatMoney }) => {
  const options = info?.discounts || [];
  const listedIds = options.map((d) => String(d.discountId));
  const appliedIds = appliedDiscounts.map((d) => String(d.discountId));
  const appliedAmountById = new Map(appliedDiscounts.map((d) => [String(d.discountId), d.discountAmount]));
  // Applied but not listed = entered as a coupon code.
  const appliedCoupons = appliedDiscounts.filter((d) => !listedIds.includes(String(d.discountId)));

  const [selectedIds, setSelectedIds] = useState(() =>
    appliedIds.length > 0
      ? appliedIds.filter((id) => listedIds.includes(id))
      : options.filter((d) => d.autoApply).map((d) => String(d.discountId))
  );
  const [couponCode, setCouponCode] = useState('');

  if (!info?.isEnabled) return null;

  if (info.requiresLogin) {
    return (
      <div className={`rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Discounts</h2>
        <p className="mt-2 text-sm text-slate-600">
          {onSignIn ? (
            <button type="button" onClick={onSignIn} className="font-semibold text-amber-700 hover:text-amber-800 cursor-pointer">
              Log in
            </button>
          ) : (
            'Log in'
          )}{' '}
          to see the discounts available to you.
        </p>
      </div>
    );
  }

  const toggle = (id) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const couponIds = appliedCoupons.map((d) => String(d.discountId));
  const wantedIds = [...selectedIds, ...couponIds];
  const canApply = !saving && selectedIds.length > 0 && !sameIds(wantedIds, appliedIds);

  const applyCoupon = async (event) => {
    event.preventDefault();
    const code = couponCode.trim();
    if (!code) return;
    // Keeps what is already applied and adds the coupon to it.
    const applied = await onApply({ discountIds: appliedIds, couponCode: code });
    if (applied) setCouponCode('');
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Discounts</h2>

      {options.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {options.map((option) => {
            const id = String(option.discountId);
            const isSelected = selectedIds.includes(id);
            const appliedAmount = appliedAmountById.get(id);
            const endDate = formatEndDate(option.endDate);
            return (
              <li key={id}>
                <label
                  className={`flex gap-3 rounded-lg border p-3 cursor-pointer transition-colors duration-150 ${
                    isSelected ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(id)}
                    disabled={saving}
                    className="mt-0.5 accent-amber-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-semibold text-slate-900 break-words">{option.name}</span>
                      <span className="text-xs font-semibold text-emerald-600">
                        {appliedAmount !== undefined ? `Applied · − ${formatMoney(appliedAmount)}` : `− ${formatMoney(option.discountAmount)}`}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.discountType === 'PERCENTAGE' ? `${option.discountValue}% off` : `${formatMoney(option.discountValue)} off`}
                      {option.discountValidAboveAmount > 0 && <> · Min. order {formatMoney(option.discountValidAboveAmount)}</>}
                      {option.minimumQuantity && <> · Min. {option.minimumQuantity} items</>}
                    </span>
                    {option.description && <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>}
                    {option.validOnItems?.length > 0 && (
                      <span className="mt-0.5 block text-xs text-slate-500">Valid on: {option.validOnItems.join(', ')}</span>
                    )}
                    {!option.isMultipleDiscountUsageOn && (
                      <span className="mt-0.5 block text-xs text-slate-400">Can&apos;t be combined with other discounts</span>
                    )}
                    {endDate && <span className="mt-0.5 block text-xs text-slate-400">Ends {endDate}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">No discounts available for this cart right now.</p>
      )}

      {appliedCoupons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {appliedCoupons.map((coupon) => (
            <li key={String(coupon.discountId)} className="flex justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700 break-words">Coupon: {coupon.discountName}</span>
              <span className="font-semibold text-emerald-600 shrink-0">− {formatMoney(coupon.discountAmount)}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={applyCoupon} className="mt-3 flex gap-2">
        <input
          type="text"
          value={couponCode}
          onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
          placeholder="Coupon code"
          aria-label="Coupon code"
          maxLength={50}
          disabled={saving}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={saving || !couponCode.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply code
        </button>
      </form>

      {rejections.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {rejections.map((rejection, index) => (
            <li key={index} className="text-xs text-red-600">
              {rejection.discountName ? `${rejection.discountName}: ` : ''}
              {rejection.reason}
            </li>
          ))}
        </ul>
      )}

      {(options.length > 0 || appliedIds.length > 0) && (
        <div className="mt-3 flex gap-2">
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => onApply({ discountIds: wantedIds })}
              disabled={!canApply}
              className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              {saving ? 'Saving...' : 'Apply'}
            </button>
          )}
          {appliedIds.length > 0 && (
            <button
              type="button"
              onClick={onRemove}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50"
            >
              Remove all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscountPanel;
