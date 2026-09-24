import {
  cleanString,
  getSql,
  insertEvents,
  safeInteger,
  upsertAnswers
} from './_db.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

async function loadAssessment(sql, token) {
  const rows = await sql`
    SELECT
      s.session_id,
      CASE
        WHEN COALESCE(s.browser->>'prestart', 'false') = 'true' THEN 'invited'
        ELSE s.status
      END AS status,
      s.version,
      s.started_at,
      s.submitted_at,
      s.elapsed_seconds,
      s.candidate_id,
      c.name AS candidate_name,
      c.email AS candidate_email
    FROM assessment_sessions s
    JOIN candidates c ON c.id = s.candidate_id
    WHERE s.session_id = ${token}
      AND s.version = 'RESET-SWE-V1'
    LIMIT 1
  `;
  return rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let sql;
  try {
    sql = getSql();
  } catch (error) {
    return json(res, 503, { ok: false, error: 'Assessment storage is not configured' });
  }

  try {
    if (req.method === 'GET') {
      const token = cleanString(req.query?.token, 150);
      if (!token) return json(res, 400, { ok: false, error: 'Token requerido' });

      const assessment = await loadAssessment(sql, token);
      if (!assessment) return json(res, 404, { ok: false, error: 'Enlace de evaluación inválido' });

      return json(res, 200, {
        ok: true,
        assessment: {
          sessionId: assessment.session_id,
          candidateId: assessment.candidate_id,
          candidateName: assessment.candidate_name,
          candidateEmail: assessment.candidate_email,
          status: assessment.status,
          startedAt: assessment.started_at,
          submittedAt: assessment.submitted_at,
          elapsedSeconds: assessment.elapsed_seconds
        }
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const token = cleanString(body.sessionId || body.token, 150);
    const action = cleanString(body.action, 40);
    if (!token) return json(res, 400, { ok: false, error: 'sessionId requerido' });

    const assessment = await loadAssessment(sql, token);
    if (!assessment) return json(res, 404, { ok: false, error: 'Evaluación no encontrada' });

    if (assessment.status === 'completed' && action !== 'status') {
      return json(res, 409, { ok: false, error: 'Esta evaluación ya fue completada' });
    }

    const counters = body.counters || {};
    const elapsed = safeInteger(body.elapsedSeconds);

    if (action === 'session_start') {
      const browserJson = JSON.stringify(body.browser || {});
      await sql`
        UPDATE assessment_sessions
        SET
          status = 'started',
          started_at = CASE
            WHEN COALESCE(browser->>'prestart', 'false') = 'true' THEN NOW()
            ELSE started_at
          END,
          browser = ${browserJson}::jsonb,
          updated_at = NOW()
        WHERE session_id = ${token}
      `;

      return json(res, 200, { ok: true, action, sessionId: token });
    }

    if (action === 'checkpoint' || action === 'technical_submit') {
      await upsertAnswers(sql, token, body.answers || {});
      await insertEvents(sql, token, body.events || []);

      const nextStatus = action === 'technical_submit' ? 'technical_submitted' : 'in_progress';
      await sql`
        UPDATE assessment_sessions
        SET
          status = CASE WHEN status = 'completed' THEN status ELSE ${nextStatus} END,
          elapsed_seconds = GREATEST(COALESCE(elapsed_seconds, 0), ${elapsed}),
          copy_count = ${safeInteger(counters.copy)},
          paste_count = ${safeInteger(counters.paste)},
          cut_count = ${safeInteger(counters.cut)},
          hidden_count = ${safeInteger(counters.hidden)},
          blur_count = ${safeInteger(counters.blur)},
          fullscreen_exit_count = ${safeInteger(counters.fullscreen_exit)},
          updated_at = NOW()
        WHERE session_id = ${token}
      `;

      return json(res, 200, { ok: true, action, sessionId: token });
    }

    if (action === 'work_style_submit') {
      await upsertAnswers(sql, token, body.answers || {});
      await insertEvents(sql, token, body.events || []);

      await sql`
        UPDATE assessment_sessions
        SET
          status = 'completed',
          submitted_at = NOW(),
          elapsed_seconds = GREATEST(COALESCE(elapsed_seconds, 0), ${elapsed}),
          copy_count = ${safeInteger(counters.copy)},
          paste_count = ${safeInteger(counters.paste)},
          cut_count = ${safeInteger(counters.cut)},
          hidden_count = ${safeInteger(counters.hidden)},
          blur_count = ${safeInteger(counters.blur)},
          fullscreen_exit_count = ${safeInteger(counters.fullscreen_exit)},
          updated_at = NOW()
        WHERE session_id = ${token}
      `;

      return json(res, 200, { ok: true, action, sessionId: token, completed: true });
    }

    return json(res, 400, { ok: false, error: 'Acción de assessment inválida' });
  } catch (error) {
    console.error('Neon assessment API error', { code: error?.code, message: error?.message });
    return json(res, 500, { ok: false, error: 'No se pudo guardar la evaluación' });
  }
}
