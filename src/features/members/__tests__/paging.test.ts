import { searchPattern } from '@/features/members/api';

describe('searchPattern', () => {
  it('wraps the text in a quoted wildcard pattern', () => {
    expect(searchPattern('  Priya ')).toBe('"*Priya*"');
    expect(searchPattern('a.b@gmail.com')).toBe('"*a.b@gmail.com*"');
  });

  it('drops what would break the PostgREST filter', () => {
    expect(searchPattern('a,b(c)"d\\e*f%g')).toBe('"*a b c d e f g*"');
  });

  it('is null for empty text', () => {
    expect(searchPattern('')).toBeNull();
    expect(searchPattern(' ,* ')).toBeNull();
  });
});
