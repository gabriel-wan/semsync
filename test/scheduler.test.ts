import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/lib/database';
import { ensureScheduledSync, JOB_NAME, SCHEDULE, syncCommand } from '../src/lib/scheduler';
import { testDb } from './pg';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/** A database that says it has pg_cron, pg_net and Vault, and records every statement it's given. */
function supabaseLike(existingSecretId: string | null) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const db = {
    exec: async (sql: string) => { calls.push({ sql, args: [] }); },
    prepare: (sql: string) => {
      const call = { sql, args: [] as unknown[] };
      calls.push(call);
      const stmt = {
        bind: (...args: unknown[]) => { call.args = args; return stmt; },
        all: async () => ({ results: [{ name: 'pg_cron' }, { name: 'pg_net' }, { name: 'supabase_vault' }] }),
        first: async () => (existingSecretId ? { id: existingSecretId } : null),
        run: async () => ({}),
      };
      return stmt;
    },
  } as unknown as Db;
  return { db, calls };
}

describe('the scheduled sync in the database', () => {
  it('calls the sync with the secret from the vault, never written into the job', () => {
    const sql = syncCommand('https://semsync.live');
    expect(sql).toContain("url := 'https://semsync.live/api/cron'");
    expect(sql).toContain("from vault.decrypted_secrets where name = 'semsync_cron_secret'");
    expect(sql).toContain('timeout_milliseconds := 300000');
  });

  it("refuses an address that isn't a plain https one, since it goes into SQL", () => {
    expect(() => syncCommand('http://semsync.live')).toThrow();
    expect(() => syncCommand("https://x.live/'); drop table users; --")).not.toThrow(); // the path is replaced by /api/cron
    expect(syncCommand("https://x.live/'); drop table users; --")).not.toContain('drop');
  });

  it('stores the secret and schedules the job every 20 minutes', async () => {
    const { db, calls } = supabaseLike(null);
    const done = await ensureScheduledSync(db, { appUrl: 'https://semsync.live', secret: 's3cret' });
    expect(done).toContain(JOB_NAME);
    expect(calls.some((c) => c.sql.includes('CREATE EXTENSION IF NOT EXISTS pg_cron'))).toBe(true);
    const create = calls.find((c) => c.sql.includes('vault.create_secret'))!;
    expect(create.args[0]).toBe('s3cret');
    const schedule = calls.find((c) => c.sql.includes('cron.schedule'))!;
    expect(schedule.args.slice(0, 2)).toEqual([JOB_NAME, SCHEDULE]);
    expect(String(schedule.args[2])).not.toContain('s3cret');
    expect(SCHEDULE).toBe('2,22,42 * * * *');
  });

  it('updates the stored secret on later deploys instead of adding another', async () => {
    const { db, calls } = supabaseLike('7d1f0c2e-0000-4000-8000-000000000000');
    await ensureScheduledSync(db, { appUrl: 'https://semsync.live', secret: 'new' });
    expect(calls.some((c) => c.sql.includes('vault.create_secret'))).toBe(false);
    expect(calls.find((c) => c.sql.includes('vault.update_secret'))!.args).toEqual(['7d1f0c2e-0000-4000-8000-000000000000', 'new']);
  });
});

describe('on a database without a scheduler', () => {
  let stop: (() => Promise<void>) | undefined;
  afterEach(async () => { await stop?.(); stop = undefined; });

  it('does nothing (local development and tests run on PGlite)', async () => {
    const t = await testDb();
    stop = t.stop;
    expect(await ensureScheduledSync(t.db, { appUrl: 'https://semsync.live', secret: 'x' })).toMatch(/^skipped/);
  });
});
