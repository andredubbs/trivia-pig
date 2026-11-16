import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ prisma: { $queryRaw: vi.fn() } }));
import { prisma } from './db';
import { waitForDb } from './ops';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('waits in the same process until a late-starting database becomes ready', async () => {
  vi.useFakeTimers();
  vi.spyOn(console,'warn').mockImplementation(() => {});
  const query=vi.mocked(prisma.$queryRaw);
  query.mockRejectedValueOnce(new Error('database starting')).mockRejectedValueOnce(new Error('database starting')).mockResolvedValueOnce([1]);
  const ready=waitForDb(Number.POSITIVE_INFINITY,100);
  await vi.advanceTimersByTimeAsync(250);
  await expect(ready).resolves.toBe(true);
  expect(query).toHaveBeenCalledTimes(3);
});
