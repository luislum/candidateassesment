import {
  cleanString,
  createSessionId,
  EMAIL_RE,
  getOrCreateCandidate,
  getSql
} from './_db.js';

const ONE_TIME_KEY = 'T7cfZaZuH_TL0JnaE-gfrY3OEa6E3X78hfQ3cYCUAQg';
const BATCH_ID = 'invite-batch-2026-09-24-01';

function json(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const key = cleanString(req.query?.key, 200);
  if (key !== ONE_TIME_KEY) {
    return json(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const candidateName = cleanString(req.query?.name, 150);
  const candidateEmail = cleanString(req.query?.email, 200).toLowerCase();
  if (!candidateName || !EMAIL_RE.test(candidateEmail)) {
    return json(res, 400, { ok: false, error: 'Nombre o correo inválido' });
  }

  try {
    const sql = getSql();
    const candidateId = await getOrCreateCandidate(sql, candidateName, candidateEmail);

    const existing = await sql`
      SELECT s.session_id
      FROM assessment_sessions s
      WHERE s.candidate_id = ${candidateId}
        AND s.version = 'RESET-SWE-V1'
        AND COALESCE(s.browser->>'prestart', 'false') = 'true'
        AND COALESCE(s.browser->>'batch', '') = ${BATCH_ID}
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    let sessionId = existing[0]?.session_id || null;
    let created = false;

    if (!sessionId) {
      sessionId = createSessionId();
      await sql`
        INSERT INTO assessment_sessions (
          session_id, candidate_id, version, status,
          started_at, elapsed_seconds,
          copy_count, paste_count, cut_count, hidden_count, blur_count, fullscreen_exit_count,
          browser, updated_at
        ) VALUES (
          ${sessionId}, ${candidateId}, 'RESET-SWE-V1', 'started',
          NOW(), 0,
          0, 0, 0, 0, 0, 0,
          jsonb_build_object('prestart', true, 'batch', ${BATCH_ID}), NOW()
        )
      `;
      created = true;
    }

    const verify = await sql`
      SELECT
        s.session_id,
        CASE
          WHEN s.status = 'submitted' THEN 'completed'
          WHEN COALESCE(s.browser->>'technical_submitted', 'false') = 'true' THEN 'technical_submitted'
          WHEN COALESCE(s.browser->>'prestart', 'false') = 'true' THEN 'invited'
          ELSE s.status
        END AS status,
        c.name AS candidate_name,
        c.email AS candidate_email,
        s.version
      FROM assessment_sessions s
      JOIN candidates c ON c.id = s.candidate_id
      WHERE s.session_id = ${sessionId}
      LIMIT 1
    `;

    return json(res, 200, {
      ok: true,
      created,
      token: sessionId,
      assessment: verify[0] || null
    });
  } catch (error) {
    console.error('Temporary batch invite failed', { code: error?.code, message: error?.message });
    return json(res, 500, { ok: false, error: 'Batch invite failed' });
  }
}
