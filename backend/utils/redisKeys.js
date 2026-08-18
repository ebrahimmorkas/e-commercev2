const redisKeys = {
  companySettings: (vendorId) => `company-settings:${vendorId}`,
  companyMaster: (vendorId) => `company-master-configuration:${vendorId}`,
  websiteMaster: () => `website-master`,
  announcement: (vendorID) => `announcement:${vendorID}`,
  banner: (vendorId) => `banner:${vendorId}`,
  category: (vendorID) => `categories:${vendorID}`,
  categoryAdmin: (vendorID) => `categories-admin:${vendorID}`,
  reviews: (vendorId, productId) => `reviews:${vendorId} - ${productId}`,
  sizes: (vendorId) => `sizes:${vendorId}`,  
  units: () => `units`,
  countries: (vendorId) => `countries:${vendorId}`,
  states: (vendorId) => `states:${vendorId}`,
  cities: (vendorId) => `cities:${vendorId}`,
  taxes: (vendorId) => `taxes:${vendorId}`,
  locationTaxBundle: (vendorId) => `location-tax-bundle:${vendorId}`,
};

module.exports = redisKeys;