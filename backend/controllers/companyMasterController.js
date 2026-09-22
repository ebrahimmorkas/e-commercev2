const companyMasterService = require('../services/companyMasterService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Converts a CompanyMaster mongoose doc into a response-safe object with
// every ObjectId field encoded via common.encodeId. This is a separate,
// direct DB fetch (companyMasterService.fetchCompanyMasterByVendorId) from
// the Redis-cached req.companyMasterData ensureVendorDataCached/
// checkModuleAssigned read internally - that internal cache is never routed
// through this formatter and must keep holding raw ids.
const formatCompanyMasterForResponse = (doc) => {
  if (!doc) return doc;
  const companyMaster = doc.toObject ? doc.toObject() : doc;

  return {
    ...companyMaster,
    _id: companyMaster._id ? common.encodeId(companyMaster._id) : companyMaster._id,
    vendorId: companyMaster.vendorId ? common.encodeId(companyMaster.vendorId) : companyMaster.vendorId,
    allowedCountries: (companyMaster.allowedCountries || []).map((id) => common.encodeId(id)),
    allowedSizes: (companyMaster.allowedSizes || []).map((id) => common.encodeId(id)),
    allowedWeights: (companyMaster.allowedWeights || []).map((id) => common.encodeId(id)),
    orderSteps: companyMaster.orderSteps ? common.encodeId(companyMaster.orderSteps) : companyMaster.orderSteps,
    assignedModules: (companyMaster.assignedModules || []).map((entry) => ({
      ...entry,
      moduleId: entry.moduleId ? common.encodeId(entry.moduleId) : entry.moduleId,
    })),
  };
};

const getCompanyMasterData = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const companyMasterData = await companyMasterService.fetchCompanyMasterByVendorId(vendorId);
    if (!companyMasterData) {
      return common.sendError(res, 404, "Company master data not found");
    }
    return common.sendSuccess(res, 200, "Company master data fetched successfully", formatCompanyMasterForResponse(companyMasterData));
  } catch (error) {
    logger.logException('Error fetching company master data', { vendorId, error });
    return common.sendError(res, 500, "Failed to fetch company master data");
  }
};

module.exports = {
  getCompanyMasterData
};