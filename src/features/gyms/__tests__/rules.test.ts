import { cleanGymDetails, emptyGymDetails, validateGymDetails } from '@/features/gyms/rules';

describe('validateGymDetails', () => {
  it('only requires the name', () => {
    const errors = validateGymDetails({ ...emptyGymDetails, name: 'Iron House' });
    expect(Object.values(errors).every((e) => e === null)).toBe(true);
  });

  it('asks for a name', () => {
    expect(validateGymDetails(emptyGymDetails).name).toBe('Enter a gym name.');
  });

  it('checks the phone and email when given', () => {
    const errors = validateGymDetails({
      ...emptyGymDetails,
      name: 'Iron House',
      phone: '12345',
      email: 'not-an-email',
    });
    expect(errors.phone).not.toBeNull();
    expect(errors.email).not.toBeNull();
  });
});

describe('gym phone', () => {
  it.each(['98400 12345', '+91 98400 12345', '044 2345 6789', '044-23456789', '(044) 2345 6789'])(
    'accepts %s',
    (phone) =>
      expect(
        validateGymDetails({ ...emptyGymDetails, name: 'Iron House', phone }).phone,
      ).toBeNull(),
  );

  it.each(['12345', '0000000000', '98400 1234'])('rejects %s', (phone) =>
    expect(
      validateGymDetails({ ...emptyGymDetails, name: 'Iron House', phone }).phone,
    ).not.toBeNull(),
  );
});

describe('cleanGymDetails', () => {
  it('drops brackets and hyphens from a landline', () => {
    expect(cleanGymDetails({ ...emptyGymDetails, phone: '(044) 2345-6789' }).phone).toBe(
      '04423456789',
    );
  });

  it('trims fields, drops spaces in the phone and lowercases the email', () => {
    expect(
      cleanGymDetails({
        name: ' Iron House ',
        address: ' 12 Main Rd ',
        city: ' Chennai',
        phone: '98400 12345',
        email: ' Desk@IronHouse.in ',
      }),
    ).toEqual({
      name: 'Iron House',
      address: '12 Main Rd',
      city: 'Chennai',
      phone: '9840012345',
      email: 'desk@ironhouse.in',
    });
  });
});
