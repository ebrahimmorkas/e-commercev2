import { useMemo, useState } from 'react';
import theme from '../../Home/theme/theme';
import { useStorefrontProductDetail } from '../hooks/useStorefrontProductDetail';
import { useRecommendedProducts } from '../hooks/useRecommendedProducts';
import QuantityStepper from '../components/QuantityStepper';
import ProductCard from '../components/ProductCard';
import Spinner from '../../../../components/common/Spinner/Spinner';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';

const pickDefaultVariant = (variants) => variants.find((v) => v.isDefaultVariant) || variants[0] || null;
const pickDefaultSize = (variant) =>
  variant?.sizes.find((s) => s.isDefaultSize) || variant?.sizes[0] || null;

const formatPolicy = (label, policy) => {
  if (!policy?.isAvailable) return null;
  const duration = policy.duration
    ? `${policy.duration} ${policy.durationType?.toLowerCase() || ''}`.trim()
    : null;
  return duration ? `${label} (${duration})` : label;
};

const BulkPricingTable = ({ bulkPricing }) => {
  if (!bulkPricing?.length) return null;
  return (
    <div className={`mt-6 rounded-xl overflow-hidden ${theme.card.bulkBackground}`}>
      <p className={`px-4 pt-3 text-xs font-bold tracking-wide uppercase ${theme.card.bulkLabel}`}>
        Bulk Pricing
      </p>
      <table className="w-full text-sm mt-1">
        <thead>
          <tr className="text-left text-slate-500 text-xs">
            <th className="px-4 py-1.5 font-medium">Quantity</th>
            <th className="px-4 py-1.5 font-medium">Price / unit</th>
          </tr>
        </thead>
        <tbody>
          {bulkPricing.map((tier, i) => (
            <tr key={i} className="border-t border-amber-200/60">
              <td className={`px-4 py-2 ${theme.card.bulkText}`}>
                {tier.minimumQuantity} - {tier.maximumQuantity}
              </td>
              <td className={`px-4 py-2 font-semibold ${theme.card.price}`}>₹{tier.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Storefront product detail page: full variant/color + size picker, bulk
 * pricing table, description/disclaimer, and policy badges for one product.
 * Image treatment matches ProductCard - fit-whole-image, never cropped.
 *
 * @param {Object} props
 * @param {string} props.productId - Mongo _id of the product to load.
 * @param {Function} [props.onBack] - Called when the shopper wants to return to the grid.
 * @param {Function} [props.onAddToCart] - Called with { product, variant, size } to add the selected size to the cart.
 * @param {Object} [props.cartItems] - Map of cart-item id (size id) -> quantity.
 * @param {Function} [props.onIncrementItem] - Called with a cart-item id to increase its quantity.
 * @param {Function} [props.onDecrementItem] - Called with a cart-item id to decrease (or remove) its quantity.
 * @param {Function} [props.onProductClick] - Called with a recommended product's card shape when it's opened.
 * @param {Function} [props.onRecommendedAddToCart] - Called with a recommended product's card shape on its own Add to Cart.
 */
const ProductDetailPage = ({
  productId,
  onBack,
  onAddToCart,
  cartItems = {},
  onIncrementItem,
  onDecrementItem,
  onProductClick,
  onRecommendedAddToCart,
}) => {
  const { product, loading, error, reload } = useStorefrontProductDetail(productId);
  const { products: recommendedProducts } = useRecommendedProducts(product?.recommendedProducts);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedSizeId, setSelectedSizeId] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);

  // Re-derive the default variant/size selection whenever a *different*
  // product finishes loading - adjusting state during render (React's
  // documented pattern for this) instead of an effect, since this only
  // needs to happen once per product, not after every render.
  const [selectionForProductId, setSelectionForProductId] = useState(null);
  if (product && product.id !== selectionForProductId) {
    const defaultVariant = pickDefaultVariant(product.variants);
    setSelectionForProductId(product.id);
    setSelectedVariantId(defaultVariant?.id || null);
    setSelectedSizeId(pickDefaultSize(defaultVariant)?.id || null);
  }

  const selectedVariant = useMemo(
    () => product?.variants.find((v) => v.id === selectedVariantId) || null,
    [product, selectedVariantId]
  );
  const selectedSize = useMemo(
    () => selectedVariant?.sizes.find((s) => s.id === selectedSizeId) || null,
    [selectedVariant, selectedSizeId]
  );

  const gallery = useMemo(() => {
    if (!selectedSize) return [];
    return [selectedSize.image, ...selectedSize.additionalImages].filter(Boolean);
  }, [selectedSize]);

  // Same render-time adjustment for the gallery, keyed on the size actually
  // showing it rather than the gallery array (a new array every render would
  // otherwise re-trigger this on every keystroke/interaction elsewhere).
  const [activeImageForSizeId, setActiveImageForSizeId] = useState(null);
  if (selectedSizeId !== activeImageForSizeId) {
    setActiveImageForSizeId(selectedSizeId);
    setActiveImage(gallery[0] || null);
    setImageBroken(false);
  }

  const handleSelectVariant = (variant) => {
    setSelectedVariantId(variant.id);
    setSelectedSizeId(pickDefaultSize(variant)?.id || null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" label="Loading product" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <EmptyState
          title="Couldn't load this product"
          description={error}
          action={
            <button
              type="button"
              onClick={reload}
              className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${theme.hero.cta}`}
            >
              Try Again
            </button>
          }
        />
      </div>
    );
  }

  if (!product) return null;

  const discountPct =
    selectedSize?.cancelledPrice && selectedSize.cancelledPrice > selectedSize.price
      ? Math.round((1 - selectedSize.price / selectedSize.cancelledPrice) * 100)
      : null;

  const policies = [
    formatPolicy('Warranty', selectedSize?.warranty),
    formatPolicy('Returns', selectedSize?.return),
    formatPolicy('Exchange', selectedSize?.exchange),
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer mb-6"
      >
        ← Back to shop
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <div
            className={`aspect-square flex items-center justify-center overflow-hidden rounded-xl ${theme.card.imageBackground}`}
          >
            {activeImage && !imageBroken ? (
              <img
                src={activeImage}
                alt={product.name}
                onError={() => setImageBroken(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className={`text-sm font-bold tracking-widest uppercase ${theme.card.imageText}`}>
                {product.category}
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {gallery.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveImage(url);
                    setImageBroken(false);
                  }}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer ${
                    activeImage === url ? 'border-amber-500' : 'border-transparent'
                  } ${theme.card.imageBackground}`}
                >
                  <img src={url} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className={`text-xs font-semibold tracking-wide uppercase ${theme.card.category}`}>
            {product.category}
          </p>
          <h1 className={`mt-1 text-2xl font-bold ${theme.card.name}`}>{product.name}</h1>
          <p className="mt-1 text-xs text-slate-400">{product.productCode}</p>

          {product.variants.length > 1 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => handleSelectVariant(variant)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors duration-150 ${
                      variant.id === selectedVariantId
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {variant.displayName || variant.color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedVariant && selectedVariant.sizes.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Size</p>
              <div className="flex gap-2 flex-wrap">
                {selectedVariant.sizes.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    disabled={size.stock <= 0}
                    onClick={() => setSelectedSizeId(size.id)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors duration-150 ${
                      size.stock <= 0
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed line-through'
                        : size.id === selectedSizeId
                        ? 'bg-slate-900 border-slate-900 text-white cursor-pointer'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400 cursor-pointer'
                    }`}
                  >
                    {size.labelValue || size.sizeName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${theme.card.price}`}>₹{selectedSize?.price ?? '—'}</span>
            {discountPct && (
              <>
                <span className="text-base text-slate-400 line-through">₹{selectedSize.cancelledPrice}</span>
                <span className="text-sm font-semibold text-green-600">{discountPct}% off</span>
              </>
            )}
          </div>

          <p className={`mt-1 text-sm ${selectedSize?.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {selectedSize?.stock > 0 ? `In stock (${selectedSize.stock} available)` : 'Out of stock'}
          </p>

          {selectedSize?.excludeText && (
            <p className="mt-2 text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              {selectedSize.excludeText}
            </p>
          )}

          <div className="mt-5 sm:w-64">
            <QuantityStepper
              size="lg"
              quantity={selectedSize ? cartItems[selectedSize.id] || 0 : 0}
              inStock={selectedSize?.stock > 0}
              maxQuantity={selectedSize?.stock}
              onAdd={() => onAddToCart?.({ product, variant: selectedVariant, size: selectedSize })}
              onIncrement={() => onIncrementItem?.(selectedSize.id)}
              onDecrement={() => onDecrementItem?.(selectedSize.id)}
            />
          </div>

          <BulkPricingTable bulkPricing={selectedSize?.bulkPricing} />

          {policies.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {policies.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
          )}

          {selectedSize?.description?.length > 0 && (
            <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
              {selectedSize.description.map((entry, i) => (
                <div key={i} className="contents">
                  <dt className="text-slate-500">{entry.key}</dt>
                  <dd className="text-slate-800">{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {selectedSize?.disclaimer?.length > 0 && (
            <ul className="mt-4 text-xs text-slate-400 list-disc pl-4 space-y-0.5">
              {selectedSize.disclaimer.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {recommendedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className={`text-lg font-bold ${theme.section.heading}`}>You May Also Like</h2>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {recommendedProducts.map((recommended) => {
              const itemId = recommended.sizeId || recommended.id;
              return (
                <ProductCard
                  key={recommended.id}
                  product={recommended}
                  quantity={cartItems[itemId] || 0}
                  onAddToCart={onRecommendedAddToCart}
                  onOpen={onProductClick}
                  onIncrement={() => onIncrementItem?.(itemId)}
                  onDecrement={() => onDecrementItem?.(itemId)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
