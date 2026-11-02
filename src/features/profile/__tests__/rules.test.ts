import { firstProfileError, profileValues, validateProfile } from '@/features/profile/rules';

const texts = (fullName: string, phone: string, dateOfBirth = '') => ({
  fullName,
  phone,
  dateOfBirth,
});

describe('validateProfile', () => {
  it('passes a name and an Indian mobile', () => {
    expect(firstProfileError(validateProfile(texts('Ravi K', '+91 98765 43210')))).toBeNull();
  });

  it('requires the mobile for everyone', () => {
    const errors = validateProfile(texts('Ravi K', ''));
    expect(errors.phone).toBe('Enter your mobile number.');
    expect(firstProfileError(errors)).toBe('Enter your mobile number.');
  });

  it('rejects a short name and a bad number', () => {
    const errors = validateProfile(texts('R', '12345'));
    expect(errors.fullName).toBe('The full name is too short.');
    expect(errors.phone).toBe('Enter a 10-digit mobile number.');
  });

  it('takes an optional date of birth, checked when given', () => {
    expect(validateProfile(texts('Ravi K', '9876543210')).dateOfBirth).toBeNull();
    expect(validateProfile(texts('Ravi K', '9876543210', '31/02/1990')).dateOfBirth).toBe(
      'Enter the date as DD/MM/YYYY.',
    );
  });
});

describe('profileValues', () => {
  it('tidies the name and keeps the 10 digits of the mobile', () => {
    expect(profileValues(texts('  Ravi   Kumar ', '+91 98765-43210', '15/06/1995'))).toEqual({
      fullName: 'Ravi Kumar',
      phone: '9876543210',
      dateOfBirth: '1995-06-15',
    });
  });

  it('saves an empty date of birth as none', () => {
    expect(profileValues(texts('Ravi', '9876543210')).dateOfBirth).toBeNull();
  });
});
