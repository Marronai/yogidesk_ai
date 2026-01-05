const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default_32_bit_key_for_testing_purposes');
const iv = Buffer.from(process.env.ENCRYPTION_IV || 'default_iv_16_bit');

// 🔒 Token ko Encrypt karna (Database mein save karne ke liye)
exports.encrypt = (text) => {
    if (!text) return "";
    let cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
};

// 🔓 Token ko Decrypt karna (WhatsApp bhejte waqt use karne ke liye)
exports.decrypt = (text) => {
    if (!text) return "";
    let encryptedText = Buffer.from(text, 'hex');
    let decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};