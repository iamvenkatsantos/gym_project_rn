import type { ReactNode } from 'react';

type Primitive = string | number | boolean | null | undefined;
const isPrimitive = (c: unknown): c is Primitive =>
  c === null || c === undefined || ['string', 'number', 'boolean'].includes(typeof c);

/**
 * Translates what a Text shows. Plain text is looked up whole, so `{count} members` written as
 * JSX matches its "{count} members" key. Text mixed with elements (a bold word) is translated
 * piece by piece; the elements translate themselves.
 */
export function translateChildren(
  children: ReactNode,
  translate: (s: string) => string,
): ReactNode {
  if (typeof children === 'string') return translate(children);
  if (!Array.isArray(children)) return children;
  if (children.every(isPrimitive)) {
    const whole = children.filter((c) => typeof c === 'string' || typeof c === 'number').join('');
    const translated = translate(whole);
    if (translated !== whole) return translated;
  }
  return children.map((c) => (typeof c === 'string' ? translate(c) : c));
}
