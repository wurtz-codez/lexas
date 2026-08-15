import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { syncGmail } from '../gmail-sync';
import { syncCalendar } from '../calendar-sync';
import { runCorrelation } from '../correlation-engine';
import { getDb } from '../database';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('../database', () => ({
  getDb: vi.fn(),
}));

vi.mock('../oauth-server', () => ({
  getValidAccessToken: vi.fn(() => Promise.resolve('test-token')),
}));

vi.mock('../gmail-sync', () => {
  class AuthError extends Error {}
  return { AuthError, syncGmail: vi.fn() };
});

vi.mock('../calendar-sync', () => ({
  syncCalendar: vi.fn(),
}));

vi.mock('../correlation-engine', () => ({
  runCorrelation: vi.fn(),
}));

function mockDb(): Database.Database {
  return {
    prepare: vi.fn(() => ({
      get: vi.fn(() => ({ email: 'me@company.com' })),
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
  } as unknown as Database.Database;
}

describe('runAllSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb());
    vi.mocked(syncGmail).mockResolvedValue({ synced: 5 });
    vi.mocked(syncCalendar).mockResolvedValue({ synced: 3 });
    vi.mocked(runCorrelation).mockResolvedValue({ resolved: 2, links: 4 });
  });

  it('returns results for all steps with no errors', async () => {
    const { runAllSync } = await import('../sync-server');
    const result = await runAllSync();

    expect(result).toEqual({
      gmail: { synced: 5 },
      calendar: { synced: 3 },
      correlation: { resolved: 2, links: 4 },
      errors: [],
    });
  });

  it('keeps successful steps and reports the failed one', async () => {
    vi.mocked(syncCalendar).mockRejectedValue(new Error('calendar down'));

    const { runAllSync } = await import('../sync-server');
    const result = await runAllSync();

    expect(result.gmail).toEqual({ synced: 5 });
    expect(result.calendar).toBeNull();
    expect(result.correlation).toEqual({ resolved: 2, links: 4 });
    expect(result.errors).toEqual(['calendar down']);
  });

  it('still runs later steps when an earlier step fails', async () => {
    vi.mocked(syncGmail).mockRejectedValue(new Error('gmail down'));

    const { runAllSync } = await import('../sync-server');
    const result = await runAllSync();

    expect(result.gmail).toBeNull();
    expect(result.calendar).toEqual({ synced: 3 });
    expect(result.correlation).toEqual({ resolved: 2, links: 4 });
    expect(result.errors).toEqual(['gmail down']);
  });
});
