const express = require('express');
const connectDB = require('./config/dbConfig')
const cors = require('cors')
const logger = require('./utils/logger.js')
const {connectRedis} = require('./config/redisConfig');
require('dotenv').config();
// Middlewares
const vendorDetection = require('./middlewares/vendorDetection');
const ensureVendorDataCached = require('./middlewares/ensureVendorDataCached');
// Routes
const companySettingsRoutes = require('./routes/companySettingsRoutes');
const companyMasterRoutes = require('./routes/companyMasterRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const bannerRoutes = require('./routes/bannerRoutes');

const app = express();

app.use(cors({
  origin: '*',
}));

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Apply middlewares to all routes
app.use(vendorDetection);

if (process.env.IS_REDIS_SERVER_ON == 1) {
    logger.logInfo("Redis is enabled");
    connectRedis();
    app.use(ensureVendorDataCached);
}

// Routes
// Public Routes
app.use('/api/company-master', companyMasterRoutes);
app.use('/api/company-settings', companySettingsRoutes);
// Private Routes
app.use('/api/announcements', announcementRoutes);
app.use('/api/banners', bannerRoutes);

// Start of dummy to be removed
app.get("/", (req, res) => {
    res.send("Hello");
});

app.get('/flush-redis', async (req, res) => {
    const redisService = require('./services/redisService');
    await redisService.del('website-master');
    res.send('Flushed');
});
// End of dummy to be removed

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  // console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = app;