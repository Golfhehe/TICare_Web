import { describe, it, expect, vi } from 'vitest';
import { mutate } from './db.js';

const fakeQuery = (result) => ({ select: vi.fn().mockResolvedValue(result) });

describe('mutate', () => {
  it('throws the Supabase error', async () => {
    const err = new Error('boom');
    await expect(mutate(fakeQuery({ data: null, error: err }))).rejects.toBe(err);
  });
  it('throws a Vietnamese message when no rows were affected', async () => {
    await expect(mutate(fakeQuery({ data: [], error: null }))).rejects.toThrow(/Không có quyền/);
    await expect(mutate(fakeQuery({ data: null, error: null }))).rejects.toThrow(/Không có quyền/);
  });
  it('returns data on success and selects the given key', async () => {
    const q = fakeQuery({ data: [{ post_id: 'a' }], error: null });
    await expect(mutate(q, { key: 'post_id' })).resolves.toEqual([{ post_id: 'a' }]);
    expect(q.select).toHaveBeenCalledWith('post_id');
  });
  it('defaults key to id', async () => {
    const q = fakeQuery({ data: [{ id: 1 }], error: null });
    await mutate(q);
    expect(q.select).toHaveBeenCalledWith('id');
  });
  it('allows empty result when expectRows=false', async () => {
    await expect(mutate(fakeQuery({ data: [], error: null }), { expectRows: false })).resolves.toEqual([]);
  });
});
