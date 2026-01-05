const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    unique: true,
    lowercase: true,
    trim: true,
    // Meta Rule: Only lowercase alphanumeric and underscores
    match: [/^[a-z0-9_]+$/, 'Template name can only contain lowercase letters, numbers and underscores']
  },
  category: {
    type: String,
    enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
    default: 'MARKETING'
  },
  language: {
    type: String,
    default: 'en_US'
  },
  headerType: {
    type: String,
    enum: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
    default: 'NONE'
  },
  headerText: {
    type: String,
    maxLength: 60 // Meta limit for text headers
  },
  bodyText: {
    type: String,
    required: [true, 'Body text is required'],
    maxLength: 1024 // Meta limit
  },
  footerText: {
    type: String,
    maxLength: 60
  },
  buttons: [
    {
      type: { type: String, enum: ['QUICK_REPLY', 'PHONE_NUMBER', 'URL'] },
      text: String,
      phoneNumber: String,
      url: String
    }
  ],
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'DRAFT'],
    default: 'DRAFT'
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metaTemplateId: String, // Meta se approval ke baad milne wali ID
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Template', TemplateSchema);