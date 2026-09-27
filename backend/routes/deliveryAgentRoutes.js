const express = require('express');
const router = express.Router();

const deliveryAgentController = require('../controllers/deliveryAgentController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const validate = require('../middlewares/validate');
const {
    deliveryAgentIdParamSchema,
    createDeliveryAgentSchema,
    updateDeliveryAgentSchema,
    changeDeliveryAgentPasswordSchema,
    setDeliveryAgentStatusSchema
} = require('../middlewares/validations/deliveryAgentValidations');

// The vendor's own delivery agents (Delivery Agents page). Gated by the
// DELIVERY_AGENTS module, and in the service by the delivery-agent feature
// (WebsiteMaster + CompanyMaster isOrderStatusUpdationAllowedByDeliveryAgents).
// The assign dropdown on an order and the agent's own orders live in orderRoutes.js.
const adminAccess = [authenticate, authorize('admin'), checkModuleAssigned('DELIVERY_AGENTS')];

router.get('/', ...adminAccess, deliveryAgentController.getDeliveryAgents);
router.post('/', ...adminAccess, validate(createDeliveryAgentSchema, 'body'), deliveryAgentController.createDeliveryAgent);
router.get('/:id', ...adminAccess, validate(deliveryAgentIdParamSchema, 'params'), deliveryAgentController.getDeliveryAgentById);
router.patch('/:id', ...adminAccess, validate(deliveryAgentIdParamSchema, 'params'), validate(updateDeliveryAgentSchema, 'body'), deliveryAgentController.updateDeliveryAgent);
router.patch('/:id/password', ...adminAccess, validate(deliveryAgentIdParamSchema, 'params'), validate(changeDeliveryAgentPasswordSchema, 'body'), deliveryAgentController.changeDeliveryAgentPassword);
router.patch('/:id/status', ...adminAccess, validate(deliveryAgentIdParamSchema, 'params'), validate(setDeliveryAgentStatusSchema, 'body'), deliveryAgentController.setDeliveryAgentStatus);
router.delete('/:id', ...adminAccess, validate(deliveryAgentIdParamSchema, 'params'), deliveryAgentController.deleteDeliveryAgent);

module.exports = router;
