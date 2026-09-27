const mongoose = require('mongoose');
const OrderStepMaster = require('../models/OrderStepMaster');
const logger = require('../utils/logger');
const {
    RESERVED_STEP_CODES,
    SIDE_STEP_NAMES,
    CLOSED_STEP_CODES,
    REFUNDABLE_STEP_CODES,
    RESTART_ACTION
} = require('../constants/orderStepConstants');

/*
|--------------------------------------------------------------------------
| ORDER STEP RULES
|--------------------------------------------------------------------------
| Every rule about where an order may go next lives here, so the admin,
| customer and delivery-agent paths in orderService.js can't drift apart.
| See orderStepConstants.js for the flow vs side step model.
|
| - The admin may only move an order to the NEXT step of its workflow.
| - The workflow's LAST step is final: nothing at all is allowed after it.
| - Reject (admin) / Cancel (customer) close an order from any other step;
|   Refund is allowed on a closed order whose payment is PAID; Restart
|   takes a Rejected/Cancelled/Refunded order back to the first step.
| - Payment is marked PAID when the order reaches the vendor's payment step
|   (CompanySettings.markPaymentCompletedAtStep, default the last step), or -
|   for a Payment at Delivery order - when the vendor's delivery-agent
|   transition happens (fallback: the last step).
*/

// The kinds of move an admin can make on an order.
const ACTION_TYPES = {
    NEXT: 'NEXT',
    PAYMENT_AT_DELIVERY: 'PAYMENT_AT_DELIVERY',
    REJECT: 'REJECT',
    REFUND: 'REFUND',
    RESTART: 'RESTART'
};

// Delivery agents (and Payment at Delivery) need the feature on in BOTH
// WebsiteMaster and the vendor's CompanyMaster - the same two-level gate as
// common.checkFeatureOnOrOff, as a plain yes/no for the rules below.
const DELIVERY_AGENT_FEATURE_FLAG = 'isOrderStatusUpdationAllowedByDeliveryAgents';

const isDeliveryAgentFeatureOn = (websiteMasterData, companyMasterData) => {
    try {
        return websiteMasterData?.[DELIVERY_AGENT_FEATURE_FLAG] === true && companyMasterData?.[DELIVERY_AGENT_FEATURE_FLAG] === true;
    } catch (err) {
        throw err;
    }
};

// The template assigned to the vendor right now (new orders are placed on it).
const loadActiveStepMaster = async (stepMasterId) => {
    try {
        if (!stepMasterId) return null;
        return await OrderStepMaster.findOne({ _id: stepMasterId, status: 'A' });
    } catch (err) {
        throw err;
    }
};

// The template an existing order was placed on - it keeps following that one
// even if the vendor has since been given a different template.
const loadOrderStepMaster = async (order) => {
    try {
        return await OrderStepMaster.findById(order.orderStepMasterId);
    } catch (err) {
        throw err;
    }
};

const getSortedSteps = (stepMaster) => {
    try {
        return [...(stepMaster?.steps || [])].sort((a, b) => a.sequence - b.sequence);
    } catch (err) {
        throw err;
    }
};

const getFirstStep = (stepMaster) => {
    try {
        return getSortedSteps(stepMaster)[0] || null;
    } catch (err) {
        throw err;
    }
};

const getLastStep = (stepMaster) => {
    try {
        const steps = getSortedSteps(stepMaster);
        return steps[steps.length - 1] || null;
    } catch (err) {
        throw err;
    }
};

// Sequences don't have to be consecutive, so "next" is the first step with a
// higher sequence. A side step (Payment at Delivery) carries the sequence of
// the step it stands in for, so this works for it too.
const getNextStep = (stepMaster, currentSequence) => {
    try {
        return getSortedSteps(stepMaster).find((step) => step.sequence > currentSequence) || null;
    } catch (err) {
        throw err;
    }
};

const findStepByCode = (stepMaster, code) => {
    try {
        if (!code) return null;
        const normalized = String(code).trim().toUpperCase();
        return (stepMaster?.steps || []).find((step) => step.code === normalized) || null;
    } catch (err) {
        throw err;
    }
};

// The step at which a (not Payment at Delivery) order's payment is marked
// PAID. A saved code that is no longer in this workflow falls back to the last step.
const resolvePaymentStep = (stepMaster, companySettingsData) => {
    try {
        const code = companySettingsData?.markPaymentCompletedAtStep;
        if (code) {
            const step = findStepByCode(stepMaster, code);
            if (step) return step;
            logger.logWarning('markPaymentCompletedAtStep is not part of the order workflow - using the last step instead', {
                vendorId: companySettingsData?.vendorId, stepMasterId: stepMaster?._id, code
            });
        }
        return getLastStep(stepMaster);
    } catch (err) {
        throw err;
    }
};

// The vendor's one delivery-agent transition, or null when it isn't set up
// (or no longer fits this workflow: both steps must exist and "to" must be
// the step right after "from").
const resolveAgentTransition = (stepMaster, companySettingsData) => {
    try {
        const fromCode = companySettingsData?.deliveryAgentFromStep;
        const toCode = companySettingsData?.deliveryAgentToStep;
        if (!fromCode || !toCode) return null;

        const fromStep = findStepByCode(stepMaster, fromCode);
        const toStep = findStepByCode(stepMaster, toCode);
        const nextStep = fromStep ? getNextStep(stepMaster, fromStep.sequence) : null;
        if (!fromStep || !toStep || !nextStep || nextStep.code !== toStep.code) {
            logger.logWarning('Delivery agent transition does not fit the order workflow - ignoring it', {
                vendorId: companySettingsData?.vendorId, stepMasterId: stepMaster?._id, fromCode, toCode
            });
            return null;
        }
        return { fromStep, toStep };
    } catch (err) {
        throw err;
    }
};

const isOrderClosed = (order) => {
    try {
        return CLOSED_STEP_CODES.includes(order?.currentStepCode);
    } catch (err) {
        throw err;
    }
};

// Still moving through its workflow: not on the last step, not rejected/cancelled/refunded.
const isOrderActive = (order) => {
    try {
        return !!order && order.isFinalized !== true && !isOrderClosed(order);
    } catch (err) {
        throw err;
    }
};

// Side steps have no template entry, so they get their own id. `sequence` is
// the position they occupy (kept so the history and "next step" read right).
const buildSideStep = (code, sequence) => {
    try {
        return { _id: new mongoose.Types.ObjectId(), code, name: SIDE_STEP_NAMES[code], sequence: Math.max(1, sequence || 1) };
    } catch (err) {
        throw err;
    }
};

// Closes the open statusHistory entry, opens one for `step` and makes it the
// order's current step. Mutates `order` in place.
const moveOrderToStep = (order, step, changedByUserId, isManualUpdate, remarks = null) => {
    try {
        const now = new Date();
        const openEntry = [...order.statusHistory].reverse().find((entry) => entry.completedAt === null);
        if (openEntry) {
            openEntry.completedAt = now;
        }

        order.statusHistory.push({
            stepId: step._id,
            stepCode: step.code,
            stepName: step.name,
            sequence: step.sequence,
            startedAt: now,
            remarks: remarks || null,
            changedBy: changedByUserId || null,
            isManualUpdate
        });

        order.currentStepId = step._id;
        order.currentStepCode = step.code;
        order.currentStepName = step.name;
        order.currentStepSequence = step.sequence;
    } catch (err) {
        throw err;
    }
};

// Only a payment still waiting to be collected is marked; anything already
// paid/refunded is left alone. Returns whether it changed.
const markPaymentPaid = (order) => {
    try {
        if (!order.payment || order.payment.status !== 'PENDING') return false;
        order.payment.status = 'PAID';
        order.payment.paidAt = new Date();
        order.payment.amount = order.grandTotal;
        return true;
    } catch (err) {
        throw err;
    }
};

// Everything that follows from an order landing on a workflow step: shipped/
// delivered dates, the final-step lock, and the payment rules.
const applyFlowStepEffects = (order, step, stepMaster, companySettingsData) => {
    try {
        if (step.code === RESERVED_STEP_CODES.DISPATCHED) {
            order.shippedAt = new Date();
        }
        if (step.code === RESERVED_STEP_CODES.DELIVERED) {
            order.deliveredAt = new Date();
        }

        const lastStep = getLastStep(stepMaster);
        order.isFinalized = !!lastStep && lastStep.code === step.code;

        const paymentStep = resolvePaymentStep(stepMaster, companySettingsData);
        if (!order.isPaymentAtDelivery && paymentStep && paymentStep.code === step.code) {
            markPaymentPaid(order);
        }
        // Worst case for a Payment at Delivery order: the agent transition never
        // happened (or isn't set up) - the money is in by the time it's finished.
        if (order.isFinalized && order.isPaymentAtDelivery) {
            markPaymentPaid(order);
        }
    } catch (err) {
        throw err;
    }
};

// Moves an active order onto `nextStep` (the admin's Next or the agent's
// transition). When this move is the vendor's delivery-agent transition -
// whoever makes it - it is recorded on the order (when, by whom, agent or
// admin), and a Payment at Delivery order is marked paid.
// changedByRole: 'admin' | 'deliveryAgent'.
const enterNextFlowStep = (order, nextStep, stepMaster, companySettingsData, changedByUserId, remarks = null, changedByRole = 'admin') => {
    try {
        const transition = resolveAgentTransition(stepMaster, companySettingsData);
        const isAgentTransition = !!transition &&
            order.currentStepSequence === transition.fromStep.sequence &&
            nextStep.code === transition.toStep.code;

        moveOrderToStep(order, nextStep, changedByUserId, true, remarks);
        applyFlowStepEffects(order, nextStep, stepMaster, companySettingsData);

        if (isAgentTransition) {
            order.deliveryAgentTransitionAt = new Date();
            order.deliveryAgentTransitionBy = changedByUserId || null;
            order.deliveryAgentTransitionByRole = changedByRole;
            if (order.isPaymentAtDelivery) {
                markPaymentPaid(order);
            }
        }
    } catch (err) {
        throw err;
    }
};

// Payment at Delivery is offered INSTEAD of the payment step: only for vendors
// with delivery-agent access, while the payment is still pending, when the
// next step is the payment step and something still comes after it.
const isPaymentAtDeliveryAvailable = (order, stepMaster, companySettingsData, companyMasterData, websiteMasterData) => {
    try {
        if (!isDeliveryAgentFeatureOn(websiteMasterData, companyMasterData)) return false;
        if (order.isPaymentAtDelivery || order.payment?.status !== 'PENDING') return false;

        const nextStep = getNextStep(stepMaster, order.currentStepSequence);
        const paymentStep = resolvePaymentStep(stepMaster, companySettingsData);
        const lastStep = getLastStep(stepMaster);
        return !!nextStep && !!paymentStep && nextStep.code === paymentStep.code && paymentStep.code !== lastStep?.code;
    } catch (err) {
        throw err;
    }
};

// What the admin can do with this order right now - drives both the step
// dropdown (fetchOrderStepOptions) and the check in advanceOrderStep.
// Each entry: { code, name, type, step? }.
const getAvailableActions = (order, stepMaster, companySettingsData, companyMasterData, websiteMasterData) => {
    try {
        if (!order || order.isFinalized === true) return [];

        const actions = [];
        if (isOrderClosed(order)) {
            if (REFUNDABLE_STEP_CODES.includes(order.currentStepCode) && order.payment?.status === 'PAID') {
                actions.push({ code: RESERVED_STEP_CODES.REFUNDED, name: 'Mark as Refunded', type: ACTION_TYPES.REFUND });
            }
            const firstStep = getFirstStep(stepMaster);
            if (firstStep) {
                actions.push({ code: RESTART_ACTION, name: `Restart order (back to "${firstStep.name}")`, type: ACTION_TYPES.RESTART, step: firstStep });
            }
            return actions;
        }

        const nextStep = getNextStep(stepMaster, order.currentStepSequence);
        if (nextStep) {
            actions.push({ code: nextStep.code, name: nextStep.name, type: ACTION_TYPES.NEXT, step: nextStep });
        }
        if (isPaymentAtDeliveryAvailable(order, stepMaster, companySettingsData, companyMasterData, websiteMasterData)) {
            actions.push({
                code: RESERVED_STEP_CODES.PAYMENT_AT_DELIVERY,
                name: `${SIDE_STEP_NAMES[RESERVED_STEP_CODES.PAYMENT_AT_DELIVERY]} (instead of "${nextStep.name}")`,
                type: ACTION_TYPES.PAYMENT_AT_DELIVERY,
                step: nextStep
            });
        }
        actions.push({ code: RESERVED_STEP_CODES.REJECTED, name: 'Reject', type: ACTION_TYPES.REJECT });
        return actions;
    } catch (err) {
        throw err;
    }
};

// Why a customer can't cancel this order right now, or null when they can.
const getCustomerCancellationBlock = (order, stepMaster, companySettingsData) => {
    try {
        if (companySettingsData?.isOrderCancellationAllowed !== true) {
            return 'Order cancellation is not available for this store.';
        }
        if (order.currentStepCode === RESERVED_STEP_CODES.CANCELLED || order.currentStepCode === RESERVED_STEP_CODES.REFUNDED) {
            return 'This order has already been cancelled.';
        }
        if (order.currentStepCode === RESERVED_STEP_CODES.REJECTED) {
            return 'This order has already been rejected.';
        }
        if (order.isFinalized === true) {
            return 'This order can no longer be cancelled.';
        }

        const cutoffCode = companySettingsData?.orderCancellationNotAllowedAfterStep;
        if (cutoffCode) {
            const cutoffStep = findStepByCode(stepMaster, cutoffCode);
            if (cutoffStep && order.currentStepSequence >= cutoffStep.sequence) {
                return `This order can no longer be cancelled since it has already reached "${cutoffStep.name}".`;
            }
        }
        return null;
    } catch (err) {
        throw err;
    }
};

// The agent currently on the order is taken off it (a restart, or the
// admin changing the agent): closes their open history entry. Mutates `order`.
const releaseDeliveryAgent = (order, changedByUserId) => {
    try {
        const now = new Date();
        for (const entry of order.deliveryAgentAssignments || []) {
            if (!entry.unassignedAt) {
                entry.unassignedAt = now;
                entry.unassignedBy = changedByUserId || null;
            }
        }
        order.assignedDeliveryAgentId = null;
        order.deliveryAgentAssignedAt = null;
    } catch (err) {
        throw err;
    }
};

// A concurrent step change won the race (Order's optimisticConcurrency).
const isVersionConflict = (err) => {
    try {
        return err?.name === 'VersionError';
    } catch (error) {
        throw error;
    }
};

module.exports = {
    ACTION_TYPES,
    DELIVERY_AGENT_FEATURE_FLAG,
    isDeliveryAgentFeatureOn,
    releaseDeliveryAgent,
    loadActiveStepMaster,
    loadOrderStepMaster,
    getSortedSteps,
    getFirstStep,
    getLastStep,
    getNextStep,
    findStepByCode,
    resolvePaymentStep,
    resolveAgentTransition,
    isOrderClosed,
    isOrderActive,
    buildSideStep,
    moveOrderToStep,
    markPaymentPaid,
    applyFlowStepEffects,
    enterNextFlowStep,
    isPaymentAtDeliveryAvailable,
    getAvailableActions,
    getCustomerCancellationBlock,
    isVersionConflict
};
