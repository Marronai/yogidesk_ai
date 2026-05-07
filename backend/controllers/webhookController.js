const Template = require('../models/Template');

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
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
        const messageTemplate = change?.value?.message_template;
        if (!messageTemplate || !messageTemplate.id) continue;

        const status = (messageTemplate.status || '').toUpperCase();
        const updatedFields = {};

        if (status) updatedFields.status = status;
        if (messageTemplate.name) updatedFields.name = messageTemplate.name;

        if (Object.keys(updatedFields).length > 0) {
          await Template.findOneAndUpdate(
            { metaTemplateId: messageTemplate.id },
            { $set: updatedFields },
            { new: true }
          );
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.sendStatus(500);
  }
};