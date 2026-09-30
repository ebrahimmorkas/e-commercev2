import { useState } from 'react';
import theme from '../../Home/theme/theme';

const formatExpiry = (dateValue) =>
  dateValue ? new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Cart page Free Cash box, from a /cart/eligible-free-cash result (see
 * hooks/useFreeCash.js). Checkboxes when the store lets several be applied
 * together, radio buttons otherwise. Each usable one says what it would take
 * off this cart (applicableAmount); one the cart can't use yet (isLocked) is
 * greyed out with the reason (lockedReason, e.g. "Add items worth ₹50 more to
 * unlock this Free Cash.") and can't be picked. Render it with `key` = the
 * applied ids and the usable ids so the selection resets whenever the server
 * changes what is applied or usable.
 *
 * @param {Object|null} props.info
 * @param {Array} props.appliedFreeCash - cart.freeCash
 * @param {boolean} props.saving
 * @param {Array} props.rejections - [{ freeCashName?, reason }]
 * @param {Function} props.onApply - Called with the selected freeCashIds.
 * @param {Function} props.onRemove
 * @param {Function} [props.onSignIn]
 * @param {(amount: number) => string} props.formatMoney
 */
const FreeCashPanel = ({ info, appliedFreeCash = [], saving, rejections = [], onApply, onRemove, onSignIn, formatMoney }) => {
  const appliedIds = appliedFreeCash.map((f) => String(f.freeCashId));
  const [selectedIds, setSelectedIds] = useState(appliedIds);

  if (!info?.isEnabled) return null;

  const options = info.freeCash || [];
  const multiple = info.isMultipleFreeCashUsageAllowed === true;
  const appliedAmountById = new Map(appliedFreeCash.map((f) => [String(f.freeCashId), f.amountApplied]));

  if (info.requiresLogin) {
    return (
      <div className={`rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Free Cash</h2>
        <p className="mt-2 text-sm text-slate-600">
          {onSignIn ? (
            <button type="button" onClick={onSignIn} className="font-semibold text-amber-700 hover:text-amber-800 cursor-pointer">
              Log in
            </button>
          ) : (
            'Log in'
          )}{' '}
          to use your Free Cash on this order.
        </p>
      </div>
    );
  }

  if (options.length === 0 && appliedIds.length === 0) return null;

  const toggle = (id) => {
    if (!multiple) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const usableIds = options.filter((o) => !o.isLocked).map((o) => String(o.freeCashId));
  // Something that became locked since it was picked is never sent.
  const usableSelectedIds = selectedIds.filter((id) => usableIds.includes(id) || appliedIds.includes(id));
  const canApply = !saving && usableSelectedIds.length > 0 && !sameIds(usableSelectedIds, appliedIds);

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${theme.card.background} ${theme.card.border}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Free Cash</h2>
      <p className="mt-1 text-xs text-slate-400">
        {multiple ? 'Choose the Free Cash to use on this order.' : 'Choose one Free Cash to use on this order.'}
      </p>

      <ul className="mt-3 space-y-2">
        {options.map((option) => {
          const id = String(option.freeCashId);
          const appliedAmount = appliedAmountById.get(id);
          // An applied one stays pickable even if the cart changed since (the server re-checks it).
          const isLocked = option.isLocked === true && appliedAmount === undefined;
          const isSelected = !isLocked && selectedIds.includes(id);
          const expiry = formatExpiry(option.endDate);
          let labelClass = 'border-slate-200 hover:border-slate-300 cursor-pointer';
          if (isLocked) labelClass = 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed';
          else if (isSelected) labelClass = 'border-amber-400 bg-amber-50 cursor-pointer';
          return (
            <li key={id}>
              <label className={`flex gap-3 rounded-lg border p-3 transition-colors duration-150 ${labelClass}`} aria-disabled={isLocked}>
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  name="free-cash"
                  checked={isSelected}
                  onChange={() => toggle(id)}
                  disabled={saving || isLocked}
                  className="mt-0.5 accent-amber-600 disabled:cursor-not-allowed"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-semibold text-slate-900 break-words">{option.freeCashName}</span>
                    {appliedAmount !== undefined ? (
                      <span className="text-xs font-semibold text-emerald-600">Applied · − {formatMoney(appliedAmount)}</span>
                    ) : isLocked ? (
                      <span className="text-xs font-semibold text-slate-500">Not available yet</span>
                    ) : (
                      option.applicableAmount > 0 && (
                        <span className="text-xs font-semibold text-emerald-600">− {formatMoney(option.applicableAmount)}</span>
                      )
                    )}
                  </span>
                  {isLocked && option.lockedReason && (
                    <span className="mt-0.5 block text-xs font-medium text-amber-700">{option.lockedReason}</span>
                  )}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Balance {formatMoney(option.remainingAmount)}
                    {option.validAbove > 0 && (
                      <>
                        {' · '}
                        {option.isCategoryRestricted ? 'Min. spend on eligible items' : 'Min. order'} {formatMoney(option.validAbove)}
                      </>
                    )}
                    {option.maxCashUsagePerOrder !== null && option.maxCashUsagePerOrder !== undefined && (
                      <> · Up to {formatMoney(option.maxCashUsagePerOrder)} per order</>
                    )}
                  </span>
                  {option.validOnCategories?.length > 0 && (
                    <span className="mt-0.5 block text-xs text-slate-500">Valid on: {option.validOnCategories.join(', ')}</span>
                  )}
                  {!option.canBeUsedWithOtherDiscounts && (
                    <span className="mt-0.5 block text-xs text-slate-400">Can&apos;t be combined with discounts</span>
                  )}
                  {expiry && <span className="mt-0.5 block text-xs text-slate-400">Expires {expiry}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {rejections.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {rejections.map((rejection, index) => (
            <li key={index} className="text-xs text-red-600">
              {rejection.freeCashName ? `${rejection.freeCashName}: ` : ''}
              {rejection.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onApply(usableSelectedIds)}
          disabled={!canApply}
          className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer bg-slate-900 hover:bg-amber-600 text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
        >
          {saving ? 'Saving...' : 'Apply'}
        </button>
        {appliedIds.length > 0 && (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};

export default FreeCashPanel;
