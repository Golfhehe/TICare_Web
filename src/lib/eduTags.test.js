import { EDU_TAGS, sanitizeTags, tagLabel, TAG_ID_RE, MAX_TAGS } from './eduTags';

describe('eduTags', () => {
  it('ids are valid and unique, groups known', () => {
    const ids = EDU_TAGS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of EDU_TAGS) { expect(TAG_ID_RE.test(t.id)).toBe(true); expect(['chu-de', 'ky-nang', 'hinh-thuc']).toContain(t.group); }
  });
  it('sanitizeTags drops unknown/duplicates and caps the count', () => {
    expect(sanitizeTags(['ton-trong', 'ton-trong', 'x'])).toEqual(['ton-trong']);
    expect(sanitizeTags(EDU_TAGS.map(t => t.id))).toHaveLength(MAX_TAGS);
    expect(sanitizeTags(null)).toEqual([]);
  });
  it('tagLabel falls back to the id', () => {
    expect(tagLabel('tro-choi')).toBe('Trò chơi');
    expect(tagLabel('zzz')).toBe('zzz');
  });
});
