import theme from '../theme/theme';
import { GemIcon } from '../icons';

const PRODUCTS = [
  { id: 1, name: 'Preciosa Crystal Chatons — SS20 Crystal AB', category: 'Crystals', unit: '/ gross (144 pcs)', price: 380 },
  { id: 2, name: 'Sew-On Rhinestones — Crystal Clear SS16', category: 'Rhinestones', unit: '/ 100 pcs', price: 220 },
  { id: 3, name: 'Crystal Shank Buttons — Assorted Colors', category: 'Buttons', unit: '/ dozen', price: 340 },
  { id: 4, name: 'Czech Glass Pearls — Ivory 8mm', category: 'Pearls', unit: '/ 100 pcs', price: 180 },
  { id: 5, name: 'Fire Polished Beads — Pressed Glass 6mm', category: 'Pressed Glass Beads', unit: '/ 100 pcs', price: 210 },
  { id: 6, name: 'Seed Bead Mix — Metallic Gold 11/0', category: 'Seed Beads', unit: '/ 50g', price: 150 },
];

const ProductCard = ({ product, onAddToCart }) => (
  <div
    className={`rounded-xl border overflow-hidden transition-shadow duration-150 ${theme.card.background} ${theme.card.border} ${theme.card.shadow}`}
  >
    <div className={`h-40 flex items-center justify-center ${theme.card.imageBackground}`}>
      <span className={`text-xs font-bold tracking-widest uppercase ${theme.card.imageText}`}>{product.category}</span>
    </div>
    <div className="p-4">
      <p className={`text-[11px] font-semibold tracking-wide uppercase ${theme.card.category}`}>{product.category}</p>
      <h3 className={`mt-0.5 text-sm font-semibold ${theme.card.name}`}>{product.name}</h3>
      <p className={`mt-1 text-base font-bold ${theme.card.price}`}>
        ₹{product.price}
        <span className="text-xs font-normal text-slate-400"> {product.unit}</span>
      </p>
      <button
        type="button"
        onClick={() => onAddToCart?.(product)}
        className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${theme.card.button}`}
      >
        Add to Cart
      </button>
    </div>
  </div>
);

const PartnerBadge = () => (
  <div
    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wide uppercase ${theme.partnerBadge.background} ${theme.partnerBadge.border} ${theme.partnerBadge.text}`}
  >
    <GemIcon className={`w-4 h-4 shrink-0 ${theme.partnerBadge.icon}`} />
    Preciosa&reg; Crystals Authorized Partner
  </div>
);

/**
 * Client-facing storefront landing page: hero banner + featured products grid.
 *
 * @param {Object} props
 * @param {Function} [props.onAddToCart] - Called with the selected product when "Add to Cart" is clicked.
 */
const HomePage = ({ onAddToCart }) => {
  return (
    <div className={theme.page.background}>
      <section className={`${theme.hero.background} px-4 sm:px-6 py-20`}>
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <p className={`text-sm font-semibold tracking-wide uppercase ${theme.hero.eyebrow}`}>
            Hutaib Tailoring Materials
          </p>
          <h1 className={`mt-3 text-3xl sm:text-5xl font-bold ${theme.hero.heading}`}>
            Crystals, Pearls &amp; Beads for Every Creation
          </h1>
          <p className={`mt-4 max-w-xl text-base ${theme.hero.subheading}`}>
            Genuine Preciosa crystals, rhinestones, buttons, pearls and pressed glass beads —
            sourced with care, delivered with pride.
          </p>
          <button
            type="button"
            className={`mt-8 px-6 py-3 rounded-full text-sm font-semibold transition-colors duration-150 cursor-pointer ${theme.hero.cta}`}
          >
            Shop Now
          </button>
          <div className="mt-6">
            <PartnerBadge />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="text-center mb-10">
          <h2 className={`text-2xl font-bold ${theme.section.heading}`}>Featured Products</h2>
          <p className={`mt-2 text-sm ${theme.section.subheading}`}>A few of our customer favorites</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
