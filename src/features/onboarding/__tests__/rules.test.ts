import {
  firstOnboardingError,
  onboardingValues,
  validateOnboarding,
} from '@/features/onboarding/rules';

const filled = { fullName: 'Nila Raman', phone: '+91 98765 43210', weight: '60,5', height: '160' };

describe('validateOnboarding', () => {
  it('passes a complete form with all three photos', () => {
    const errors = validateOnboarding(filled, new Set(['front', 'back', 'side']));
    expect(firstOnboardingError(errors)).toBeNull();
  });

  it('asks for every field and names the missing photos', () => {
    const errors = validateOnboarding(
      { fullName: '', phone: '', weight: '', height: '' },
      new Set(['back']),
    );
    expect(errors.fullName).toBe('Enter a full name.');
    expect(errors.phone).toBe('Enter a phone number.');
    expect(errors.weight).toBe('Enter your weight.');
    expect(errors.height).toBe('Enter your height.');
    expect(errors.photos).toBe('Add your front and side photos.');
  });

  it('checks ranges and phone numbers', () => {
    const errors = validateOnboarding(
      { ...filled, phone: '12345', weight: '400', height: '90' },
      new Set(['front', 'back']),
    );
    expect(errors.phone).toBe('Enter a 10-digit mobile number.');
    expect(errors.weight).toBe('Enter weight from 20 to 300 kg.');
    expect(errors.height).toBe('Enter height from 100 to 250 cm.');
    expect(errors.photos).toBe('Add your side photo.');
  });
});

describe('onboardingValues', () => {
  it('cleans up what was typed', () => {
    expect(onboardingValues({ ...filled, fullName: '  Nila   Raman ' })).toEqual({
      fullName: 'Nila Raman',
      phone: '9876543210',
      weightKg: 60.5,
      heightCm: 160,
    });
  });
});
