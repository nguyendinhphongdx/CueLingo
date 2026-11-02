import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5544/cuelingo_e2e';

/** The newest sign-in link the API printed for `email`, waiting for it to appear. */
export async function magicLinkFor(email: string, timeoutMs = 15_000): Promise<string> {
  const file = join(__dirname, '..', '.mail', 'links.jsonl');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const found = lines
      .map((line) => JSON.parse(line) as { email: string; url: string })
      .reverse()
      .find((entry) => entry.email === email);
    if (found) return found.url;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in link was printed for ${email}`);
}

const SEGMENTS = [
  {
    source: 'system',
    text: 'Can we circle back on the roadmap after the call?',
    vi: 'Chúng ta quay lại lộ trình sau cuộc gọi nhé?',
  },
  { source: 'mic', text: 'Sure, I will send the notes today.', vi: null },
  {
    source: 'system',
    text: 'Great, let us touch base on Friday.',
    vi: 'Tuyệt, thứ Sáu mình liên lạc lại nhé.',
  },
] as const;

/**
 * A finished meeting with a debrief, as the realtime path and the worker would have left it. The AI is
 * not part of this journey: what is tested is that the product shows it and builds learning from it.
 */
export async function seedMeeting(email: string): Promise<string> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    const [user] = await sql<{ id: string }[]>`SELECT id FROM auth_user WHERE email = ${email}`;
    if (!user) throw new Error(`No user ${email}`);
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, title, assist_level, status, started_at, ended_at)
      VALUES (${user.id}, 'Họp roadmap E2E', 3, 'debriefed',
              now() - interval '40 minutes', now() - interval '10 minutes')
      RETURNING id`;
    const ids: string[] = [];
    for (const [index, segment] of SEGMENTS.entries()) {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO segments (session_id, source, start_ms, end_ms, text_en, text_vi)
        VALUES (${session!.id}, ${segment.source}, ${index * 4000}, ${index * 4000 + 3000},
                ${segment.text}, ${segment.vi})
        RETURNING id`;
      ids.push(row!.id);
    }
    await sql`
      INSERT INTO debriefs (
        session_id, version, summary, action_items, hard_segment_ids,
        phrase_suggestions, rephrase, comprehension_pct, prompt_version
      ) VALUES (
        ${session!.id}, 1,
        ${sql.json({ headlineVi: 'Thống nhất xem lại lộ trình', bulletsVi: ['Gửi ghi chú trong ngày', 'Hẹn lại vào thứ Sáu'] })},
        ${sql.json([{ textVi: 'Gửi ghi chú cuộc họp', kind: 'todo' }])},
        ${[ids[0]!]}::uuid[],
        ${sql.json([{ phrase: 'circle back', meaningVi: 'quay lại bàn sau', exampleEn: 'Let us circle back next week.' }])},
        ${sql.json([])}, 80, 'e2e')`;
    return session!.id;
  } finally {
    await sql.end();
  }
}
