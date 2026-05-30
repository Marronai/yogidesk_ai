
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
  MARKETING: 1.30
};

export const BASELINE_MEDICAL_TEMPLATES = [
  {
    id: 'baseline_appointment_reminder',
    template_name: 'Appointment Reminder',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, this is a reminder for your appointment with Dr. {{2}} on {{3}} at {{4}}. Please reply CONFIRM to secure your slot.',
  },
  {
    id: 'baseline_followup_checkup',
    template_name: 'Follow-up Check-up',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, Dr. {{2}} recommends a follow-up check-up after your recent visit. Book your convenient slot here: {{3}}',
  },
  {
    id: 'baseline_lab_report_ready',
    template_name: 'Lab Report Ready',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, your lab report from {{2}} is ready. Please visit the clinic desk or use this secure link: {{3}}',
  },
  {
    id: 'baseline_medicine_reminder',
    template_name: 'Medicine Reminder',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, this is your medicine reminder from {{2}}. Please take your prescribed dose at {{3}} and contact us if symptoms change.',
  },
  {
    id: 'baseline_health_camp',
    template_name: 'Health Camp Invite',
    category: 'MARKETING',
    language: 'English',
    body_text: 'Dear {{1}}, {{2}} is hosting a preventive health check-up camp on {{3}}. Reply BOOK to reserve your consultation slot.',
  },
];

export const DENTAL_PREMADE_TEMPLATES = [
  {
    id: 'dent_static_1',
    specialization: 'Dentist',
    template_name: 'Dental Routine Check-up Reminder',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, this is a reminder for your dental routine check-up at {{2}} on {{3}} at {{4}}. Reply CONFIRM to secure your chair time.',
  },
  {
    id: 'dent_static_2',
    specialization: 'Dentist',
    template_name: 'Root Canal Care Follow-up',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, Dr. {{2}} recommends a root canal care follow-up after your recent procedure. Please book your review here: {{3}}',
  },
  {
    id: 'dent_static_3',
    specialization: 'Dentist',
    template_name: 'Braces Adjustment Appointment Notice',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, your braces adjustment appointment is scheduled at {{2}} on {{3}}. Please arrive 10 minutes early for check-in.',
  },
  {
    id: 'dent_static_4',
    specialization: 'Dentist',
    template_name: 'Dental Cleaning Recall',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, it is time for your dental cleaning recall at {{2}}. Reserve a convenient slot here: {{3}}',
  },
  {
    id: 'dent_static_5',
    specialization: 'Dentist',
    template_name: 'Smile Makeover Camp Invite',
    category: 'MARKETING',
    language: 'English',
    body_text: 'Dear {{1}}, {{2}} is hosting a smile makeover consultation camp this week. Reply BOOK to reserve your dental consultation slot.',
  },
];

export const GENERAL_PHYSICIAN_PREMADE_TEMPLATES = [
  {
    id: 'gp_static_1',
    specialization: 'General Physician',
    template_name: 'Chronic Care Follow-up',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, this is a follow-up reminder from Dr. {{2}} for your chronic care review. Book your next consultation here: {{3}}',
  },
  {
    id: 'gp_static_2',
    specialization: 'General Physician',
    template_name: 'Consultation Review Reminder',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, your consultation review is due on {{2}} at {{3}}. Please bring your previous prescription and reports.',
  },
  {
    id: 'gp_static_3',
    specialization: 'General Physician',
    template_name: 'Medication Adherence Check',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, Dr. {{2}} is checking in on your medication schedule. Reply DONE if doses are on track or HELP for support.',
  },
  {
    id: 'gp_static_4',
    specialization: 'General Physician',
    template_name: 'Lab Report Consultation',
    category: 'UTILITY',
    language: 'English',
    body_text: 'Hello {{1}}, your reports are ready for review. Please schedule a consultation with Dr. {{2}} using this link: {{3}}',
  },
  {
    id: 'gp_static_5',
    specialization: 'General Physician',
    template_name: 'Preventive Health Check-up Invite',
    category: 'MARKETING',
    language: 'English',
    body_text: 'Dear {{1}}, {{2}} is running a preventive health check-up drive. Reply BOOK to reserve your consultation.',
  },
];

export const getBaselineTemplatesForSpecialty = (specialty) => (
  String(specialty || '').toLowerCase().includes('dent')
    ? DENTAL_PREMADE_TEMPLATES
    : GENERAL_PHYSICIAN_PREMADE_TEMPLATES
);

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
