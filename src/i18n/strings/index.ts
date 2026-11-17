import type { Table } from '../translate';

import { dataValues } from './data-values';
import { part1 } from './part1';
import { part2 } from './part2';
import { part3 } from './part3';
import { part4 } from './part4';

/**
 * Every translation: English text → [Tamil, Hindi] (the `column` order in `languages.ts`).
 * Split into parts, sorted by key, only to keep files a workable size. Add new text to the
 * part its key sorts into; `node scripts/i18n-extract.mjs` lists text still missing.
 */
export const strings: Table = { ...part1, ...part2, ...part3, ...part4, ...dataValues };
