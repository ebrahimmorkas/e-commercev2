require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const ModuleMaster = require('../models/ModuleMaster');

// Mirrors the admin sidebar (frontend/src/components/ui/Sidebar/navItems.jsx).
// isSystemModule: true = core, always assigned to every vendor (see
// backfillAssignedModules.js), never gated behind an on/off feature flag.
const modules = [
    { moduleName: "Dashboard", shortModuleName: "Dashboard", code: "DASHBOARD", precedence: 1, isSystemModule: true, description: "Admin dashboard overview." },
    { moduleName: "Products", shortModuleName: "Products", code: "PRODUCTS", precedence: 2, isSystemModule: true, description: "Product catalog management." },
    { moduleName: "Categories", shortModuleName: "Categories", code: "CATEGORIES", precedence: 3, isSystemModule: false, description: "Category management." },
    { moduleName: "Brand Master", shortModuleName: "Brands", code: "BRAND", precedence: 4, isSystemModule: false, description: "Brand management." },
    { moduleName: "Orders", shortModuleName: "Orders", code: "ORDERS", precedence: 5, isSystemModule: true, description: "Order management." },
    { moduleName: "Customers", shortModuleName: "Customers", code: "CUSTOMERS", precedence: 6, isSystemModule: true, description: "Customer management." },
    { moduleName: "Discount", shortModuleName: "Discount", code: "DISCOUNT", precedence: 7, isSystemModule: false, description: "Discount campaigns." },
    { moduleName: "Banner", shortModuleName: "Banner", code: "BANNER", precedence: 8, isSystemModule: false, description: "Homepage banners." },
    { moduleName: "Announcement", shortModuleName: "Announcement", code: "ANNOUNCEMENT", precedence: 9, isSystemModule: false, description: "Site announcements." },
    { moduleName: "Abandoned Cart", shortModuleName: "Abandoned Cart", code: "ABANDONED_CART", precedence: 10, isSystemModule: false, description: "Abandoned cart recovery." },
    { moduleName: "Free Cash", shortModuleName: "Free Cash", code: "FREE_CASH", precedence: 11, isSystemModule: false, description: "Free Cash campaigns." },
    { moduleName: "Company Settings", shortModuleName: "Company Settings", code: "COMPANY_SETTINGS", precedence: 12, isSystemModule: true, description: "Vendor's own store configuration." }
];

async function seedModuleMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        for (const moduleData of modules) {
            const module = await ModuleMaster.findOneAndUpdate(
                { code: moduleData.code },
                { ...moduleData, status: "A" },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );
            console.log(`Seeded module: ${module.code}`);
        }

        console.log("ModuleMaster seeded successfully.");

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedModuleMaster();
