import { imagePdf, imagePlacement, jpegSize } from '@/lib/image-pdf';

/** The start of a JPEG: SOI, an APP0 segment, then a baseline frame header. */
function fakeJpeg(width: number, height: number, components = 3) {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    components,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0xff,
    0xd9,
  ]);
}

function text(bytes: Uint8Array) {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}

describe('jpegSize', () => {
  it('reads the frame header after other segments', () => {
    expect(jpegSize(fakeJpeg(1080, 1500))).toEqual({ width: 1080, height: 1500, components: 3 });
  });

  it('refuses anything that is not a JPEG', () => {
    expect(() => jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow('Not a JPEG');
  });
});

describe('imagePlacement', () => {
  it('fills the A5 width inside the margins, at the top', () => {
    const p = imagePlacement(1080, 1440);
    expect(p.w).toBeCloseTo(372);
    expect(p.x).toBeCloseTo(24);
    expect(p.y + p.h).toBeCloseTo(571);
  });

  it('fits a tall image by height', () => {
    const p = imagePlacement(500, 5000);
    expect(p.h).toBeCloseTo(547);
    expect(p.y).toBeCloseTo(24);
  });
});

describe('imagePdf', () => {
  it('makes a one-page A5 PDF with the JPEG and a valid xref', () => {
    const jpeg = fakeJpeg(1080, 1440);
    const pdf = text(imagePdf(jpeg, 'Receipt 0042 (₹)'));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/MediaBox [0 0 420 595]');
    expect(pdf).toContain(`/Width 1080 /Height 1440 /ColorSpace /DeviceRGB`);
    expect(pdf).toContain(`/Length ${jpeg.length}`);
    expect(pdf).toContain('/Title (Receipt 0042 )');
    // Every xref entry points at its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...pdf.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    offsets.forEach((at, i) => expect(pdf.slice(at, at + 8)).toBe(`${i + 1} 0 obj\n`));
  });

  it('uses grey for one-channel JPEGs', () => {
    expect(text(imagePdf(fakeJpeg(10, 10, 1)))).toContain('/ColorSpace /DeviceGray');
  });
});
