import { useState } from 'react';
import theme from '../../Home/theme/theme';

const formatEndDate = (dateValue) =>
  dateValue ? new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Cart page Discounts box, from a /cart/eligible-discounts result (see
 * hooks/useDiscounts.js): a checkbox per eligible discount plus a coupon code
 * field. Discounts meant for the shopper that the cart can't use yet
 * (isLocked) are listed greyed out with the reason (lockedReason, e.g. "Add
 * items worth ₹3 more to unlock this discount.") and can't be ticked. The
 * coupon field only shows when the store has a coupon this shopper could use
 * (hasCouponDiscounts) or one is already applied; those coupons (info.coupons)
 * are listed above it - name, value, minimum and "Add X more" - but never
 * their codes, which still have to be typed in.
 * Auto-apply discounts start ticked when nothing is applied yet.
 * Applied coupon discounts aren't in the list (codes are never listed), so
 * they show on their own and are kept whenever the selection is re-applied.
 * Render it with `key` = the applied ids and the usable ids so the selection
 * resets whenever the server changes what is applied or usable.
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
  const usableIds = options.filter((d) => !d.isLocked).map((d) => String(d.discountId));
  const appliedIds = appliedDiscounts.map((d) => String(d.discountId));
  const appliedAmountById = new Map(appliedDiscounts.map((d) => [String(d.discountId), d.discountAmount]));
  // Applied but not listed = entered as a coupon code.
  const appliedCoupons = appliedDiscounts.filter((d) => !listedIds.includes(String(d.discountId)));

  const [selectedIds, setSelectedIds] = useState(() =>
    appliedIds.length > 0
      ? appliedIds.filter((id) => usableIds.includes(id))
      : options.filter((d) => d.autoApply && !d.isLocked).map((d) => String(d.discountId))
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
  // A discount that became locked since it was ticked is never sent.
  const usableSelectedIds = selectedIds.filter((id) => usableIds.includes(id));
  const wantedIds = [...usableSelectedIds, ...couponIds];
  const canApply = !saving && usableSelectedIds.length > 0 && !sameIds(wantedIds, appliedIds);
  const showCouponField = info.hasCouponDiscounts === true || appliedCoupons.length > 0;
  // Coupons the shopper could use (never their codes), minus any already applied.
  const offeredCoupons = (info.coupons || []).filter((c) => !appliedIds.includes(String(c.discountId)));

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
            const isLocked = option.isLocked === true;
            const isSelected = !isLocked && selectedIds.includes(id);
            const appliedAmount = appliedAmountById.get(id);
            const endDate = formatEndDate(option.endDate);
            let labelClass = 'border-slate-200 hover:border-slate-300 cursor-pointer';
            if (isLocked) labelClass = 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed';
            else if (isSelected) labelClass = 'border-amber-400 bg-amber-50 cursor-pointer';
            return (
              <li key={id}>
                <label
                  className={`flex gap-3 rounded-lg border p-3 transition-colors duration-150 ${labelClass}`}
                  aria-disabled={isLocked}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(id)}
                    disabled={saving || isLocked}
                    className="mt-0.5 accent-amber-600 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-semibold text-slate-900 break-words">{option.name}</span>
                      {isLocked ? (
                        <span className="text-xs font-semibold text-slate-500">Not available yet</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">
                          {appliedAmount !== undefined ? `Applied · − ${formatMoney(appliedAmount)}` : `− ${formatMoney(option.discountAmount)}`}
                        </span>
                      )}
                    </span>
                    {isLocked && option.lockedReason && (
                      <span className="mt-0.5 block text-xs font-medium text-amber-700">{option.lockedReason}</span>
                    )}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.discountType === 'PERCENTAGE' ? `${option.discountValue}% off` : `${formatMoney(option.discountValue)} off`}
                      {option.discountValidAboveAmount > 0 && (
                        <>
                          {' · '}
                          {option.appliesToWholeCart === false ? 'Min. spend on eligible items' : 'Min. order'}{' '}
                          {formatMoney(option.discountValidAboveAmount)}
                        </>
                      )}
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
        // Only coupons on offer: point at the code box instead of saying there's nothing.
        !showCouponField && <p className="mt-2 text-xs text-slate-400">No discounts available for this cart right now.</p>
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

      {showCouponField && (
        <p className={`${options.length > 0 || appliedCoupons.length > 0 ? 'mt-4' : 'mt-2'} text-xs font-medium text-slate-600`}>
          Have a coupon code? Enter it below.
        </p>
      )}

      {offeredCoupons.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {offeredCoupons.map((coupon) => (
            <li
              key={String(coupon.discountId)}
              className={`rounded-lg border border-dashed px-3 py-2 ${coupon.isLocked ? 'border-slate-300 bg-slate-50' : 'border-emerald-300 bg-emerald-50'}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-xs font-semibold text-slate-900 break-words">{coupon.name}</span>
                <span className={`text-xs font-semibold ${coupon.isLocked ? 'text-slate-500' : 'text-emerald-600'}`}>
                  {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% off` : `${formatMoney(coupon.discountValue)} off`}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {coupon.discountValidAboveAmount > 0
                  ? `${coupon.appliesToWholeCart === false ? 'Min. spend on eligible items' : 'Min. order'} ${formatMoney(coupon.discountValidAboveAmount)}`
                  : 'No minimum order'}
                {coupon.minimumQuantity && <> · Min. {coupon.minimumQuantity} items</>}
                {!coupon.isLocked && <> · usable now, saves {formatMoney(coupon.discountAmount)}</>}
              </span>
              {coupon.isLocked && coupon.lockedReason && (
                <span className="mt-0.5 block text-xs font-medium text-amber-700">{coupon.lockedReason}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {showCouponField && (
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
      )}

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

      {(usableIds.length > 0 || appliedIds.length > 0) && (
        <div className="mt-3 flex gap-2">
          {usableIds.length > 0 && (
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
