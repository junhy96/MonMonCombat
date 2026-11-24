// 최소 PNG 읽기·쓰기 (외부 라이브러리 없이 node:zlib) — 8비트 RGB/RGBA, 비인터레이스만.
// 게임 캡처에서 아이콘을 잘라 내는 데 쓴다.
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** PNG 바이트 → { width, height, data: RGBA Uint8Array } */
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('PNG가 아닙니다');
  let off = 8, width, height, depth, color, interlace;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('latin1', off + 4, off + 8), body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; color = body[9]; interlace = body[12]; }
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (color !== 6 && color !== 2) || interlace) throw new Error(`지원하지 않는 PNG (깊이 ${depth}, 색 ${color}, 인터레이스 ${interlace})`);
  const bpp = color === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  if (bpp === 4) return { width, height, data: px };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) { rgba[j] = px[i]; rgba[j + 1] = px[i + 1]; rgba[j + 2] = px[i + 2]; rgba[j + 3] = 255; }
  return { width, height, data: rgba };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}

/** { width, height, data: RGBA } → PNG 바이트 */
export function encodePNG({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** 이미지의 직사각형 영역 잘라 내기 (경계 밖은 잘림) */
export function crop(img, x0, y0, w, h) {
  const x1 = Math.max(0, x0), y1 = Math.max(0, y0), x2 = Math.min(img.width, x0 + w), y2 = Math.min(img.height, y0 + h);
  const W = x2 - x1, H = y2 - y1, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) data.set(img.data.subarray(((y1 + y) * img.width + x1) * 4, ((y1 + y) * img.width + x2) * 4), y * W * 4);
  return { width: W, height: H, data };
}
