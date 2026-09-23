/**
 * The Tax line(s) of the cart/checkout Order Summary, from a
 * /cart/tax-estimate result (see hooks/useTaxEstimate.js): one row per tax
 * when several apply, a single "Tax" row otherwise.
 *
 * @param {Object|null} props.estimate
 * @param {(amount: number) => string} props.formatMoney
 */
const TaxEstimateRows = ({ estimate, formatMoney }) => {
  if (!estimate) return null;
  const taxes = estimate.taxes || [];

  return (
    <>
      {taxes.length > 1 ? (
        taxes.map((tax) => (
          <div key={tax.taxId || tax.taxName} className="mt-2 flex justify-between text-sm text-slate-600">
            <span>{tax.taxName}</span>
            <span>{formatMoney(tax.taxAmount)}</span>
          </div>
        ))
      ) : (
        <div className="mt-2 flex justify-between text-sm text-slate-600">
          <span>{taxes[0]?.taxName || 'Tax'}</span>
          <span>{formatMoney(estimate.totalTaxAmount)}</span>
        </div>
      )}
      {estimate.isStoreLocation && (
        <p className="mt-1 text-xs text-slate-400">Tax estimated for the store&apos;s location until a delivery address is chosen.</p>
      )}
    </>
  );
};

export default TaxEstimateRows;
