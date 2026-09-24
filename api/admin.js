import {
  cleanString,
  createSessionId,
  EMAIL_RE,
  getOrCreateCandidate,
  getSql,
  verifyAdminCode
} from './_db.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let sql;
  try {
    sql = getSql();
  } catch (error) {
    return json(res, 503, {
      ok: false,
      configured: false,
      storage: 'Neon PostgreSQL',
      error: error.message
    });
  }

  if (req.method === 'GET') {
    try {
      const [health] = await sql`
        SELECT
          current_database() AS database_name,
          NOW() AS checked_at,
          to_regclass('public.candidates') IS NOT NULL AS has_candidates,
          to_regclass('public.assessment_sessions') IS NOT NULL AS has_sessions,
          to_regclass('public.assessment_answers') IS NOT NULL AS has_answers,
          to_regclass('public.integrity_events') IS NOT NULL AS has_events
      `;

      const diagnosticsRequested = String(req.query?.diagnostics || '') === '1';
      let diagnostics = null;
      if (diagnosticsRequested) {
        const columns = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'assessment_sessions'
          ORDER BY ordinal_position
        `;
        const constraints = await sql`
          SELECT
            conname AS name,
            pg_get_constraintdef(oid) AS definition
          FROM pg_constraint
          WHERE conrelid = 'public.assessment_sessions'::regclass
          ORDER BY conname
        `;
        diagnostics = { columns, constraints };
      }

      const schemaReady = Boolean(
        health?.has_candidates &&
        health?.has_sessions &&
        health?.has_answers &&
        health?.has_events
      );

      return json(res, schemaReady ? 200 : 503, {
        ok: schemaReady,
        configured: true,
        storage: 'Neon PostgreSQL',
        database: health?.database_name || null,
        schemaReady,
        tables: {
          candidates: Boolean(health?.has_candidates),
          assessment_sessions: Boolean(health?.has_sessions),
          assessment_answers: Boolean(health?.has_answers),
          integrity_events: Boolean(health?.has_events)
        },
        ...(diagnosticsRequested ? { diagnostics } : {})
      });
    } catch (error) {
      console.error('Neon admin health failed', error);
      return json(res, 503, { ok: false, configured: true, error: 'Database connection failed' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const code = req.headers['x-admin-code'];
  if (!verifyAdminCode(Array.isArray(code) ? code[0] : code || '')) {
    return json(res, 401, { ok: false, error: 'Código administrativo incorrecto' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = cleanString(body.action, 40);

    if (action === 'list') {
      const rows = await sql`
        SELECT
          s.session_id,
          s.status,
          s.version,
          s.started_at,
          s.submitted_at,
          s.elapsed_seconds,
          s.copy_count,
          s.paste_count,
          s.cut_count,
          s.hidden_count,
          s.blur_count,
          s.fullscreen_exit_count,
          s.updated_at,
          c.id AS candidate_id,
          c.name AS candidate_name,
          c.email AS candidate_email,
          (
            SELECT COUNT(*)::int
            FROM assessment_answers a
            WHERE a.session_id = s.session_id
              AND a.question_id ~ '^q([1-9]|1[0-4])$'
          ) AS technical_answer_count,
          (
            SELECT COUNT(*)::int
            FROM assessment_answers a
            WHERE a.session_id = s.session_id
              AND a.question_id ~ '^ws([1-9]|[12][0-9]|30)$'
          ) AS work_style_answer_count
        FROM assessment_sessions s
        JOIN candidates c ON c.id = s.candidate_id
        WHERE s.version = 'RESET-SWE-V1'
        ORDER BY s.updated_at DESC
        LIMIT 250
      `;

      return json(res, 200, {
        ok: true,
        assessments: rows
      });
    }

    if (action === 'create_invite') {
      const candidateName = cleanString(body.candidateName, 150);
      const candidateEmail = cleanString(body.candidateEmail, 200).toLowerCase();

      if (!candidateName || !EMAIL_RE.test(candidateEmail)) {
        return json(res, 400, { ok: false, error: 'Nombre o correo inválido' });
      }

      const candidateId = await getOrCreateCandidate(sql, candidateName, candidateEmail);
      const sessionId = createSessionId();
      const version = 'RESET-SWE-V1';

      await sql`
        INSERT INTO assessment_sessions (
          session_id, candidate_id, version, status,
          started_at, elapsed_seconds,
          copy_count, paste_count, cut_count, hidden_count, blur_count, fullscreen_exit_count,
          browser, updated_at
        ) VALUES (
          ${sessionId}, ${candidateId}, ${version}, 'invited',
          NOW(), 0,
          0, 0, 0, 0, 0, 0,
          '{}'::jsonb, NOW()
        )
      `;

      return json(res, 200, {
        ok: true,
        token: sessionId,
        candidate: {
          id: candidateId,
          name: candidateName,
          email: candidateEmail
        }
      });
    }

    if (action === 'detail') {
      const sessionId = cleanString(body.sessionId, 150);
      if (!sessionId) return json(res, 400, { ok: false, error: 'sessionId requerido' });

      const sessions = await sql`
        SELECT
          s.*,
          c.name AS candidate_name,
          c.email AS candidate_email
        FROM assessment_sessions s
        JOIN candidates c ON c.id = s.candidate_id
        WHERE s.session_id = ${sessionId}
        LIMIT 1
      `;

      if (!sessions[0]) return json(res, 404, { ok: false, error: 'Evaluación no encontrada' });

      const answers = await sql`
        SELECT question_id, answer, recorded_at
        FROM assessment_answers
        WHERE session_id = ${sessionId}
        ORDER BY recorded_at ASC
      `;

      const events = await sql`
        SELECT event_id, occurred_at, event_type, question_id, detail
        FROM integrity_events
        WHERE session_id = ${sessionId}
        ORDER BY occurred_at ASC
        LIMIT 1000
      `;

      return json(res, 200, {
        ok: true,
        assessment: sessions[0],
        answers,
        events
      });
    }

    return json(res, 400, { ok: false, error: 'Acción administrativa inválida' });
  } catch (error) {
    console.error('Neon admin API error', { code: error?.code, message: error?.message });
    return json(res, 500, { ok: false, error: 'No se pudo completar la operación administrativa' });
  }
}
