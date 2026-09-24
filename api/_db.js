import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ADMIN_CODE_HASH = '756972610c98f6c4dc5c867d5f8c1bc429a5b48d284eeb763a8343702d50675e';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  return neon(databaseUrl);
}

export function cleanString(value, max = 1000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

export function safeInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function safeIso(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function verifyAdminCode(code) {
  const submitted = createHash('sha256').update(cleanString(code, 200)).digest();
  const expected = Buffer.from(ADMIN_CODE_HASH, 'hex');
  return submitted.length === expected.length && timingSafeEqual(submitted, expected);
}

export function createSessionId() {
  return 'sess_' + randomBytes(24).toString('base64url');
}

export async function getOrCreateCandidate(sql, name, email) {
  let rows = await sql`
    SELECT id
    FROM candidates
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;

  if (rows[0]) {
    await sql`
      UPDATE candidates
      SET name = ${name}, updated_at = NOW()
      WHERE id = ${rows[0].id}
    `;
    return rows[0].id;
  }

  rows = await sql`
    INSERT INTO candidates (name, email)
    VALUES (${name}, ${email})
    RETURNING id
  `;
  return rows[0].id;
}

export async function upsertAnswers(sql, sessionId, answers) {
  const entries = Object.entries(answers || {})
    .filter(([qid]) => /^(q(?:[1-9]|1[0-4])|ws(?:[1-9]|[12][0-9]|30)|ws_dimensions|ws_consistency)$/.test(qid))
    .map(([qid, answer]) => [
      qid,
      typeof answer === 'string' ? answer.slice(0, 50000) : JSON.stringify(answer).slice(0, 50000)
    ]);

  if (!entries.length) return;

  const params = [];
  const tuples = entries.map(([qid, answer], index) => {
    const base = index * 3;
    params.push(sessionId, qid, answer);
    return `($${base + 1}, $${base + 2}, $${base + 3}, NOW())`;
  });

  await sql.query(
    `INSERT INTO assessment_answers (session_id, question_id, answer, recorded_at)
     VALUES ${tuples.join(',')}
     ON CONFLICT (session_id, question_id) DO UPDATE SET
       answer = EXCLUDED.answer,
       recorded_at = NOW()`,
    params
  );
}

export async function insertEvents(sql, sessionId, events) {
  const valid = Array.isArray(events) ? events.slice(0, 500).map((event) => ({
    eventId: cleanString(event?.eventId, 150),
    timestamp: safeIso(event?.timestamp, null),
    type: cleanString(event?.type, 60),
    qid: cleanString(event?.questionId || event?.qid, 30) || null,
    detail: cleanString(event?.detail, 4000) || null
  })).filter((event) => event.eventId && event.timestamp && event.type) : [];

  if (!valid.length) return;

  const params = [];
  const tuples = valid.map((event, index) => {
    const base = index * 6;
    params.push(event.eventId, sessionId, event.timestamp, event.type, event.qid, event.detail);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  await sql.query(
    `INSERT INTO integrity_events (
       event_id, session_id, occurred_at, event_type, question_id, detail
     ) VALUES ${tuples.join(',')}
     ON CONFLICT (event_id) DO NOTHING`,
    params
  );
}
