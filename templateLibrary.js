export const MEDICAL_SPECIALTIES = [
  'Dentist',
  'Cardiologist',
  'Diabetologist',
  'General Physician',
  'Pediatrician',
  'Gynecologist',
  'Dermatologist',
  'Other'
];

export const PRICING_RULES = {
  UTILITY: 0.25,
  AUTHENTICATION: 0.25,
  MARKETING: 1.30
};

export const TEMPLATE_DATA = {
  Dentist: [
    {
      id: 'dent_rem_1',
      title: 'Appointment Reminder (RCT / Clean-up)',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], this is a friendly reminder for your scheduled dental session tomorrow at [Time] at Yogi Desk Clinic.',
      hinglish: 'Namaste [Patient_Name], aapke dental treatment ka next session kal [Time] baje hai. Slot confirm karne ke liye reply karein.',
      hindi: 'नमस्ते [Patient_Name], आपके दांतों के इलाज का अगला सेशन कल [Time] बजे निर्धारित है।'
    }
  ],
  Diabetologist: [
    {
      id: 'diab_rem_1',
      title: 'Fasting Sugar Reminder',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], reminder to test your Fasting Blood Sugar tomorrow morning before consulting the doctor.',
      hinglish: 'Namaste [Patient_Name], kal subah doctor consultation se pehle apni Fasting Sugar check karna na bhoolen.',
      hindi: 'नमस्ते [Patient_Name], कल सुबह डॉक्टर से परामर्श करने से पहले अपनी खाली पेट शुगर की जांच जरूर कर लें।'
    }
  ]
};

export const getTemplatesBySpecialty = (specialty) => {
  return TEMPLATE_DATA[specialty] || TEMPLATE_DATA['Diabetologist'];
};

export const calculateCampaignCost = (patientCount, templateType) => {
  const unitCost = PRICING_RULES[templateType] || PRICING_RULES.UTILITY;
  return Number((patientCount * unitCost).toFixed(2));
};