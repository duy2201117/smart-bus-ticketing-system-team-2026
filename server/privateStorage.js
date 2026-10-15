import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from './domain.js';

const allowedMime = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);
const maxBytes = 2 * 1024 * 1024;

export function createPrivateStorage(root = process.env.PRIVATE_STORAGE_DIR || 'data/private') {
  const base = resolve(root);
  return {
    async saveBase64({ fileName, mimeType, dataBase64 }) {
      if (!allowedMime.has(mimeType)) fail(400, 'Minh chứng chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.');
      if (typeof dataBase64 !== 'string' || !dataBase64) fail(400, 'Tệp minh chứng không hợp lệ.');
      let buffer;
      try { buffer = Buffer.from(dataBase64, 'base64'); } catch { fail(400, 'Tệp minh chứng không hợp lệ.'); }
      if (!buffer.length || buffer.length > maxBytes) fail(400, 'Tệp minh chứng phải nhỏ hơn hoặc bằng 2 MB.');
      const suppliedExt = extname(String(fileName || '')).toLowerCase();
      const ext = allowedMime.get(mimeType);
      if (suppliedExt && suppliedExt !== ext && !(mimeType === 'image/jpeg' && suppliedExt === '.jpeg')) fail(400, 'Định dạng tệp không khớp nội dung khai báo.');
      await mkdir(base, { recursive: true });
      const storageName = `${randomUUID().replaceAll('-', '')}${ext}`;
      const storagePath = resolve(base, storageName);
      if (!storagePath.startsWith(base)) fail(400, 'Đường dẫn lưu trữ không hợp lệ.');
      await writeFile(storagePath, buffer, { flag: 'wx', mode: 0o600 });
      return { storagePath, originalName: String(fileName || `minh-chung${ext}`).slice(0, 180), mimeType, sizeBytes: buffer.length };
    },
    async read(storagePath) {
      const resolved = resolve(storagePath);
      if (!resolved.startsWith(base)) fail(403, 'Không được phép truy cập tệp này.');
      return readFile(resolved);
    },
  };
}
