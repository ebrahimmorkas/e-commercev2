// Must run before any other require - several modules below (e.g.
// abandonedCartService -> utils/common.js) read process.env at module-load
// time (ID_ENCRYPTION_KEY/IV, computed once as top-level consts), not
// lazily. Loading dotenv after them meant common.js always saw those vars
// as unset and silently fell back to a random per-process key, so every
// encoded id became undecodable on every single restart.
require('dotenv').config({ quiet: true });

const express = require('express');
const http = require('http');
const cors = require('cors')
const cookieParser = require('cookie-parser')
const connectDB = require('./config/dbConfig')
const logger = require('./utils/logger.js')
const {connectRedis} = require('./config/redisConfig');
const realtimeService = require('./services/realtimeService');
const abandonedCartService = require('./services/abandonedCartService');
const expiryReminderService = require('./services/expiryReminderService');
const sentEmailCleanupService = require('./services/sentEmailCleanupService');
const keepAliveService = require('./services/keepAliveService');
// Middlewares
const { requestContext } = require('./middlewares/requestContext');
const vendorDetection = require('./middlewares/vendorDetection');
const ensureVendorDataCached = require('./middlewares/ensureVendorDataCached');
// Routes
const companySettingsRoutes = require('./routes/companySettingsRoutes');
const companyMasterRoutes = require('./routes/companyMasterRoutes');
const moduleMasterRoutes = require('./routes/moduleMasterRoutes');
const shippingPriceSettingsRoutes = require('./routes/shippingPriceSettingsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const categoryRoutes = require('./routes/categoryRoutes.js');
const addressRoutes = require('./routes/addressRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const productRoutes = require('./routes/productRoutes.js');
const reviewRoutes = require('./routes/reviewRoutes.js');
const discountRoutes = require('./routes/discountRoutes.js');
const groupRoutes = require('./routes/groupRoutes.js');
const sizeMasterRoutes = require('./routes/sizeMasterRoutes.js');
const unitMasterRoutes = require('./routes/unitMasterRoutes');
const weightMasterRoutes = require('./routes/weightMasterRoutes');
const countryMasterRoutes = require('./routes/countryMasterRoutes.js');
const stateMasterRoutes = require('./routes/stateMasterRoutes.js');
const cityMasterRoutes = require('./routes/cityMasterRoutes.js');
const taxMasterRoutes = require('./routes/taxMasterRoutes.js');
const locationTaxBundleRoutes = require('./routes/locationTaxBundleRoutes.js');
const cartRoutes = require('./routes/cartRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const adminPlaceOrderRoutes = require('./routes/adminPlaceOrderRoutes.js');
const orderReturnRoutes = require('./routes/orderReturnRoutes.js');
const orderExchangeRoutes = require('./routes/orderExchangeRoutes.js');
const brandMasterRoutes = require('./routes/brandMasterRoutes.js');
const courierMasterRoutes = require('./routes/courierMasterRoutes.js');
const sentEmailRoutes = require('./routes/sentEmailRoutes.js');
const emailTemplateMasterRoutes = require('./routes/emailTemplateMasterRoutes.js');
const favoriteRoutes = require('./routes/favoriteRoutes.js');
const paymentRoutes = require('./routes/paymentRoutes.js');
const freeCashRoutes = require('./routes/freeCashRoutes.js');
const abandonedCartRoutes = require('./routes/abandonedCartRoutes.js');
const userRoutes = require('./routes/userRoutes.js');

const app = express();
const httpServer = http.createServer(app);

// The live backend sits behind the frontend host's /api rewrite and the
// hosting platform's own proxy, so the Host header is the backend's own
// address. Trusting the proxy makes req.hostname read X-Forwarded-Host (the
// storefront domain the customer actually typed) - vendorDetection needs that.
app.set('trust proxy', true);

// Used by the hosting platform to check the process is up. Must stay above
// vendorDetection - the platform calls it on the backend's own address, which
// is no vendor's domain.
app.get('/healthz', (req, res) => {
    try {
        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        logger.logException('Exception in health check', error);
    }
});

// Must be the first middleware mounted - every downstream middleware,
// controller, and service needs to run inside its AsyncLocalStorage context
// so utils/logger.js's logException() can reach req.vendorId/req.user for
// the ErrorLog it writes, without changing any existing logException() call site.
app.use(requestContext);

// The frontend reaches this API on its own origin (Vite proxy in development,
// the frontend host's /api rewrite when live), so no other origin needs
// access. To let one in, list it in CORS_ALLOWED_ORIGINS (comma separated,
// e.g. https://shop.example.com).
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsAllowedOrigins.length > 0 ? corsAllowedOrigins : false,
  credentials: true,
}));

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use('/uploads', express.static('uploads'));

// Apply middlewares to all routes
app.use(vendorDetection);

if (process.env.IS_REDIS_SERVER_ON == 1) {
    logger.logInfo(1, 0, "Redis is enabled");
    connectRedis();
}

app.use(ensureVendorDataCached);

// Routes
// Public Routes
app.use('/api/company-master', companyMasterRoutes);
app.use('/api/modules', moduleMasterRoutes);
app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/shipping-price-settings', shippingPriceSettingsRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/sizes', sizeMasterRoutes);
app.use('/api/units', unitMasterRoutes);
app.use('/api/weights', weightMasterRoutes);
app.use('/api/countries', countryMasterRoutes);
app.use('/api/states', stateMasterRoutes);
app.use('/api/cities', cityMasterRoutes);
app.use('/api/taxes', taxMasterRoutes);
app.use('/api/location-tax-bundle', locationTaxBundleRoutes);
app.use('/api/currency', require('./routes/currencyRoutes'));
app.use('/api/cart', cartRoutes);

// Private Routes
app.use('/api/announcements', announcementRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/reviewRoutes', reviewRoutes);
app.use('/api/discount', discountRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery-agents', require('./routes/deliveryAgentRoutes'));
app.use('/api/admin-place-order', adminPlaceOrderRoutes);
app.use('/api/order-returns', orderReturnRoutes);
app.use('/api/order-exchanges', orderExchangeRoutes);
app.use('/api/brands', brandMasterRoutes);
app.use('/api/couriers', courierMasterRoutes);
app.use('/api/send-email', sentEmailRoutes);
app.use('/api/email-templates', emailTemplateMasterRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/free-cash', freeCashRoutes);
app.use('/api/free-cash-usage', require('./routes/freeCashUsageRoutes'));
app.use('/api/abandoned-cart', abandonedCartRoutes);
app.use('/api/users', userRoutes);

// Start of dummy to be removed
app.get("/", (req, res) => {
    res.send("Hello");
});

// End of dummy to be removed

// Must stay after every route: turns anything thrown outside a controller's
// try/catch into an ErrorLog + the error-page 500 (or a 4xx for bad input).
app.use(require('./middlewares/errorHandler'));

realtimeService.init(httpServer);
abandonedCartService.startAbandonedCartScanner();
// Discount / Free Cash "Expiring Soon" emails.
expiryReminderService.startExpiryReminderScanner();
// Deletes files uploaded for one Send Email email after the retention period.
sentEmailCleanupService.startSendEmailCleanup();
// Stops Render's free plan from putting the server to sleep (no-op elsewhere).
keepAliveService.startKeepAlive();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
});

module.exports = app;