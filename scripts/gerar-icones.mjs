import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function createPng(width, height, drawPixel) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const ihdrChunk = makeChunk("IHDR", ihdrData);

  // IDAT chunk (raw image data with filter byte per line)
  const rawLineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rawLineSize);

  for (let y = 0; y < height; y++) {
    const lineStart = y * rawLineSize;
    rawData[lineStart] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelStart = lineStart + 1 + x * 4;
      rawData[pixelStart] = r;
      rawData[pixelStart + 1] = g;
      rawData[pixelStart + 2] = b;
      rawData[pixelStart + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressedData);

  // IEND chunk
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Simple CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Desenha com supersampling (4x4 amostras por pixel) para suavizar as bordas.
function createPngSuperSampled(width, height, colorAt, samples = 4) {
  return createPng(width, height, (x, y, w, h) => {
    let somaR = 0;
    let somaG = 0;
    let somaB = 0;
    let somaA = 0;

    for (let sy = 0; sy < samples; sy++) {
      for (let sx = 0; sx < samples; sx++) {
        const fx = x + (sx + 0.5) / samples;
        const fy = y + (sy + 0.5) / samples;
        const [r, g, b, a] = colorAt(fx, fy, w, h);
        const peso = a / 255;
        somaR += r * peso;
        somaG += g * peso;
        somaB += b * peso;
        somaA += a;
      }
    }

    if (somaA <= 0) return [0, 0, 0, 0];

    const pesoTotal = somaA / 255;
    return [
      Math.round(somaR / pesoTotal),
      Math.round(somaG / pesoTotal),
      Math.round(somaB / pesoTotal),
      Math.round(somaA / (samples * samples)),
    ];
  });
}

// Draw WhatsApp icon (Green background circle, white phone icon inside)
const whatsappBuffer = createPng(48, 48, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const distSq = dx * dx + dy * dy;
  const r = 21;

  // Anti-aliased circle
  if (distSq > r * r + r) return [0, 0, 0, 0];

  // WhatsApp Green: #25D366 => (37, 211, 102)
  let bgR = 37, bgG = 211, bgB = 102;
  
  // Outer circle edge smooth
  let alpha = 255;
  if (distSq > (r - 1) * (r - 1)) {
    alpha = Math.round(255 * (r - Math.sqrt(distSq)));
    if (alpha < 0) alpha = 0;
  }

  // Draw phone handset inside (simplified clean shape)
  // Phone body shape relative to center
  const px = dx + 1;
  const py = dy - 1;

  // Phone receiver contour
  const isPhone = 
    (px >= -9 && px <= 9 && py >= -9 && py <= 9) &&
    ((px * px + py * py >= 16) && (px * px + py * py <= 72)) &&
    (px + py * 0.8 <= 5);

  // White phone shape
  if (
    (px >= -7 && px <= -2 && py >= -7 && py <= 2) ||
    (px >= -2 && px <= 7 && py >= 2 && py <= 7) ||
    (px >= 1 && px <= 7 && py >= -4 && py <= 4 && px * py > 0)
  ) {
    // Phone bubble tail
    return [255, 255, 255, alpha];
  }

  // Tail of chat bubble at bottom-left
  if (dx >= -16 && dx <= -9 && dy >= 6 && dy <= 16 && (dx + dy <= 2)) {
    return [37, 211, 102, alpha];
  }

  return [bgR, bgG, bgB, alpha];
});

// Draw Instagram icon (Gradient rounded square, white camera inside)
const instagramBuffer = createPng(48, 48, (x, y, w, h) => {
  const r = 10;
  // Rounded square test
  let inside = false;
  if (x >= 4 && x <= 43 && y >= 4 && y <= 43) {
    const cornerX = x < 4 + r ? 4 + r : x > 43 - r ? 43 - r : x;
    const cornerY = y < 4 + r ? 4 + r : y > 43 - r ? 43 - r : y;
    const cdx = x - cornerX;
    const cdy = y - cornerY;
    if (cdx * cdx + cdy * cdy <= r * r) inside = true;
  }

  if (!inside) return [0, 0, 0, 0];

  // Instagram Gradient: Top-right Yellow/Orange (254, 218, 119) to Bottom-left Purple (131, 58, 180) / Pink (225, 48, 108)
  const t = (x + (47 - y)) / 94;
  const bgR = Math.round(131 + (254 - 131) * t);
  const bgG = Math.round(58 + (218 - 58) * t);
  const bgB = Math.round(180 + (119 - 180) * t);

  const cx = x - 23.5;
  const cy = y - 23.5;

  // Outer camera ring
  const distSq = cx * cx + cy * cy;
  if (distSq >= 49 && distSq <= 81) {
    return [255, 255, 255, 255]; // White inner lens ring
  }
  // Camera lens center dot
  if (cx >= 7 && cx <= 10 && cy >= -10 && cy <= -7) {
    return [255, 255, 255, 255]; // Top-right flash dot
  }

  // Camera outer rounded square contour
  if (Math.abs(cx) <= 14 && Math.abs(cy) <= 14) {
    if (Math.abs(cx) >= 12 || Math.abs(cy) >= 12) {
      if (Math.abs(cx) <= 14 && Math.abs(cy) <= 14) {
        return [255, 255, 255, 255];
      }
    }
  }

  return [bgR, bgG, bgB, 255];
});

// Ícone de site (círculo azul com globo branco)
const siteBuffer = createPngSuperSampled(48, 48, (x, y) => {
  const dx = x - 24;
  const dy = y - 24;
  const dist = Math.hypot(dx, dy);
  if (dist > 21) return [0, 0, 0, 0];

  const AZUL = [37, 99, 235]; // #2563EB
  const BRANCO = [255, 255, 255];

  const raioGlobo = 13.5;
  const traco = 1.9;

  // Aro do globo
  if (Math.abs(dist - raioGlobo) <= traco / 2) return [...BRANCO, 255];

  if (dist < raioGlobo) {
    // Equador e meridiano central
    if (Math.abs(dy) <= traco / 2) return [...BRANCO, 255];
    if (Math.abs(dx) <= traco / 2) return [...BRANCO, 255];
    // Meridiano elíptico (dá a volume de esfera)
    if (Math.abs(Math.hypot(dx / 0.5, dy) - raioGlobo) <= traco) return [...BRANCO, 255];
  }

  return [...AZUL, 255];
});

// Ícone de e-mail (círculo vermelho com envelope branco)
const emailBuffer = createPngSuperSampled(48, 48, (x, y) => {
  const dx = x - 24;
  const dy = y - 24;
  if (Math.hypot(dx, dy) > 21) return [0, 0, 0, 0];

  const VERMELHO = [217, 48, 37]; // #D93025
  const BRANCO = [255, 255, 255];

  const meiaLargura = 13;
  const meiaAltura = 9;
  if (Math.abs(dx) > meiaLargura || Math.abs(dy) > meiaAltura) return [...VERMELHO, 255];

  // Aba do envelope: "V" vermelho partindo dos cantos de cima até o meio.
  const alturaAba = 11.5;
  const yAba = -meiaAltura + alturaAba * (1 - Math.abs(dx) / meiaLargura);
  if (dy <= yAba && dy >= yAba - 2.4) return [...VERMELHO, 255];

  return [...BRANCO, 255];
});

fs.writeFileSync(path.join(process.cwd(), "public", "empresa", "whatsapp.png"), whatsappBuffer);
fs.writeFileSync(path.join(process.cwd(), "public", "empresa", "instagram.png"), instagramBuffer);
fs.writeFileSync(path.join(process.cwd(), "public", "empresa", "site.png"), siteBuffer);
fs.writeFileSync(path.join(process.cwd(), "public", "empresa", "email.png"), emailBuffer);

console.log("Ícones gerados com sucesso!");
