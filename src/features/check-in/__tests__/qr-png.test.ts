import { PNG } from 'pngjs';

import { qrPng } from '@/features/check-in/qr-png';

describe('qrPng', () => {
  it('is a valid square PNG with a white border and a black finder pattern', () => {
    const png = PNG.sync.read(Buffer.from(qrPng('corefit://check-in?gym=g&code=c', 10)));
    expect(png.width).toBe(png.height);
    const pixel = (x: number, y: number) => png.data[(y * png.width + x) * 4];
    expect(pixel(5, 5)).toBe(255); // quiet zone
    expect(pixel(45, 45)).toBe(0); // top-left finder, just inside the quiet zone
    expect(pixel(png.width - 46, 45)).toBe(0); // top-right finder
  });
});
