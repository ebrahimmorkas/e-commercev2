const mongoose = require("mongoose");

const moduleMasterSchema = new mongoose.Schema(
    {
        moduleName: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        shortModuleName: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        searchKeywords: {
            type: [String],
            default: []
        },

        description: {
            type: String,
            trim: true,
            default: null
        },

        precedence: {
            type: Number,
            required: true,
            default: 0
        },
        isSystemModule: {
            type: Boolean,
            default: false
        },
        // Stable identifier used to look up this module from route middleware
        // (see checkModuleAssigned) - unlike moduleName/shortModuleName, this
        // is never meant to be edited once other code starts referencing it.
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            unique: true,
            match: [/^[A-Z0-9_]+$/, 'Module code must contain only uppercase letters, numbers, and underscores.']
        },
        status: {
            type: String,
            enum: ['I', 'A', 'D'],
            default: 'A',
            required: true
        },
        createdBy: {
            type: mongoose.Types.ObjectId,
            index: true
        },
        updatedBy: {
            type: mongoose.Types.ObjectId,
            index: true
        },
        deletedBy: {
            type: mongoose.Types.ObjectId,
            index: true
        },
        inActiveMarkedBy: {
            type: mongoose.Types.ObjectId,
            default: null,
            index: true
        },
        activeMarkedBy: {
            type: mongoose.Types.ObjectId,
            index: true
        },
        activeMarkedDate: {
            type: Date,
            default: null
        },
        inactiveMarkedDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ModuleMaster", moduleMasterSchema);