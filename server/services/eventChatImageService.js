const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { fail } = require('./eventChatService');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const privateRoot = path.resolve(__dirname, '../private/event-chat-images');
const imagePath = (key) => {
  if (typeof key !== 'string' || !/^[0-9a-f-]{36}\.webp$/.test(key)) throw fail(404, 'Chat image not found.');
  return path.join(privateRoot, key);
};

const normalizeImage = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw fail(400, 'An image file is required.');
  if (buffer.length > MAX_IMAGE_BYTES) throw fail(413, 'Image exceeds the 5 MiB limit.');
  try {
    const options = { failOn: 'warning', limitInputPixels: 16 * 1024 * 1024 };
    const metadata = await sharp(buffer, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) {
      throw fail(415, 'Only nonanimated JPEG, PNG, and WebP images are supported.');
    }
    // Full decoding rejects corrupt payloads. Re-encoding strips EXIF/GPS and
    // user-controlled metadata, file names, and appended non-image content.
    const { data, info } = await sharp(buffer, options).rotate()
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGE_BYTES) throw fail(413, 'Processed image exceeds the 5 MiB limit.');
    return { data, mimeType: 'image/webp', size: data.length, width: info.width, height: info.height,
      digest: crypto.createHash('sha256').update(data).digest('hex') };
  } catch (error) {
    if (error.chatStatus) throw error;
    throw fail(415, 'Invalid, corrupt, unsupported, or excessively large image.');
  }
};
const saveImage = async (image) => {
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const storageKey = `${crypto.randomUUID()}.webp`;
  try { await fs.writeFile(imagePath(storageKey), image.data, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    // A failed write can leave a partial file. Only this random, fixed-root path
    // is eligible for cleanup; never use a client-provided filename.
    if (error.code !== 'EEXIST') await removeImage(storageKey);
    throw error;
  }
  return storageKey;
};
const removeImage = async (storageKey) => {
  try { await fs.unlink(imagePath(storageKey)); }
  catch (error) { if (error.code !== 'ENOENT') console.error('Private chat image cleanup failed.'); }
};

module.exports = { MAX_IMAGE_BYTES, normalizeImage, saveImage, removeImage, imagePath };