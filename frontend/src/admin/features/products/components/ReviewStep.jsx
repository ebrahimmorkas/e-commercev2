import Badge from '../../../../components/common/Badge';
import SectionCard from './SectionCard';
import { SparkleCheckIcon, SwatchIcon } from './icons';
import theme from '../theme/theme';

const ColorDot = ({ color }) => (
  <span className="w-3 h-3 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: color || '#d1d5db' }} aria-hidden="true" />
);

/**
 * Step 3: read-only summary before submit. Validation itself happens in
 * ProductForm.validateDraft() - this is purely a final glance.
 */
const ReviewStep = ({ draft }) => {
  const totalSizes = draft.variants.reduce((sum, v) => sum + v.sizes.length, 0);
  const totalStock = draft.variants.reduce((sum, v) => sum + v.sizes.reduce((s, sz) => s + (Number(sz.stock) || 0), 0), 0);

  return (
    <div className="space-y-4">
      <SectionCard icon={<SparkleCheckIcon />} title="Ready to submit" description="A last glance before this goes live.">
        <div>
          <p className={`text-xl font-semibold ${theme.text.heading}`}>{draft.name || 'Untitled product'}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {draft.colors.map((c) => (
              <Badge key={c} variant="purple">{c}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-center min-w-[84px]">
            <p className={`text-lg font-semibold ${theme.text.heading}`}>{draft.variants.length}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Variants</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-center min-w-[84px]">
            <p className={`text-lg font-semibold ${theme.text.heading}`}>{totalSizes}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Sizes</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-center min-w-[84px]">
            <p className={`text-lg font-semibold ${theme.text.heading}`}>{totalStock}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Stock units</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={<SwatchIcon />} title="Variants &amp; Sizes">
        {draft.variants.length === 0 && <p className={`text-sm ${theme.text.error}`}>No variants added yet.</p>}
        <div className="space-y-3">
          {draft.variants.map((variant) => (
            <div key={variant.clientId} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center gap-2">
                <ColorDot color={variant.color} />
                <span className={`font-medium ${theme.text.heading}`}>{variant.color || variant.displayName || 'Variant'}</span>
                {variant.isDefaultVariant && <Badge variant="blue" size="sm">Default</Badge>}
              </div>
              <ul className="mt-2 space-y-1.5">
                {variant.sizes.map((size) => (
                  <li key={size.clientId} className={`text-sm ${theme.text.body} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 border-t border-gray-100 pt-1.5 first:border-0 first:pt-0`}>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {size.sizeName || 'Size'}
                      {size.isDefaultSize && <Badge variant="blue" size="sm">Default</Badge>}
                      <span className="text-gray-400">SKU {size.sku || '—'}</span>
                    </span>
                    <span className="text-gray-500 font-medium tabular-nums">
                      ₹{size.price || 0} · Stock {size.stock ?? 0}
                    </span>
                  </li>
                ))}
                {variant.sizes.length === 0 && <li className={`text-sm ${theme.text.error}`}>No sizes added yet.</li>}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default ReviewStep;
