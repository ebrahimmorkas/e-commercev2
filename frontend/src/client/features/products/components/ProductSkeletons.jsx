import theme from '../../Home/theme/theme';

// Loading placeholders shaped like the real ProductCard / ProductListItem, so
// the page keeps its layout while products load instead of jumping when they
// arrive. Purely visual - announced once via the wrapper's aria-busy/label.

const Bar = ({ className }) => <span className={`block rounded bg-slate-200 animate-pulse ${className}`} />;

export const ProductCardSkeleton = () => (
  <div className={`${theme.card.layout} ${theme.card.background} ${theme.card.border}`}>
    <div className={`${theme.card.imageWrapperLayout} bg-slate-100 animate-pulse`} />
    <div className={theme.card.body}>
      <Bar className="h-2.5 w-1/3" />
      <Bar className="mt-2 h-3.5 w-4/5" />
      <Bar className="mt-2 h-4 w-1/2" />
      <Bar className="mt-3 h-9 w-full rounded-lg" />
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 6, label = 'Loading products' }) => (
  <div className={theme.section.grid} aria-busy="true" aria-label={label} role="status">
    {Array.from({ length: count }, (_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export const ProductListItemSkeleton = () => (
  <div className={`${theme.listCard.layout} ${theme.card.background} ${theme.card.border}`}>
    <div className={`${theme.listCard.imageWrapperLayout} bg-slate-100 animate-pulse`} />
    <div className={theme.listCard.bodyLayout}>
      <Bar className="h-2.5 w-24" />
      <Bar className="mt-2 h-3.5 w-3/5" />
      <Bar className="mt-2 h-4 w-28" />
    </div>
    <div className={theme.listCard.actionsWrapperLayout}>
      <Bar className="h-9 w-full rounded-lg" />
    </div>
  </div>
);

export const ProductListSkeleton = ({ count = 5, label = 'Loading products' }) => (
  <div className="flex flex-col gap-3 sm:gap-4" aria-busy="true" aria-label={label} role="status">
    {Array.from({ length: count }, (_, i) => (
      <ProductListItemSkeleton key={i} />
    ))}
  </div>
);
