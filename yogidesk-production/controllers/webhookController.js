const Template = require('../models/Template');

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
};

exports.handleWebhook = async (req, res) => {
  try {
    const { object, entry } = req.body;

    if (object !== 'whatsapp_business_account' || !Array.isArray(entry)) {
      return res.sendStatus(200);
    }

    for (const item of entry) {
      if (!Array.isArray(item.changes)) continue;

      for (const change of item.changes) {
        if (change.field === 'message_template') {
          const messageTemplate = change?.value?.message_template;
          if (!messageTemplate || !messageTemplate.id) continue;

          const status = (messageTemplate.status || '').toUpperCase();
          if (status === 'APPROVED' || status === 'REJECTED') {
            await Template.findOneAndUpdate(
              { metaTemplateId: messageTemplate.id },
              { $set: { status } },
              { new: true }
            );
          }
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.sendStatus(500);
  }
};