const crypto = require('crypto');

const LEGACY_ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_PREFIX = 'v2';

const normalizeKeyMaterial = (value) => String(value || '').trim();

const decodeConfiguredKey = (rawKey) => {
    const value = normalizeKeyMaterial(rawKey);
    if (!value) return null;

    if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');

    try {
        const decoded = Buffer.from(value, 'base64');
        if (decoded.length === 32) return decoded;
    } catch {
        // Fall through to utf8 handling.
    }

    const utf8 = Buffer.from(value, 'utf8');
    if (utf8.length === 32) return utf8;
    return crypto.createHash('sha256').update(utf8).digest();
};

const getEncryptionKey = () => {
    const key = decodeConfiguredKey(process.env.ENCRYPTION_KEY);
    if (key) return key;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY must be configured for production credential encryption.');
    }

    return crypto
        .createHash('sha256')
        .update(process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'yogidesk-dev-credential-key')
        .digest();
};

const getLegacyKey = () => decodeConfiguredKey(process.env.ENCRYPTION_KEY || 'default_32_bit_key_for_testing_purposes');
const getLegacyIv = () => {
    const rawIv = Buffer.from(process.env.ENCRYPTION_IV || 'default_iv_16_bit', 'utf8');
    if (rawIv.length === 16) return rawIv;
    return crypto.createHash('md5').update(rawIv).digest();
};

exports.encrypt = (text) => {
    const value = String(text || '');
    if (!value) return '';

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        GCM_PREFIX,
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url')
    ].join(':');
};

const decryptGcm = (value) => {
    const [, ivPart, tagPart, encryptedPart] = String(value || '').split(':');
    if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid encrypted credential format.');

    const decipher = crypto.createDecipheriv(
        GCM_ALGORITHM,
        getEncryptionKey(),
        Buffer.from(ivPart, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, 'base64url')),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
};

const decryptLegacyCbc = (value) => {
    if (!/^[a-f0-9]+$/i.test(String(value || '')) || String(value || '').length % 2 !== 0) {
        throw new Error('Invalid legacy encrypted credential format.');
    }

    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, getLegacyKey(), getLegacyIv());
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(value, 'hex')),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
};

exports.decrypt = (text) => {
    const value = String(text || '').trim();
    if (!value) return '';
    if (value.startsWith(`${GCM_PREFIX}:`)) return decryptGcm(value);
    return decryptLegacyCbc(value);
};
