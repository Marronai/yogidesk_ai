require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
let Template = null;
try {
  Template = require('../models/Template');
} catch (err) {
  Template = null;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const formatTemplateName = (value) => (
  String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
);

const normalizeTemplateLanguage = (language) => {
  const normalized = String(language || 'en_US').toLowerCase();
  if (['hi', 'hindi'].includes(normalized)) return 'hi';
  if (['hinglish', 'hi_latn', 'hi-latn'].includes(normalized)) return 'en_US';
  if (['en', 'en_us', 'english'].includes(normalized)) return 'en_US';
  if (normalized === 'en_in') return 'en_IN';
  return language || 'en_US';
};

const sanitizeMetaPhoneNumber = (value) => {
  const digits = String(value || '').trim().replace(/^\+/, '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
};

const buildGraphComponents = ({ bodyText, headerType, headerText, footerText, buttons, components }) => {
  if (Array.isArray(components) && components.length > 0) {
    return components
      .map((component) => {
        if (!component?.type) return null;
        if (component.type === 'HEADER') {
          const text = String(component.text || '').trim();
          if (component.format === 'TEXT') {
            return text ? { type: 'HEADER', format: 'TEXT', text } : null;
          }
          if (['DOCUMENT', 'LOCATION'].includes(component.format)) {
            return { type: 'HEADER', format: component.format };
          }
          return null;
        }
        if (component.type === 'BODY') {
          const text = String(component.text || bodyText || '').trim();
          return text ? { type: 'BODY', text } : null;
        }
        if (component.type === 'FOOTER') {
          const text = String(component.text || '').trim();
          return text ? { type: 'FOOTER', text } : null;
        }
        if (component.type === 'BUTTONS' && Array.isArray(component.buttons)) {
          const buttonList = component.buttons
            .map((btn) => {
              const text = String(btn.text || '').trim();
              if (btn.type === 'URL') {
                const url = String(btn.url || '').trim();
                return text && url ? { type: 'URL', text, url } : null;
              }
              const phoneNumber = sanitizeMetaPhoneNumber(btn.phone_number || btn.phone);
              return text && phoneNumber ? { type: 'PHONE_NUMBER', text, phone_number: phoneNumber } : null;
            })
            .filter(Boolean)
            .slice(0, 2);
          return buttonList.length ? { type: 'BUTTONS', buttons: buttonList } : null;
        }
        return null;
      })
      .filter(Boolean);
  }

  const graphComponents = [];
  const cleanBodyText = String(bodyText || '').trim();
  const cleanHeaderText = String(headerText || '').trim();
  const cleanFooterText = String(footerText || '').trim();

  if (headerType === 'TEXT' && cleanHeaderText) {
    graphComponents.push({ type: 'HEADER', format: 'TEXT', text: cleanHeaderText });
  }

  if (headerType === 'DOCUMENT') {
    graphComponents.push({ type: 'HEADER', format: 'DOCUMENT' });
  }

  if (headerType === 'LOCATION') {
    graphComponents.push({ type: 'HEADER', format: 'LOCATION' });
  }

  if (cleanBodyText) {
    graphComponents.push({ type: 'BODY', text: cleanBodyText });
  }

  if (cleanFooterText) {
    graphComponents.push({ type: 'FOOTER', text: cleanFooterText });
  }

  const sanitizedButtons = Array.isArray(buttons) ? buttons.slice(0, 2).map((btn) => {
    const text = String(btn.text || '').trim();
    if (btn.type === 'URL') {
      const url = String(btn.url || '').trim();
      return text && url ? { type: 'URL', text, url } : null;
    }
    const phoneNumber = sanitizeMetaPhoneNumber(btn.phone_number || btn.phone);
    return text && phoneNumber ? { type: 'PHONE_NUMBER', text, phone_number: phoneNumber } : null;
  }).filter(Boolean) : [];

  if (sanitizedButtons.length) {
    graphComponents.push({ type: 'BUTTONS', buttons: sanitizedButtons });
  }

  return graphComponents;
};

const getUserMetaCredentials = async (userId) => {
  if (!supabase?.from || !userId) return {};
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('Meta credential lookup failed:', error.message);
    return {};
  }
  return {
    phoneNumberId: data.whatsapp_phone_number_id || null,
    businessAccountId: data.whatsapp_business_account_id || null,
    accessToken: data.whatsapp_access_token || null
  };
};

const normalizeMetaStatus = (status) => {
  const normalized = String(status || 'PENDING').toUpperCase();
  if (normalized === 'PENDING_REVIEW' || normalized === 'IN_REVIEW') return 'PENDING';
  if (['APPROVED', 'REJECTED', 'PENDING'].includes(normalized)) return normalized;
  return normalized || 'PENDING';
};

const getComponent = (components, type) => (
  Array.isArray(components)
    ? components.find((component) => String(component?.type || '').toUpperCase() === type)
    : null
);

const mapMetaTemplateToRow = (metaTemplate, userId) => {
  const components = Array.isArray(metaTemplate?.components) ? metaTemplate.components : [];
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY');
  const footer = getComponent(components, 'FOOTER');
  const buttons = getComponent(components, 'BUTTONS');

  return {
    user_id: userId,
    template_name: metaTemplate.name || metaTemplate.template_name,
    category: metaTemplate.category || 'MARKETING',
    language: metaTemplate.language || 'en_US',
    body_content: body?.text || '',
    status: normalizeMetaStatus(metaTemplate.status),
    header_type: header?.format || 'NONE',
    header_text: header?.format === 'TEXT' ? header?.text || null : null,
    footer_text: footer?.text || null,
    buttons: Array.isArray(buttons?.buttons) ? buttons.buttons : [],
    created_at: new Date().toISOString(),
    meta_template_id: metaTemplate.id || metaTemplate.message_template_id || null
  };
};

const syncTemplatesFromMeta = async (userId) => {
  if (!supabase?.from || !userId) return;

  const credentials = await getUserMetaCredentials(userId);
  const wabaId = credentials.businessAccountId || process.env.META_WABA_ID || process.env.META_PHONE_ID;
  const accessToken = credentials.accessToken || process.env.META_ACCESS_TOKEN;

  if (!wabaId || !accessToken) {
    console.warn('Template Meta sync skipped: missing WhatsApp Business Account credentials.');
    return;
  }

  const graphUrl = `https://graph.facebook.com/v20.0/${wabaId}/message_templates`;
  const response = await axios.get(graphUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const metaTemplates = Array.isArray(response.data?.data) ? response.data.data : [];
  if (!metaTemplates.length) return;

  const { data: localTemplates, error: localError } = await supabase
    .from('whatsapp_templates')
    .select('id,template_name')
    .eq('user_id', userId);

  if (localError) throw localError;

  const localByName = new Map(
    (Array.isArray(localTemplates) ? localTemplates : [])
      .map((template) => [String(template.template_name || '').toLowerCase(), template])
      .filter(([name]) => name)
  );

  for (const metaTemplate of metaTemplates) {
    const templateName = metaTemplate.name || metaTemplate.template_name;
    if (!templateName) continue;

    const row = mapMetaTemplateToRow(metaTemplate, userId);
    const existingTemplate = localByName.get(String(templateName).toLowerCase());

    if (existingTemplate?.id) {
      const { error: updateError } = await supabase
        .from('whatsapp_templates')
        .update({
          status: row.status,
          meta_template_id: row.meta_template_id
        })
        .eq('user_id', userId)
        .eq('template_name', templateName);

      if (updateError) throw updateError;
      continue;
    }

    const { error: upsertError } = await supabase
      .from('whatsapp_templates')
      .upsert(row);

    if (upsertError) throw upsertError;
  }
};

exports.createTemplate = async (req, res) => {
  try {
    if (!supabase?.from) {
      throw new Error('Database connection unavailable.');
    }

    const {
      userId,
      name,
      bodyText,
      headerType = 'NONE',
      category = 'MARKETING',
      headerText = '',
      footerText = '',
      buttons = [],
      components = [],
      language = 'en_US',
      messaging_product: messagingProduct = 'whatsapp',
      whatsapp_business_account_id: requestBusinessAccountId,
      whatsapp_access_token: requestAccessToken
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const formattedName = formatTemplateName(name);

    if (!formattedName) {
      return res.status(400).json({ success: false, message: 'Template name is required.' });
    }

    if (!bodyText || !bodyText.trim()) {
      return res.status(400).json({ success: false, message: 'Template body text is required.' });
    }

    const graphComponents = buildGraphComponents({ bodyText, headerType, headerText, footerText, buttons, components });
    const storedButtons = graphComponents.find((component) => component.type === 'BUTTONS')?.buttons || [];
    const metaLanguage = normalizeTemplateLanguage(language);

    const credentials = await getUserMetaCredentials(userId);
    const businessAccountId = requestBusinessAccountId || credentials.businessAccountId || process.env.META_PHONE_ID;
    const accessToken = requestAccessToken || credentials.accessToken || process.env.META_ACCESS_TOKEN;

    if (!businessAccountId || !accessToken) {
      return res.status(400).json({ success: false, message: 'WhatsApp Meta credentials unavailable for this user.' });
    }

    const graphUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
    const response = await axios.post(graphUrl, {
      messaging_product: messagingProduct || 'whatsapp',
      name: formattedName,
      language: metaLanguage,
      category,
      components: graphComponents
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const metaTemplateId = response.data?.id || response.data?.message_template_id || null;
    const newTemplateRow = {
      user_id: userId,
      template_name: formattedName,
      category,
      language: metaLanguage,
      body_content: bodyText,
      status: 'PENDING_REVIEW',
      header_type: headerType,
      header_text: headerType === 'TEXT' ? String(headerText || '').trim() : null,
      footer_text: footerText ? String(footerText).trim() : null,
      buttons: storedButtons,
      created_at: new Date().toISOString(),
      meta_template_id: metaTemplateId
    };

    const { data: insertedTemplate, error: insertError } = await supabase
      .from('whatsapp_templates')
      .insert([newTemplateRow])
      .select()
      .maybeSingle();

    if (insertError) {
      return res.status(400).json({ success: false, message: insertError.message || 'Template created in Meta, but failed to save.' });
    }

    const newTemplate = Template?.create ? await Template.create({
      name: formattedName,
      bodyText,
      headerType,
      headerText,
      footerText,
      category,
      buttons: storedButtons,
      status: 'PENDING_REVIEW',
      metaTemplateId,
      businessId: userId
    }) : null;

    res.status(201).json({ message: 'Template submitted successfully.', data: insertedTemplate || newTemplate, status: 'PENDING_REVIEW' });
  } catch (err) {
    console.error('Template submission error:', err.response?.data || err.message || err);
    return res.status(400).json({ success: false, message: err.response?.data?.error?.message || err.message || 'Template submission failed.' });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const userId = req.user?.id || req.query?.userId;
    if (!userId) {
      throw new Error('Authenticated user is required.');
    }

    if (!supabase?.from) {
      if (!Template?.find) throw new Error('Database connection unavailable.');
      const templates = await Template.find({ businessId: userId });
      return res.json(templates);
    }

    await syncTemplatesFromMeta(userId);

    const { data: templates, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(Array.isArray(templates) ? templates : []);
  } catch (err) {
    console.error('Get templates error:', err.message);
    return res.status(400).json({ success: false, message: err.message || 'Server Error' });
  }
};
