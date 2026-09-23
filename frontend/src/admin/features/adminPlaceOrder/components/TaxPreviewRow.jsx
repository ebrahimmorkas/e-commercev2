/**
 * The Tax row (plus a one-line note) of an admin order summary - Place Order
 * and Edit Order. Shows the admin's typed amount when tax is entered manually,
 * otherwise the server preview from useTaxPreview.
 *
 * @param {Object} props
 * @param {Object|null} props.preview - /tax-preview result.
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {boolean} props.isManual - "Enter tax manually" is ticked.
 * @param {number} props.manualAmount - The typed amount (0 when blank/invalid).
 * @param {boolean} [props.isTaxOff] - Tax switched off (walk-in "Apply tax" unticked, or an untaxed order).
 * @param {boolean} [props.hasItems] - Anything to price yet.
 * @param {(value: number) => string} props.formatMoney
 * @param {string} [props.label]
 */
const TaxPreviewRow = ({ preview, loading, error, isManual, manualAmount, isTaxOff = false, hasItems = true, formatMoney, label = 'Tax' }) => {
  let value;
  let note = '';

  if (isTaxOff) {
    value = formatMoney(0);
    note = 'No tax will be added.';
  } else if (isManual) {
    value = formatMoney(manualAmount);
    note = 'Entered manually.';
  } else if (!hasItems) {
    value = formatMoney(0);
  } else if (loading) {
    value = '...';
  } else if (error) {
    value = '-';
    note = error;
  } else if (preview) {
    value = formatMoney(preview.totalTaxAmount);
    const names = (preview.taxes || []).map((tax) => tax.taxName).join(', ');
    if (preview.isLocationMissing) {
      note = "No tax: the customer's location is unknown and no Store Country is set in Company Settings.";
    } else if (preview.isStoreLocation) {
      note = `Taxed at the store's location${names ? ` (${names})` : ''}.`;
    } else if (names) {
      note = names;
    }
  } else {
    value = formatMoney(0);
  }

  return (
    <>
      <div className="flex justify-between">
        <dt className="text-gray-600">{label}</dt>
        <dd>{value}</dd>
      </div>
      {note && <p className="text-xs text-right text-gray-400">{note}</p>}
    </>
  );
};

export default TaxPreviewRow;
