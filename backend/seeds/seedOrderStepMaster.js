require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const OrderStepMaster = require('../models/OrderStepMaster');
const { RESERVED_STEP_CODES } = require('../constants/orderStepConstants');

async function seedOrderStepMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // No automatic-trigger logic exists yet (deferred to a future
        // version) - every step transition in v1 is a manual admin/
        // delivery-agent action regardless of this flag's value, so all
        // steps are seeded as false for now.
        const template = await OrderStepMaster.findOneAndUpdate(
            { name: 'Standard Order Workflow' },
            {
                name: 'Standard Order Workflow',
                steps: [
                    // Reject/Cancel/Refund are built-in side steps, never template steps
                    // (see orderStepConstants.js). The last step is final. Sequence 2 is
                    // left free on purpose: it was Reject, and orders already placed on
                    // this template store their step's sequence - gaps are fine.
                    { code: RESERVED_STEP_CODES.ACCEPTED, name: 'Accept', sequence: 1, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.READY_FOR_DELIVERY, name: 'Ready for delivery', sequence: 3, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.DISPATCHED, name: 'Dispatched', sequence: 4, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.DELIVERED, name: 'Delivered', sequence: 5, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.COMPLETED, name: 'Completed', sequence: 6, requiresManualUpdation: false }
                ],
                status: 'A'
            },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );


        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

seedOrderStepMaster();
