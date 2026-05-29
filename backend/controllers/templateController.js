require('dotenv').config();
const axios = require('axios');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');
const { supabase: serviceSupabase, supabaseAdmin } = require('../config/supabase');
let Template = null;
try {
  Template = require('../models/Template');
} catch (err) {
  Template = null;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    realtime: { transport: ws }
  })
  : null;
const getDb = () => supabaseAdmin || serviceSupabase || supabase;

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

const extractVariableSample = (variable) => {
  if (variable === null || variable === undefined) return '';
  if (typeof variable !== 'object') return String(variable).trim();
  return String(
    variable.value ||
    variable.sample ||
    variable.example ||
    variable.text ||
    variable.customValue ||
    variable.custom ||
    ''
  ).trim();
};

const normalizeBodyVariableSamples = (...sources) => {
  const samplesByIndex = new Map();

  sources.forEach((source) => {
    if (!source) return;

    if (Array.isArray(source)) {
      source.forEach((item, position) => {
        const rawIndex = typeof item === 'object' && item !== null
          ? item.index || item.position || item.key || item.variable || item.placeholder || position + 1
          : position + 1;
        const index = Number(String(rawIndex).replace(/\D/g, ''));
        const sample = extractVariableSample(item);
        if (Number.isFinite(index) && index > 0 && sample) samplesByIndex.set(index, sample);
      });
      return;
    }

    if (typeof source === 'object') {
      Object.entries(source).forEach(([rawKey, rawValue]) => {
        const index = Number(String(rawKey).replace(/\D/g, ''));
        const sample = extractVariableSample(rawValue);
        if (Number.isFinite(index) && index > 0 && sample) samplesByIndex.set(index, sample);
      });
    }
  });

  return samplesByIndex;
};

const getBodyExample = (bodyText, bodyVariableParameters = []) => {
  const indexes = Array.from(String(bodyText || '').matchAll(/\{\{(\d+)\}\}/g), (match) => Number(match[1]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!indexes.length) return null;

  const samplesByIndex = normalizeBodyVariableSamples(bodyVariableParameters);
  const defaultSamples = ['Sample Patient Name', 'Sample Clinic Location', '20-May-2026', '04:00 PM'];

  return {
    body_text: [
      indexes.map((index, position) => samplesByIndex.get(index) || defaultSamples[position] || `Sample Value ${index}`)
    ]
  };
};

const buildGraphComponents = ({ bodyText, headerType, headerText, footerText, buttons, components, bodyVariableParameters }) => {
  const bodyExample = getBodyExample(bodyText, bodyVariableParameters);

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
          const example = getBodyExample(text, bodyVariableParameters);
          return text ? { type: 'BODY', text, ...(example && { example }) } : null;
        }
        if (component.type === 'FOOTER') {
          const text = String(component.text || '').trim();
          return text ? { type: 'FOOTER', text } : null;
        }
        if (component.type === 'BUTTONS' && Array.isArray(component.buttons)) {
          const buttonList = component.buttons
            .map((btn) => {
              const text = String(btn.text || '').trim();
              if (String(btn.type || '').toUpperCase() === 'URL') {
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
    graphComponents.push({ type: 'BODY', text: cleanBodyText, ...(bodyExample && { example: bodyExample }) });
  }

  if (cleanFooterText) {
    graphComponents.push({ type: 'FOOTER', text: cleanFooterText });
  }

  const sanitizedButtons = Array.isArray(buttons) ? buttons.slice(0, 2).map((btn) => {
    const text = String(btn.text || '').trim();
    if (String(btn.type || '').toUpperCase() === 'URL') {
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
  const db = getDb();
  if (!db?.from || !userId) return {};

  const lookups = [{
    select: '*',
    map: (row) => ({
      phoneNumberId: row?.meta_phone_number_id || row?.whatsapp_phone_number_id || null,
      businessAccountId: row?.meta_waba_id || row?.whatsapp_business_account_id || null,
      accessToken: row?.system_user_token || row?.whatsapp_access_token || null
    })
  }];

  for (const lookup of lookups) {
    const result = await db
      .from('doctor_profiles')
      .select(lookup.select)
      .eq('id', userId)
      .maybeSingle();

    const message = String(result.error?.message || result.error?.details || '').toLowerCase();
    const isMissingColumn = result.error?.code === '42703' || result.error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
    if (result.error) {
      if (isMissingColumn) continue;
      console.warn('Fresh Meta credential lookup failed:', result.error.message);
      return {};
    }

    const credentials = lookup.map(result.data || {});
    if (credentials.businessAccountId && credentials.accessToken) return credentials;
  }

  console.error('Fresh Meta credentials missing or empty for template submission.', { userId });
  return {};
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
      bodyVariableParameters = [],
      customVariables = [],
      variablesData = {}
    } = req.body;

    const authenticatedUserId = req.user?.id;
    const userId = authenticatedUserId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    if (authenticatedUserId && req.body.userId && req.body.userId !== authenticatedUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const formattedName = formatTemplateName(name);

    if (!formattedName) {
      return res.status(400).json({ success: false, message: 'Template name is required.' });
    }

    if (!bodyText || !bodyText.trim()) {
      return res.status(400).json({ success: false, message: 'Template body text is required.' });
    }

    const graphComponents = buildGraphComponents({
      bodyText,
      headerType,
      headerText,
      footerText,
      buttons,
      components,
      bodyVariableParameters: [
        ...(Array.isArray(bodyVariableParameters) ? bodyVariableParameters : []),
        ...(Array.isArray(customVariables) ? customVariables : []),
        variablesData
      ]
    });
    const storedButtons = graphComponents.find((component) => component.type === 'BUTTONS')?.buttons || [];
    const metaLanguage = normalizeTemplateLanguage(language);

    const credentials = await getUserMetaCredentials(userId);
    const businessAccountId = credentials.businessAccountId;
    const accessToken = credentials.accessToken;

    if (!businessAccountId || !accessToken) {
      return res.status(400).json({ success: false, message: 'WhatsApp Meta credentials unavailable for this user.' });
    }

    const graphUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
    const response = await axios.post(graphUrl, {
      messaging_product: messagingProduct || 'whatsapp',
      name: formattedName,
      language: metaLanguage,
      category,
      parameter_format: 'positional',
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

    const { data: templates, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(Array.isArray(templates) ? templates : []);

    Promise.resolve()
      .then(() => syncTemplatesFromMeta(userId))
      .catch((syncError) => {
        console.error('Background template sync failed:', syncError.response?.data || syncError.message || syncError);
      });
  } catch (err) {
    console.error('Get templates error:', err.message);
    return res.status(400).json({ success: false, message: err.message || 'Server Error' });
  }
};

exports.syncTemplates = async (req, res) => {
  try {
    const userId = req.user?.id || req.query?.userId || req.body?.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    await syncTemplatesFromMeta(userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Template sync error:', err.response?.data || err.message || err);
    return res.status(400).json({ success: false, message: err.response?.data?.error?.message || err.message || 'Template sync failed.' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const db = getDb();
    if (!db?.from) throw new Error('Database connection unavailable.');

    const userId = req.user?.id || req.query?.userId || req.body?.userId;
    const templateId = req.params.id;
    if (!userId || !templateId) {
      return res.status(400).json({ success: false, message: 'Template ID and userId are required.' });
    }

    const { data: template, error: templateError } = await db
      .from('whatsapp_templates')
      .select('id,user_id,template_name')
      .eq('id', templateId)
      .eq('user_id', userId)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) return res.status(404).json({ success: false, message: 'Template not found.' });

    const credentials = await getUserMetaCredentials(userId);
    if (!credentials.businessAccountId || !credentials.accessToken) {
      return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
    }

    let metaResponse;
    try {
      metaResponse = await axios.delete(`https://graph.facebook.com/v20.0/${credentials.businessAccountId}/message_templates`, {
        params: { name: template.template_name },
        headers: { Authorization: `Bearer ${credentials.accessToken}` }
      });
    } catch (error) {
      return res.status(error.response?.status || 400).json({
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Meta template deletion failed.',
        provider: error.response?.data || null
      });
    }

    if (metaResponse?.data?.success !== true && metaResponse?.status !== 200) {
      return res.status(400).json({ success: false, message: 'Meta did not confirm template deletion.', provider: metaResponse?.data || null });
    }

    const { error: deleteError } = await db
      .from('whatsapp_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    return res.status(200).json({ success: true, message: 'Template deleted from Meta and Yogi Desk.' });
  } catch (err) {
    console.error('Template delete error:', err.response?.data || err.message || err);
    return res.status(400).json({ success: false, message: err.response?.data?.error?.message || err.message || 'Template deletion failed.' });
  }
};
