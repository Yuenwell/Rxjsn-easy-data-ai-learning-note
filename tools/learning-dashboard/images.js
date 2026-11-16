/* Screenshots stay inside local progress/JSON backups; exports use relative image paths. */
(function () {
  'use strict';
  const MAX_IMAGE = 320000, MAX_TOTAL = 2000000, MAX_COUNT = 6;
  async function prepare(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片。');
    if (file.size > 15 * 1024 * 1024) throw new Error('原图超过 15 MB，请先裁剪截图。');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!img.width || !img.height || img.width * img.height > 60000000) throw new Error('图片尺寸过大，请先裁剪。');
      let scale = Math.min(1, 2400 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); let data;
      for (let step = 0; step < 7; step++) {
        canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL('image/jpeg', .86 - Math.min(step, 3) * .08);
        if (data.length <= MAX_IMAGE) return { name: (file.name || '粘贴截图').slice(0, 200), data };
        scale *= .8;
      }
      throw new Error('图片压缩后仍过大，请先裁剪。');
    } finally { URL.revokeObjectURL(url); }
  }
  // Uncompressed ZIP, UTF-8 names, CRC32. No external resources or libraries.
  function zip(files) {
    const encoder = new TextEncoder(), parts = [], entries = []; let offset = 0;
    const u16 = (v, p, n) => v.setUint16(p, n, true), u32 = (v, p, n) => v.setUint32(p, n >>> 0, true);
    const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
    for (const file of files) {
      const name = encoder.encode(file.name), bytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
      let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ crc >>> 8; crc = (crc ^ 0xffffffff) >>> 0;
      const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
      u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x800); u16(lv, 12, 33); u32(lv, 14, crc); u32(lv, 18, bytes.length); u32(lv, 22, bytes.length); u16(lv, 26, name.length); local.set(name, 30);
      parts.push(local, bytes);
      const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
      u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0x800); u16(cv, 14, 33); u32(cv, 16, crc); u32(cv, 20, bytes.length); u32(cv, 24, bytes.length); u16(cv, 28, name.length); u32(cv, 42, offset); central.set(name, 46);
      entries.push(central); offset += local.length + bytes.length;
    }
    const centralSize = entries.reduce((sum, item) => sum + item.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
    u32(ev, 0, 0x06054b50); u16(ev, 8, entries.length); u16(ev, 10, entries.length); u32(ev, 12, centralSize); u32(ev, 16, offset);
    return new Blob([...parts, ...entries, end], { type: 'application/zip' });
  }
  function bytes(dataUrl) { return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0)); }
  window.CourseImages = { prepare, zip, bytes, MAX_TOTAL, MAX_COUNT };
})();
