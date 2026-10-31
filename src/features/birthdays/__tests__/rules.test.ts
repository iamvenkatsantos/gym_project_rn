import {
  ageOn,
  birthDateInput,
  birthdayLabel,
  birthdayMessage,
  daysUntilBirthday,
  formatBirthDateInput,
  isBirthdayToday,
  missingBirthdays,
  parseBirthDate,
  turningAge,
  upcomingBirthdays,
  validateBirthDate,
  whenLabel,
} from '@/features/birthdays/rules';
import type { GymPerson } from '@/features/members/types';

const today = new Date(2026, 9, 31); // 31 Oct 2026

const member = (
  id: string,
  dateOfBirth: string | null,
  extra: Partial<GymPerson> = {},
): GymPerson => ({
  id,
  fullName: id,
  email: `${id}@example.com`,
  role: 'member',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00Z',
  dateOfBirth,
  ...extra,
});

describe('typing a date of birth', () => {
  it('adds the slashes as digits go in', () => {
    expect(formatBirthDateInput('1')).toBe('1');
    expect(formatBirthDateInput('150')).toBe('15/0');
    expect(formatBirthDateInput('15061995')).toBe('15/06/1995');
    expect(formatBirthDateInput('15/06/19951')).toBe('15/06/1995');
  });

  it('reads day first and refuses impossible dates', () => {
    expect(parseBirthDate('15/06/1995')).toBe('1995-06-15');
    expect(parseBirthDate('5.6.1995')).toBe('1995-06-05');
    expect(parseBirthDate('31/02/1995')).toBeNull();
    expect(parseBirthDate('15/06/95')).toBeNull();
  });

  it('turns a saved date back into the form', () => {
    expect(birthDateInput('1995-06-15')).toBe('15/06/1995');
    expect(birthDateInput(null)).toBe('');
  });

  it('checks the date is real, past and at least 5 years back', () => {
    expect(validateBirthDate('', {}, today)).toBeNull();
    expect(validateBirthDate('', { required: true }, today)).toBe('Enter your date of birth.');
    expect(validateBirthDate('15/13/1995', {}, today)).toBe('Enter the date as DD/MM/YYYY.');
    expect(validateBirthDate('01/01/2025', {}, today)).toBe('Enter a valid date of birth.');
    expect(validateBirthDate('01/01/1899', {}, today)).toBe('Enter a valid date of birth.');
    expect(validateBirthDate('31/10/2021', {}, today)).toBeNull();
  });
});

describe('birthdays', () => {
  it('counts the days to the next one', () => {
    expect(daysUntilBirthday('1990-10-31', today)).toBe(0);
    expect(daysUntilBirthday('1990-11-04', today)).toBe(4);
    expect(daysUntilBirthday('1990-10-30', today)).toBe(364);
  });

  it('puts 29 Feb on 28 Feb outside leap years', () => {
    expect(isBirthdayToday('2000-02-29', new Date(2027, 1, 28))).toBe(true);
    expect(isBirthdayToday('2000-02-29', new Date(2028, 1, 28))).toBe(false);
  });

  it('knows how old they are and turn', () => {
    expect(turningAge('1990-10-31', today)).toBe(36);
    expect(ageOn('1990-10-31', today)).toBe(36);
    expect(turningAge('1990-11-04', today)).toBe(36);
    expect(ageOn('1990-11-04', today)).toBe(35);
    expect(turningAge('1990-01-10', today)).toBe(37);
  });

  it('labels the day', () => {
    expect(birthdayLabel('1995-06-15')).toBe('15 Jun');
    expect(whenLabel(0)).toBe('Today');
    expect(whenLabel(1)).toBe('Tomorrow');
    expect(whenLabel(9)).toBe('In 9 days');
  });

  it('lists active members with a birthday soon, soonest first', () => {
    const people = [
      member('later', '1990-11-20'),
      member('today', '1999-10-31'),
      member('far', '1990-06-01'),
      member('none', null),
      member('away', '1990-10-31', { status: 'suspended' }),
      member('coach', '1990-10-31', { role: 'trainer' }),
    ];
    expect(upcomingBirthdays(people, today).map((b) => [b.person.id, b.days, b.turning])).toEqual([
      ['today', 0, 27],
      ['later', 20, 36],
    ]);
    expect(missingBirthdays(people)).toBe(1);
  });

  it('writes the WhatsApp wish with their first name', () => {
    expect(birthdayMessage('Nandini Ravi', 'Pulse Fitness')).toBe(
      'Happy birthday, Nandini! 🎂 Wishing you a healthy and strong year ahead. From all of us at Pulse Fitness.',
    );
  });
});
