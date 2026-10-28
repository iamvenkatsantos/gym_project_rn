import { firstProfileError, profileValues, validateProfile } from '@/features/profile/rules';

describe('validateProfile', () => {
  it('passes a name and an Indian mobile', () => {
    expect(
      firstProfileError(validateProfile({ fullName: 'Ravi K', phone: '+91 98765 43210' })),
    ).toBeNull();
  });

  it('requires the mobile for everyone', () => {
    const errors = validateProfile({ fullName: 'Ravi K', phone: '' });
    expect(errors.phone).toBe('Enter your mobile number.');
    expect(firstProfileError(errors)).toBe('Enter your mobile number.');
  });

  it('rejects a short name and a bad number', () => {
    const errors = validateProfile({ fullName: 'R', phone: '12345' });
    expect(errors.fullName).toBe('The full name is too short.');
    expect(errors.phone).toBe('Enter a 10-digit mobile number.');
  });
});

describe('profileValues', () => {
  it('tidies the name and keeps the 10 digits of the mobile', () => {
    expect(profileValues({ fullName: '  Ravi   Kumar ', phone: '+91 98765-43210' })).toEqual({
      fullName: 'Ravi Kumar',
      phone: '9876543210',
    });
  });
});
