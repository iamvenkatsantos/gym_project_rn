/**
 * A one-page PDF holding a JPEG, built in plain JS so it ships over the air
 * (no print module in the build). The page is A5 portrait; the image fills
 * its width inside the margins and sits at the top, like a printed receipt.
 */

/** A5 in PDF points (1/72 inch). */
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 595;
const MARGIN = 24;

/** Width, height and colour channels of a baseline or progressive JPEG, from its frame header. */
export function jpegSize(bytes: Uint8Array): {
  width: number;
  height: number;
  components: number;
} {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    // Start-of-frame markers (C0–CF), except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    // Markers without a length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  throw new Error('JPEG size not found');
}

function ascii(text: string) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** Where the image goes on the page, in points: fits the width, or the height if it's tall. */
export function imagePlacement(width: number, height: number) {
  const maxW = PAGE_WIDTH - MARGIN * 2;
  const maxH = PAGE_HEIGHT - MARGIN * 2;
  const scale = Math.min(maxW / width, maxH / height);
  const w = width * scale;
  const h = height * scale;
  return { x: (PAGE_WIDTH - w) / 2, y: PAGE_HEIGHT - MARGIN - h, w, h };
}

const n = (v: number) => Number(v.toFixed(2)).toString();

/** The PDF's bytes, with the JPEG placed on one A5 page. */
export function imagePdf(jpeg: Uint8Array, title = ''): Uint8Array {
  const { width, height, components } = jpegSize(jpeg);
  const colorSpace =
    components === 1 ? 'DeviceGray' : components === 4 ? 'DeviceCMYK' : 'DeviceRGB';
  const p = imagePlacement(width, height);
  const content = `q ${n(p.w)} 0 0 ${n(p.h)} ${n(p.x)} ${n(p.y)} cm /Im0 Do Q`;
  // Titles are kept to printable ASCII so they can't break the PDF string.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array) => {
    parts.push(chunk);
    length += chunk.length;
  };
  const object = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = length;
    if (typeof body === 'string') {
      push(ascii(`${id} 0 obj\n${body}\nendobj\n`));
    } else {
      push(ascii(`${id} 0 obj\n`));
      body.forEach(push);
      push(ascii('\nendobj\n'));
    }
  };

  push(ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(4, [
    ascii(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    ),
    jpeg,
    ascii('\nendstream'),
  ]);
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title (${safeTitle}) /Producer (CoreFit) >>`);

  const xref = length;
  let table = `xref\n0 7\n0000000000 65535 f \n`;
  for (let id = 1; id <= 6; id += 1) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(
    ascii(`${table}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`),
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
