const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },
  // Personal Information
  adminName: {
    type: String,
    required: [true, 'Admin name is required'],
    trim: true
  },
  adminWhatsappNumber: {
    type: String,
    trim: true
  },
  adminPhoneNumber: {
    type: String,
    trim: true
  },
  adminAddress: {
    type: String,
    trim: true
  },
  adminCity: {
    type: String,
    trim: true
  },
  adminState: {
    type: String,
    trim: true
  },
  adminPincode: {
    type: String,
    trim: true
  },
  adminEmail: {
    type: String,
    required: [true, 'Admin email is required'],
    trim: true,
    lowercase: true
  },
  companyName: {
    type: String,
    trim: true,
    default: ''
  },
  companyLogo: {
  type: String,
  default: ''
  },
  instagramId: {
    type: String,
    trim: true
  },
  facebookId: {
    type: String,
    trim: true
  },
  paymentScanner: {
    type: String,
  },
  
  // Policies (stored as HTML from React Quill)
  privacyPolicy: {
    type: String,
    default: ''
  },
  cancelPolicy: {
    type: String,
    default: ''
  },
  termsAndConditions: {
    type: String,
    default: ''
  },
  aboutUs: {
    type: String,
    default: ''
  },
  hallStartTimings: {
    type: String,
    required: true,
  },
  hallEndTimings: {
    type: String,
    required: true,
  },
  createdBy: {
    userID: mongoose.Types.ObjectId,
    vendorID: mongoose.Types.ObjectId,
  },
  updatedBy: {
    userID: mongoose.Types.ObjectId,
    vendorID: mongoose.Types.ObjectId,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean, 
    default: false,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanySettings', companySettingsSchema);