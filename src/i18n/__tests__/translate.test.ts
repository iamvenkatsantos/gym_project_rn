import { translateChildren } from '@/i18n/children';
import { LANGUAGES } from '@/i18n/languages';
import { strings } from '@/i18n/strings';
import { createTranslator, fill } from '@/i18n/translate';

const table = {
  Save: ['சேமி', 'सेव करें'],
  Active: ['செயலில்', 'सक्रिय'],
  '{count} members': ['{count} உறுப்பினர்கள்', '{count} सदस्य'],
  '{name} is now {status}': ['{name} இப்போது {status}', '{name} अब {status} है'],
  '{a} and {b}': ['{a} மற்றும் {b}', '{a} और {b}'],
  '{planName} membership{x}.': ['{planName} மெம்பர்ஷிப்{x}.', '{planName} मेंबरशिप{x}।'],
  'until {date}': ['{date} வரை', '{date} तक'],
  '{x} y': ['never', 'never'],
};

describe('createTranslator', () => {
  const ta = createTranslator(table, 0);
  const hi = createTranslator(table, 1);

  it('translates exact text and keeps unknown text', () => {
    expect(ta('Save')).toBe('சேமி');
    expect(hi('Save')).toBe('सेव करें');
    expect(ta('Priya Mohan')).toBe('Priya Mohan');
    expect(ta('')).toBe('');
  });

  it('fills values into a matching key', () => {
    expect(ta('12 members')).toBe('12 உறுப்பினர்கள்');
    expect(hi('12 members')).toBe('12 सदस्य');
  });

  it('translates a value that is itself a key, one level deep', () => {
    expect(ta('Divya is now Active')).toBe('Divya இப்போது செயலில்');
    expect(ta('Monthly membership until 12 Nov.')).toBe('Monthly மெம்பர்ஷிப் 12 Nov வரை.');
  });

  it('keeps the spaces around a piece of a sentence', () => {
    expect(ta(' Save ')).toBe(' சேமி ');
  });

  it('ignores keys that are almost all placeholders', () => {
    expect(ta('a y')).toBe('a y');
    expect(ta('Divya and Arjun')).toBe('Divya and Arjun');
  });

  it('keeps open-ended keys off long text, like an announcement', () => {
    const long = 'We are closed on Diwali and open as usual from the next day';
    expect(ta(long)).toBe(long);
    expect(ta(`${long} is now Active`)).toBe(`${long} is now Active`);
  });

  it('prefers the key with more fixed text', () => {
    const t = createTranslator(
      { 'Open {name}': ['{name} திற', ''], 'Open {a} – {b}': ['{a} – {b} திறந்திருக்கும்', ''] },
      0,
    );
    expect(t('Open 5 am – 9 pm')).toBe('5 am – 9 pm திறந்திருக்கும்');
  });
});

describe('fill', () => {
  it('puts values in and drops unknown slots', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and ');
  });
});

describe('translateChildren', () => {
  const ta = createTranslator(table, 0);

  it('joins plain children before looking them up', () => {
    expect(translateChildren([12, ' members'], ta)).toBe('12 உறுப்பினர்கள்');
  });

  it('translates text pieces next to elements one by one', () => {
    const bold = { type: 'b' } as unknown as React.ReactElement;
    expect(translateChildren(['Save', bold], ta)).toEqual(['சேமி', bold]);
  });
});

describe('strings', () => {
  const slots = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const columns = LANGUAGES.filter((l) => l.column !== null).length;

  it('has a translation in every language column', () => {
    for (const [key, row] of Object.entries(strings)) {
      expect([key, row.length]).toEqual([key, columns]);
      for (const text of row) expect([key, text.trim().length > 0]).toEqual([key, true]);
    }
  });

  it('only uses placeholders its English key has', () => {
    for (const [key, row] of Object.entries(strings)) {
      const allowed = slots(key);
      for (const text of row) {
        for (const slot of slots(text)) expect([key, allowed.has(slot)]).toEqual([key, true]);
      }
    }
  });
});
