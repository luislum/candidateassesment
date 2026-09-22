const { neon } = require("@neondatabase/serverless");

const ALLOWED_ACTIONS = new Set(["session_start", "checkpoint", "submit"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value, max = 1000) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

function safeInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function safeIso(value, fallback = null) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function getStatus(action) {
  if (action === "submit") return "submitted";
  if (action === "session_start") return "started";
  return "in_progress";
}

async function getOrCreateCandidate(sql, body) {
  const name = cleanString(body.candidate?.name, 150) || "Candidate";
  const email = cleanString(body.candidate?.email, 200).toLowerCase();
  const zohoCandidateId = cleanString(body.zohoCandidateId || body.candidateId, 100) || null;

  let rows = await sql`
    SELECT id
    FROM candidates
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;

  if (rows[0]) {
    await sql`
      UPDATE candidates
      SET name = ${name},
          zoho_candidate_id = COALESCE(${zohoCandidateId}, zoho_candidate_id),
          updated_at = NOW()
      WHERE id = ${rows[0].id}
    `;
    return rows[0].id;
  }

  try {
    rows = await sql`
      INSERT INTO candidates (zoho_candidate_id, name, email)
      VALUES (${zohoCandidateId}, ${name}, ${email})
      RETURNING id
    `;
    return rows[0].id;
  } catch (error) {
    if (error && error.code === "23505") {
      rows = await sql`
        SELECT id
        FROM candidates
        WHERE LOWER(email) = LOWER(${email})
        LIMIT 1
      `;
      if (rows[0]) return rows[0].id;
    }
    throw error;
  }
}

async function upsertSession(sql, body, candidateId) {
  const action = body.action;
  const status = getStatus(action);
  const counters = body.counters || {};
  const startedAt = safeIso(body.startedAt, new Date().toISOString());
  const sentAt = safeIso(body.sentAt, new Date().toISOString());
  const submittedAt = action === "submit" ? sentAt : null;
  const browserJson = JSON.stringify(body.browser || {});
  const zohoJobId = cleanString(body.zohoJobId || body.jobId, 100) || null;
  const version = cleanString(body.version, 80) || "unknown";

  await sql`
    INSERT INTO assessment_sessions (
      session_id, candidate_id, zoho_job_id, version, status,
      started_at, submitted_at, elapsed_seconds,
      copy_count, paste_count, cut_count, hidden_count, blur_count, fullscreen_exit_count,
      browser, updated_at
    ) VALUES (
      ${body.sessionId}, ${candidateId}, ${zohoJobId}, ${version}, ${status},
      ${startedAt}, ${submittedAt}, ${safeInteger(body.elapsedSeconds)},
      ${safeInteger(counters.copy)}, ${safeInteger(counters.paste)}, ${safeInteger(counters.cut)},
      ${safeInteger(counters.hidden)}, ${safeInteger(counters.blur)}, ${safeInteger(counters.fullscreen_exit)},
      ${browserJson}::jsonb, NOW()
    )
    ON CONFLICT (session_id) DO UPDATE SET
      candidate_id = EXCLUDED.candidate_id,
      zoho_job_id = COALESCE(EXCLUDED.zoho_job_id, assessment_sessions.zoho_job_id),
      version = EXCLUDED.version,
      status = CASE
        WHEN assessment_sessions.status = 'submitted' THEN 'submitted'
        ELSE EXCLUDED.status
      END,
      submitted_at = COALESCE(assessment_sessions.submitted_at, EXCLUDED.submitted_at),
      elapsed_seconds = GREATEST(assessment_sessions.elapsed_seconds, EXCLUDED.elapsed_seconds),
      copy_count = EXCLUDED.copy_count,
      paste_count = EXCLUDED.paste_count,
      cut_count = EXCLUDED.cut_count,
      hidden_count = EXCLUDED.hidden_count,
      blur_count = EXCLUDED.blur_count,
      fullscreen_exit_count = EXCLUDED.fullscreen_exit_count,
      browser = EXCLUDED.browser,
      updated_at = NOW()
  `;
}

async function upsertAnswers(sql, body) {
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  const entries = Object.entries(answers)
    .filter(([qid]) => /^q(?:[1-9]|1[0-4])$/.test(qid))
    .map(([qid, answer]) => [qid, String(answer ?? "").slice(0, 50000)]);

  if (!entries.length) return;

  const params = [];
  const tuples = entries.map(([qid, answer], index) => {
    const base = index * 3;
    params.push(body.sessionId, qid, answer);
    return `($${base + 1}, $${base + 2}, $${base + 3}, NOW())`;
  });

  const query = `
    INSERT INTO assessment_answers (session_id, question_id, answer, recorded_at)
    VALUES ${tuples.join(",")}
    ON CONFLICT (session_id, question_id) DO UPDATE SET
      answer = EXCLUDED.answer,
      recorded_at = NOW()
  `;

  await sql.query(query, params);
}

async function insertEvents(sql, body) {
  const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
  const valid = events
    .map((event) => ({
      eventId: cleanString(event?.eventId, 150),
      timestamp: safeIso(event?.timestamp, null),
      type: cleanString(event?.type, 60),
      qid: cleanString(event?.qid, 30) || null,
      detail: cleanString(event?.detail, 4000) || null
    }))
    .filter((event) => event.eventId && event.timestamp && event.type);

  if (!valid.length) return;

  const params = [];
  const tuples = valid.map((event, index) => {
    const base = index * 6;
    params.push(
      event.eventId,
      body.sessionId,
      event.timestamp,
      event.type,
      event.qid,
      event.detail
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const query = `
    INSERT INTO integrity_events (
      event_id, session_id, occurred_at, event_type, question_id, detail
    ) VALUES ${tuples.join(",")}
    ON CONFLICT (event_id) DO NOTHING
  `;

  await sql.query(query, params);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(503).json({
      ok: false,
      configured: false,
      service: "RESET Assessment API",
      storage: "Neon PostgreSQL",
      error: "DATABASE_URL is not configured"
    });
  }

  const sql = neon(databaseUrl);

  if (req.method === "GET") {
    try {
      const [health] = await sql`
        SELECT current_database() AS database_name, NOW() AS checked_at
      `;
      return res.status(200).json({
        ok: true,
        configured: true,
        service: "RESET Assessment API",
        storage: "Neon PostgreSQL",
        database: health?.database_name || null
      });
    } catch (error) {
      console.error("Neon health check failed", error);
      return res.status(503).json({
        ok: false,
        configured: true,
        service: "RESET Assessment API",
        storage: "Neon PostgreSQL",
        error: "Database connection failed"
      });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const rawSize = Buffer.byteLength(JSON.stringify(body), "utf8");

    if (rawSize > 250000) {
      return res.status(413).json({ ok: false, error: "Payload too large" });
    }

    const sessionId = cleanString(body.sessionId, 150);
    const action = cleanString(body.action, 40);
    const email = cleanString(body.candidate?.email, 200).toLowerCase();
    const name = cleanString(body.candidate?.name, 150);

    if (!sessionId || !ALLOWED_ACTIONS.has(action) || !name || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid assessment payload" });
    }

    body.sessionId = sessionId;
    body.action = action;
    body.candidate = { name, email };

    const candidateId = await getOrCreateCandidate(sql, body);
    await upsertSession(sql, body, candidateId);
    await upsertAnswers(sql, body);
    await insertEvents(sql, body);

    return res.status(200).json({
      ok: true,
      action,
      sessionId,
      stored: true
    });
  } catch (error) {
    console.error("Assessment Neon storage error", {
      code: error?.code,
      message: error?.message
    });
    return res.status(500).json({
      ok: false,
      error: "Unable to save assessment"
    });
  }
};
