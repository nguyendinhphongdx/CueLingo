import { loadConfig } from '../config';
import { createSql } from '../lib/db';
import { generateInviteCode, hashInviteCode } from '../modules/invites';
import { createPostgresInvitesRepository } from '../modules/invites';

/**
 * Makes the first invite code, before any admin account exists to use /admin/invites.
 * `pnpm --filter @cuelingo/api invite:create [maxUses] [days] [note]` prints the plain code once.
 */
const [usesArg, daysArg, ...noteParts] = process.argv.slice(2);
const maxUses = Number(usesArg ?? 1);
const days = Number(daysArg ?? 30);
if (!Number.isInteger(maxUses) || maxUses < 1 || !Number.isInteger(days) || days < 1) {
  console.error('Usage: invite:create [maxUses=1] [days=30] [note]');
  process.exit(1);
}

const sql = createSql(loadConfig().DATABASE_URL);
const code = generateInviteCode();
await createPostgresInvitesRepository(sql).create({
  codeHash: hashInviteCode(code),
  maxUses,
  note: noteParts.join(' ').slice(0, 100) || null,
  expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  createdBy: null,
});
await sql.end();
// stdout only: the code is not stored anywhere in plain text.
process.stdout.write(`${code}\n`);
