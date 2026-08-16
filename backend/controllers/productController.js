const productService = require('../services/productService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');
const token = require('../utils/token');

const getAllProductsAdmin = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const result = await productService.fetchAllProductsForAdmin(vendorId, req.query);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching products for admin', { vendorId, error });
    return common.sendError(res, 500, 'Failed to fetch products');
  }
};

const getAllProductsClient = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    let user;
    const authResult = await token.resolveUserFromAuthHeader(req.headers.authorization);
    if (authResult.ok) user = authResult.user;

    const result = await productService.fetchAllProductsForClient(vendorId, req.query, user);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching products for client', { vendorId, error });
    return common.sendError(res, 500, 'Failed to fetch products');
  }
};

const getProductById = async (req, res) => {
  const vendorId = req.vendorId;
  const { productId } = req.params;
  try {
    // Two different routes hit this same function:
    //  - /admin/products/:productId  -> `authenticate` already ran, so
    //    req.user is already set. Reuse it, don't re-hit the DB.
    //  - /products/:productId        -> no auth middleware at all, so
    //    resolve the token here directly. Any failure is treated as
    //    "guest" and never blocks the request.
    let user = req.user;
    if (!user) {
      const authResult = await token.resolveUserFromAuthHeader(req.headers.authorization);
      if (authResult.ok) user = authResult.user;
    }

    const isAdmin = !!(user && user.role === 'admin');
    const result = await productService.fetchProductById(vendorId, productId, isAdmin, user);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching product by id', { vendorId, productId, error });
    return common.sendError(res, 500, 'Failed to fetch product');
  }
};

const createProduct = async (req, res) => {
  const vendorId = req.vendorId;
//   const userId = req.user._id;
const userId = "6a6ed077b8ad83c8d068dda3";
  try {
    const result = await productService.createProduct(
      vendorId,
      userId,
      req.companyMasterData,
      req.websiteMasterData,
      req.body
    );
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error creating product', { vendorId, error });
    return common.sendError(res, 500, 'Failed to create product');
  }
};

const updateProduct = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user._id;
  const { productId } = req.params;
  try {
    const result = await productService.updateProduct(
      vendorId,
      userId,
      productId,
      req.companyMasterData,
      req.websiteMasterData,
      req.body
    );
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error updating product', { vendorId, productId, error });
    return common.sendError(res, 500, 'Failed to update product');
  }
};

const deleteProduct = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user._id;
  const { productId } = req.params;
  try {
    const result = await productService.deleteProduct(vendorId, userId, productId);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error deleting product', { vendorId, productId, error });
    return common.sendError(res, 500, 'Failed to delete product');
  }
};

module.exports = {
  getAllProductsAdmin,
  getAllProductsClient,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};