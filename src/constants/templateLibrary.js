
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
  UTILITY: 0.20,
  AUTHENTICATION: 0.20,
  MARKETING: 0.90
};

export const TEMPLATE_DATA = {
  Dentist: [
    {
      id: 'dent_1',
      title: 'Appointment Reminder (RCT / Clean-up)',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], this is a friendly reminder for your scheduled dental session tomorrow at [Time] at Yogi Desk Clinic.',
      hinglish: 'Namaste [Patient_Name], aapke dental treatment ka next session kal [Time] baje hai. Please time par clinic pahunchein.',
      hindi: 'नमस्ते [Patient_Name], आपके दांतों के इलाज का अगला सेशन कल [Time] बजे निर्धारित है। कृपया समय पर पधारें।'
    }
  ],
  Cardiologist: [
    {
      id: 'card_1',
      title: 'Routine BP & ECG Check-up',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], your routine heart rate and blood pressure monitoring is due tomorrow. Kindly book your slot.',
      hinglish: 'Hi [Patient_Name], aapka routine BP aur ECG check-up kal subah scheduled hai. Kripya apna slot confirm karein.',
      hindi: 'नमस्ते [Patient_Name], आपकी रूटीन बीपी और ईसीजी जांच कल सुबह होनी तय है। कृपया अपना समय पक्का करें।'
    }
  ],
  Diabetologist: [
    {
      id: 'diab_1',
      title: 'Fasting Sugar Level Test',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], reminder to check your Fasting Blood Sugar tomorrow morning before taking your morning dose.',
      hinglish: 'Namaste [Patient_Name], kal subah khali pet (Fasting) apni sugar test karke clinic par reports update karna na bhoolen.',
      hindi: 'नमस्ते [Patient_Name], कल सुबह खाली पेट अपनी शुगर की जांच जरूर कर लें और रिपोर्ट क्लिनिक पर अपडेट करें।'
    }
  ],
  'General Physician': [
    {
      id: 'gen_1',
      title: 'Medication Follow-up',
      category: 'UTILITY',
      english: 'Dear [Patient_Name], hope you are feeling better. This is a follow-up check from Yogi Desk Clinic regarding your regular dosage.',
      hinglish: 'Hello [Patient_Name], umeed hai aapki tabiyat ab behtar hai. Doctor ke prescription ke mutabik apni dawai samay par lete rahein.',
      hindi: 'नमस्ते [Patient_Name], आशा है कि आप बेहतर महसूस कर रहे हैं। डॉक्टर के पर्चे के अनुसार अपनी दवाएं समय पर लेते रहें।'
    }
  ],
  Pediatrician: [
    {
      id: 'ped_1',
      title: 'Free Vaccination Camp Alert',
      category: 'MARKETING',
      english: 'Dear Parent, protect your child this season. Join our Free Pediatrics Vaccination Camp this Sunday at Yogi Desk Clinic.',
      hinglish: 'Namaste Parents, is Sunday hamare clinic par bacchon ke liye Free Vaccination Camp lagaya ja raha hai. Appointment book karein.',
      hindi: 'नमस्ते पेरेंट्स, इस रविवार हमारे क्लिनिक पर बच्चों के लिए मुफ्त टीकाकरण कैंप लगाया जा रहा है। आज ही स्लॉट बुक करें।'
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
