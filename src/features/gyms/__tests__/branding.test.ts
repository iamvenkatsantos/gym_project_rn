import { brandingFor } from '@/features/gyms/branding-store';

describe('brandingFor', () => {
  it('keeps the gym name and logo link', () => {
    expect(brandingFor({ gymName: 'Iron Temple', logoUrl: 'https://x/a.png' })).toEqual({
      name: 'Iron Temple',
      logoUrl: 'https://x/a.png',
    });
  });

  it('is null without a logo, so the launch screen stays CoreFit', () => {
    expect(brandingFor({ gymName: 'Iron Temple', logoUrl: null })).toBeNull();
    expect(brandingFor({ gymName: 'Iron Temple' })).toBeNull();
    expect(brandingFor(null)).toBeNull();
  });
});
