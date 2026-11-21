import { describe, it, expect } from 'vitest';
import { LIBRARY, LIBRARY_GROUPS, searchLibrary } from './library.js';

describe('LIBRARY', () => {
  it('has >= 16 complete unique items', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(16);
    expect(new Set(LIBRARY.map(a => a.id)).size).toBe(LIBRARY.length);
    for (const a of LIBRARY) for (const k of ['group', 'title', 'detail', 'source']) expect(typeof a[k] === 'string' && a[k].length > 0).toBe(true);
  });
  it('has no URLs and no diagnostic/treatment wording', () => {
    for (const a of LIBRARY) {
      expect(JSON.stringify(a)).not.toMatch(/https?:|www\./i);
      expect(`${a.title} ${a.detail}`).not.toMatch(/chẩn đoán là|điều trị bằng|thuốc|liều/i);
    }
  });
  it('search by text (accent-insensitive) and group', () => {
    expect(searchLibrary(LIBRARY, 'tieu khien', 'Tất cả').length).toBe(0);
    expect(searchLibrary(LIBRARY, 'treu choc', 'Tất cả').some(a => a.id === 'anti-bullying')).toBe(true);
    const g = LIBRARY_GROUPS[2];
    expect(searchLibrary(LIBRARY, '', g).every(a => a.group === g)).toBe(true);
    expect(searchLibrary(LIBRARY, 'cdc', 'Tất cả').length).toBeGreaterThan(0);
  });
});
