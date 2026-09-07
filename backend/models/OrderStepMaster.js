const mongoose = require("mongoose");

const orderStepSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        sequence: {
            type: Number,
            required: true,
            min: 1
        },

        requiresManualUpdation: {
            type: Boolean,
            required: true,
            default: false
        }
    },
    {
        _id: true
    }
);

const orderStepMasterSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },

        steps: {
            type: [orderStepSchema],
            required: true,
            validate: {
                validator: function (steps) {
                    if (!Array.isArray(steps) || steps.length === 0) {
                        return false;
                    }

                    const sequences = steps.map((step) => step.sequence);
                    const codes = steps.map((step) => step.code);

                    // Sequence must be unique.
                    if (new Set(sequences).size !== sequences.length) {
                        return false;
                    }

                    // Code must be unique inside this workflow.
                    if (new Set(codes).size !== codes.length) {
                        return false;
                    }

                    return true;
                },
                message: "Order steps must contain unique sequence numbers and unique codes."
            }
        },

        status: {
            type: String,
            enum: ["I", "A", "D"],
            default: "A",
            required: true,
            index: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },

        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },

        inActiveMarkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },

        activeMarkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },

        activeMarkedDate: {
            type: Date,
            default: null
        },

        inactiveMarkedDate: {
            type: Date,
            default: null
        },

        remarks: {
            type: String,
            default: null,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

orderStepMasterSchema.index({
    name: 1,
    status: 1
});

module.exports = mongoose.model("OrderStepMaster", orderStepMasterSchema);