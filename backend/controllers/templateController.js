require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const Template = require('../models/Template');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const getUserMetaCredentials = async (userId) => {
  if (!supabase || !userId) return {};
  const { data, error } = await supabase
    .from('users')
    .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
    .eq('id', userId)
    .single();
  if (error || !data) return {};
  return {
    phoneNumberId: data.whatsapp_phone_number_id,
    businessAccountId: data.whatsapp_business_account_id,
    accessToken: data.whatsapp_access_token
  };
};

exports.createTemplate = async (req, res) => {
  try {
    const {
      userId,
      name,
      bodyText,
      headerType = 'NONE',
      category = 'MARKETING',
      headerText = '',
      footerText = '',
      buttons = []
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Template name is required.' });
    }

    if (!bodyText || !bodyText.trim()) {
      return res.status(400).json({ message: 'Template body text is required.' });
    }

    const graphComponents = [
      { type: 'BODY', text: bodyText }
    ];

    if (headerType === 'TEXT' && headerText) {
      graphComponents.unshift({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText
      });
    }

    if (footerText) {
      graphComponents.push({
        type: 'FOOTER',
        text: footerText
      });
    }

    let storedButtons = [];

    if (Array.isArray(buttons) && buttons.length > 0) {
      const sanitizedButtons = buttons.slice(0, 2).map((btn) => {
        if (btn.type === 'URL' && btn.text && btn.url) {
          storedButtons.push({
            type: 'URL',
            text: btn.text,
            url: btn.url
          });
          return {
            type: 'URL',
            text: btn.text,
            url: btn.url
          };
        }

        if (btn.type === 'PHONE' && btn.text && btn.phone) {
          storedButtons.push({
            type: 'PHONE_NUMBER',
            text: btn.text,
            phoneNumber: btn.phone
          });
          return {
            type: 'PHONE_NUMBER',
            text: btn.text,
            phone_number: btn.phone
          };
        }

        return null;
      }).filter(Boolean);

      if (sanitizedButtons.length) {
        graphComponents.push({
          type: 'BUTTONS',
          buttons: sanitizedButtons
        });
      }
    }

    const credentials = await getUserMetaCredentials(userId);
    const businessAccountId = credentials.businessAccountId || process.env.META_PHONE_ID;
    const accessToken = credentials.accessToken || process.env.META_ACCESS_TOKEN;

    if (!businessAccountId || !accessToken) {
      return res.status(500).json({ message: 'WhatsApp Meta credentials unavailable for this user.' });
    }

    const graphUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
    const response = await axios.post(graphUrl, {
      name: name.trim(),
      language: 'en_US',
      category,
      components: graphComponents
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const metaTemplateId = response.data?.id || response.data?.message_template_id || null;
    const newTemplate = await Template.create({
      name: name.trim(),
      bodyText,
      headerType,
      headerText,
      footerText,
      category,
      buttons: storedButtons,
      status: 'PENDING_REVIEW',
      metaTemplateId,
      businessId: userId
    });

    res.status(201).json({ message: 'Template submitted successfully.', data: newTemplate, status: newTemplate.status });
  } catch (err) {
    console.error('Template submission error:', err.response?.data || err.message || err);
    return res.status(500).json({ message: err.response?.data?.error?.message || err.message || 'Template submission failed.' });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ businessId: req.user.id });
    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
};