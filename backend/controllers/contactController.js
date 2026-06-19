const Contact = require('../models/Contact'); // Tumhara Model path check kar lena
const csv = require('csv-parser');
const fs = require('fs');

// --- 1. GET CONTACTS ---
exports.getContacts = async (req, res) => {
  try {
    // Debugging: Dekho ki kaun user request kar raha hai
    // console.log("Fetching contacts for User ID:", req.user.id);

    // Agar tumhare paas authentication hai toh user ke hisab se nikalo
    // Agar auth nahi hai toh: const contacts = await Contact.find();
    const contacts = await Contact.find({ user: req.user.id }).sort({ createdAt: -1 });
    
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// --- 2. UPLOAD CSV (Universal Logic) ---
exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }

  const results = [];
  const maxRows = Number(process.env.CONTACT_CSV_MAX_ROWS || 5000);
  const cleanupUploadedFile = () => {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  };
  let rejected = false;
  
  // CSV Read Stream shuru
  const parser = fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      if (rejected) return;
      // 🛠️ MAGIC LOGIC: Keys ko lowercase aur trim karo
      // Taaki 'Name ' aur 'name' ek hi baat ho
      const normalizedData = {};
      Object.keys(data).forEach(key => {
        normalizedData[key.trim().toLowerCase()] = data[key];
      });

      // Ab exact values nikalo
      // Ye logic tumhare Excel file (name, phone) ke liye set hai
      const name = normalizedData['name'] || normalizedData['fullname'] || normalizedData['customer'];
      const phone = normalizedData['phone'] || normalizedData['mobile'] || normalizedData['contact'];

      if (name && phone) {
        results.push({
          user: req.user.id, // Current User ID
          name: name.trim(),
          phone: phone.toString().trim().replace(/[^0-9]/g, ''), // Sirf numbers rakho
          tags: ['Imported'], // Added tags support
          createdAt: new Date()
        });
      }

      if (results.length > maxRows) {
        rejected = true;
        parser.destroy(new Error('CSV row limit exceeded.'));
      }
    })
    .on('end', async () => {
      try {
        if (rejected) return;
        if (results.length === 0) {
          // File delete karo taaki server full na ho
          cleanupUploadedFile();
          return res.json({ msg: '0 contacts processed! Check CSV Headers (name, phone).' });
        }

        // Database mein Save karo (Insert Many is faster)
        // ordered: false ka matlab agar ek fail ho jaye toh baki rukenge nahi
        await Contact.insertMany(results, { ordered: false });
        
        // File delete karo
        cleanupUploadedFile();

        res.json({ msg: `${results.length} Contacts Imported Successfully!` });
      } catch (err) {
        console.error(err);
        // Duplicate key error handle karne ke liye (agar same phone number pehle se hai)
        cleanupUploadedFile();
        res.json({ msg: "Import Complete (Duplicates skipped)" });
      }
    })
    .on('error', (err) => {
      cleanupUploadedFile();
      if (!res.headersSent) {
        return res.status(400).json({ msg: err.message || 'Unable to parse CSV file.' });
      }
      return undefined;
    });
};

// --- 3. ADD SINGLE CONTACT ---
exports.addContact = async (req, res) => {
  const name = String(req.body?.name || '').replace(/[<>`]/g, '').trim().slice(0, 120);
  const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-15);
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag || '').replace(/[<>`]/g, '').trim().slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];
  try {
    if (!name || phone.length < 8) return res.status(400).json({ msg: 'Valid name and phone are required' });
    let contact = await Contact.findOne({ user: req.user.id, phone });
    if (contact) return res.status(400).json({ msg: 'Contact already exists' });

    contact = new Contact({ user: req.user.id, name, phone, tags });
    await contact.save();
    res.json(contact);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
};
