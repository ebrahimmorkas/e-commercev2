require('dotenv').config();
const mongoose = require('mongoose');

const OrderStepMaster = require('../models/OrderStepMaster');
const { RESERVED_STEP_CODES } = require('../constants/orderStepConstants');

async function seedOrderStepMaster() {
    try {
        await mongoose.connect(`mongodb://127.0.0.1:27017/ecommerce-v2`);

        // No automatic-trigger logic exists yet (deferred to a future
        // version) - every step transition in v1 is a manual admin/
        // delivery-agent action regardless of this flag's value, so all
        // steps are seeded as false for now.
        const template = await OrderStepMaster.findOneAndUpdate(
            { name: 'Standard Order Workflow' },
            {
                name: 'Standard Order Workflow',
                steps: [
                    { code: RESERVED_STEP_CODES.ACCEPTED, name: 'Accept', sequence: 1, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.REJECTED, name: 'Reject', sequence: 2, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.READY_FOR_DELIVERY, name: 'Ready for delivery', sequence: 3, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.DISPATCHED, name: 'Dispatched', sequence: 4, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.DELIVERED, name: 'Delivered', sequence: 5, requiresManualUpdation: false },
                    { code: RESERVED_STEP_CODES.COMPLETED, name: 'Completed', sequence: 6, requiresManualUpdation: false }
                ],
                status: 'A'
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        console.log('OrderStepMaster seeded successfully.');
        console.log(template);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedOrderStepMaster();
