export const MEDICAL_TEMPLATES = {
  DENTIST: [
    {
      id: 'dent_cleaning',
      name: 'Teeth Cleaning Reminder',
      category: 'UTILITY',
      content: {
        EN: "Hi {{1}}, it's time for your 6-month dental cleaning at Yogi Clinic. Keep that smile bright! Book now.",
        HI: "नमस्ते {{1}}, योगी क्लिनिक में आपकी 6 महीने की दांतों की सफाई का समय हो गया है। अपनी मुस्कान बनाए रखें!",
        HINGLISH: "Hi {{1}}, aapki 6-month wali teeth cleaning ka time ho gaya hai Yogi Clinic pe. Apni smile bright rakhein!"
      }
    },
    {
      id: 'dent_root_canal',
      name: 'Root Canal Follow-up',
      category: 'UTILITY',
      content: {
        EN: "Hello {{1}}, how is your tooth feeling after the procedure? Please reply if you feel any sensitivity.",
        HI: "नमस्ते {{1}}, इलाज के बाद अब आपका दांत कैसा है? यदि आपको कोई संवेदनशीलता महसूस हो तो हमें बताएं।",
        HINGLISH: "Hello {{1}}, procedure ke baad ab aapka daant kaisa hai? Agar koi sensitivity ho toh batayein."
      }
    }
  ],
  CARDIOLOGIST: [
    {
      id: 'cardio_ecg',
      name: 'ECG Track Reminder',
      category: 'UTILITY',
      content: {
        EN: "Dear {{1}}, this is a reminder for your scheduled ECG test tomorrow at 10 AM. Please arrive 15 mins early.",
        HI: "प्रिय {{1}}, कल सुबह 10 बजे आपके ईसीजी टेस्ट के लिए रिमाइंडर। कृपया 15 मिनट पहले पहुंचें।",
        HINGLISH: "Dear {{1}}, kal subah 10 baje aapka ECG test scheduled hai. Please 15 mins pehle pahonchein."
      }
    }
  ],
  DIABETOLOGIST: [
    {
      id: 'diab_fasting',
      name: 'Fasting Sugar Check',
      category: 'UTILITY',
      content: {
        EN: "Good morning {{1}}, please record your fasting blood sugar today and share the reading with us.",
        HI: "सुप्रभात {{1}}, कृपया आज अपना फास्टिंग ब्लड शुगर चेक करें और हमारे साथ रीडिंग साझा करें।",
        HINGLISH: "Good morning {{1}}, please aaj apna fasting blood sugar check karein aur reading share karein."
      }
    }
  ],
  GENERAL: [
    {
      id: 'gen_health_camp',
      name: 'Free Health Camp',
      category: 'MARKETING',
      content: {
        EN: "Join us this Sunday for a Free Health Checkup Camp at Yogi Desk Center. All are welcome!",
        HI: "इस रविवार योगी डेस्क सेंटर में मुफ्त स्वास्थ्य जांच शिविर में शामिल हों। आप सभी का स्वागत है!",
        HINGLISH: "Is Sunday Yogi Desk Center pe Free Health Checkup Camp join karein. Aap sabhi invited hain!"
      }
    }
  ]
};

export const getTemplatesBySpecialty = (specialty) => {
  const key = String(specialty).toUpperCase();
  const specific = MEDICAL_TEMPLATES[key] || [];
  // Always merge with General marketing templates
  return [...specific, ...MEDICAL_TEMPLATES.GENERAL];
};

export const PRICING = {
  UTILITY: 0.20,
  MARKETING: 1.30
};

export const calculateCampaignCost = (count, category) => {
  const unitPrice = PRICING[category] || 1.30;
  return (count * unitPrice).toFixed(2);
};
