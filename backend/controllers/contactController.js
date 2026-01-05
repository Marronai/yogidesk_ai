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
  
  // CSV Read Stream shuru
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
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
    })
    .on('end', async () => {
      try {
        if (results.length === 0) {
          // File delete karo taaki server full na ho
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.json({ msg: '0 contacts processed! Check CSV Headers (name, phone).' });
        }

        // Database mein Save karo (Insert Many is faster)
        // ordered: false ka matlab agar ek fail ho jaye toh baki rukenge nahi
        await Contact.insertMany(results, { ordered: false });
        
        // File delete karo
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ msg: `${results.length} Contacts Imported Successfully!` });
      } catch (err) {
        console.error(err);
        // Duplicate key error handle karne ke liye (agar same phone number pehle se hai)
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ msg: "Import Complete (Duplicates skipped)" });
      }
    });
};

// --- 3. ADD SINGLE CONTACT ---
exports.addContact = async (req, res) => {
  const { name, phone, tags } = req.body;
  try {
    let contact = await Contact.findOne({ user: req.user.id, phone });
    if (contact) return res.status(400).json({ msg: 'Contact already exists' });

    contact = new Contact({ user: req.user.id, name, phone, tags });
    await contact.save();
    res.json(contact);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
};