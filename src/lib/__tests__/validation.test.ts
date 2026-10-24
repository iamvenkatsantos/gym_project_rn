import {
  parseAmount,
  validateAmount,
  validateCode,
  validateDecimal,
  validateEmail,
  validateName,
  validateNewPassword,
  validatePasswordMatch,
  validatePhone,
  validateTitle,
  validateWholeNumber,
} from '@/lib/validation';

describe('validateEmail', () => {
  it.each(['venkat@example.com', ' Maya.R+gym@mail.co.in ', 'a_b@x-y.org'])('accepts %s', (e) =>
    expect(validateEmail(e)).toBeNull(),
  );
  it.each(['', 'venkat', 'venkat@', 'venkat@example', 'ven kat@example.com', 'a@b.c', 'a@@b.com'])(
    'rejects %p',
    (e) => expect(validateEmail(e)).not.toBeNull(),
  );
});

describe('validateName', () => {
  it('accepts real names in any script', () => {
    expect(validateName('Venkatesh R')).toBeNull();
    expect(validateName("D'Souza-Pai")).toBeNull();
    expect(validateName('வெங்கடேஷ்')).toBeNull();
  });
  it('rejects empty, one letter, digits and symbols', () => {
    expect(validateName('  ')).toMatch(/Enter/);
    expect(validateName('V')).toMatch(/short/);
    expect(validateName('Venkat123')).toMatch(/letters/);
    expect(validateName('<script>')).toMatch(/letters/);
  });
});

describe('passwords', () => {
  it('needs 8+ characters with letters and a number', () => {
    expect(validateNewPassword('short1')).toMatch(/at least 8/);
    expect(validateNewPassword('allletters')).toMatch(/number/);
    expect(validateNewPassword(' corefit2026')).toMatch(/spaces/);
    expect(validateNewPassword('corefit2026')).toBeNull();
  });
  it('checks the confirmation', () => {
    expect(validatePasswordMatch('corefit2026', '')).toMatch(/again/);
    expect(validatePasswordMatch('corefit2026', 'corefit2025')).toMatch(/match/);
    expect(validatePasswordMatch('corefit2026', 'corefit2026')).toBeNull();
  });
});

describe('codes and phones', () => {
  it('takes 6 to 10 digit codes', () => {
    expect(validateCode('123456')).toBeNull();
    expect(validateCode('12345')).not.toBeNull();
    expect(validateCode('')).toMatch(/Enter/);
  });
  it('takes Indian mobile numbers', () => {
    expect(validatePhone('98765 43210')).toBeNull();
    expect(validatePhone('+91 9876543210')).toBeNull();
    expect(validatePhone('12345')).not.toBeNull();
    expect(validatePhone('5876543210')).not.toBeNull();
  });
});

describe('amounts', () => {
  it('parses rupees to paise', () => {
    expect(parseAmount('₹1,499')).toBe(149900);
    expect(parseAmount('1499.5')).toBe(149950);
    expect(parseAmount('14.999')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(validateAmount('')).toMatch(/Enter the amount/);
    expect(validateAmount('12a')).toMatch(/like 1499/);
    expect(validateAmount('0', { label: 'price' })).toMatch(/more than/);
    expect(validateAmount('0', { allowZero: true })).toBeNull();
    expect(validateAmount('99999999')).not.toBeNull();
    expect(validateAmount('1499')).toBeNull();
  });
});

describe('text and numbers', () => {
  it('validates titles', () => {
    expect(validateTitle('   ', { label: 'class name' })).toBe('Enter a class name.');
    expect(validateTitle('A')).toMatch(/short/);
    expect(validateTitle('!!!')).toMatch(/letters or numbers/);
    expect(validateTitle('x'.repeat(41), { max: 40 })).toMatch(/under 40/);
    expect(validateTitle('Morning HIIT')).toBeNull();
  });
  it('validates reps and kilograms', () => {
    expect(validateWholeNumber('12', { max: 200 })).toBeNull();
    expect(validateWholeNumber('1.5')).toMatch(/whole/);
    expect(validateWholeNumber('500', { max: 200 })).toMatch(/0 to 200/);
    expect(validateDecimal('22,5')).toBeNull();
    expect(validateDecimal('22.555')).not.toBeNull();
    expect(validateDecimal('600', { max: 500 })).toMatch(/0 to 500/);
  });
});
