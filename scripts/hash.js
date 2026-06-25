import crypto from 'node:crypto';
console.log('med123 hash:', crypto.createHash('sha256').update('med123').digest('hex'));
console.log('admin123 hash:', crypto.createHash('sha256').update('admin123').digest('hex'));
