const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 20,
    },
    username: {
        type: String,
        required: true,
        lowercase: true
    },
    password: {
        type: String,
        required: false,
        default: null
    },
    // --- Fields added for future "Continue with Google" support ---
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
        required: true
    },
    googleId: {
        type: String,
        default: null,
        index: true,
        sparse: true // allows multiple docs with googleId: null without violating uniqueness if you later add unique: true
    },
    // ----------------------------------------------------------------
    phone_no: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 14
    },
    whatsapp_no: {
        type: String,
        required: false,
        trim: true,
        minlength: 10,
        maxlength: 14
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        enum: ["user", "vendor", "admin"],
        default: "user",
        required: true,
    },
    country: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },  
    state: {
        type: String,
        required: true,
    },  
    updated_by: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    activeMarkedBy: {
        type: mongoose.Types.ObjectId,
        index: true
    },
    inActiveMarkedBy: {
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
}, {
    timestamps: true
});

userSchema.index(
    { vendorId: 1, username: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, email: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, phone_no: 1 },
    { unique: true }
);

userSchema.index(
    { vendorId: 1, whatsapp_no: 1 },
    {
        unique: true,
        partialFilterExpression: {
            whatsapp_no: { $exists: true, $type: "string" }
        }
    }
);

module.exports = mongoose.model('User', userSchema);