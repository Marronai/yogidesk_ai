// Model ko zaroor import karein
const Template = require('../models/Template');

// ✅ exports.functionName ka use karein
exports.createTemplate = async (req, res) => {
  try {
    const { name, bodyText, headerType, category, headerText, footerText } = req.body;
    
    const newTemplate = await Template.create({
      name,
      bodyText,
      headerType,
      headerText,
      footerText,
      category,
      businessId: req.user.id // protect middleware se milega
    });

    res.status(201).json({ msg: "Template created as DRAFT", data: newTemplate });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find({ businessId: req.user.id });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
};