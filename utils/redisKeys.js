const redisKeys = {
  companySettings: (vendorId) => `company-settings:${vendorId}`,
  companyMaster: (vendorId) => `company-master-configuration:${vendorId}`,
  websiteMaster: () => `website-master`,
  announcement: (vendorID) => `announcement:${vendorID}`,
  banner: (vendorId) => `banner:${vendorId}`,
  category: (vendorID) => `categories:${vendorID}`,
  categoryAdmin: (vendorID) => `categories-admin:${vendorID}`,
};

module.exports = redisKeys;