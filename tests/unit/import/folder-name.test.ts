import { describe, expect, it } from 'vitest';
import { folderDate } from '@/lib/import/folder-name';

describe('folderDate', () => {
  it('is ISO date and zero-padded 24-hour local time, whatever the UI language', () => {
    expect(folderDate(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05 09:07');
    expect(folderDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59');
  });
});
