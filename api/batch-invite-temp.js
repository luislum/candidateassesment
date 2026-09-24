import {
  cleanString,
  createSessionId,
  EMAIL_RE,
  getOrCreateCandidate,
  getSql
} from './_db.js';
import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt
} from 'node:crypto';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function decodeB64Url(value) {
  return Buffer.from(value, 'base64url');
}

function decryptPayload(privateKeyPem, payload) {
  const envelope = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    decodeB64Url(envelope.ek)
  );

  const decipher = createDecipheriv(
    'aes-256-gcm',
    aesKey,
    decodeB64Url(envelope.iv)
  );
  decipher.setAuthTag(decodeB64Url(envelope.tag));

  const plaintext = Buffer.concat([
    decipher.update(decodeB64Url(envelope.ct)),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString('utf8'));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  let sql;
  try {
    sql = getSql();
  } catch (error) {
    return json(res, 503, { ok: false, error: 'Database unavailable' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const action = cleanString(body.action, 40);
  const batchId = cleanString(body.batchId, 100);

  if (!batchId) {
    return json(res, 400, { ok: false, error: 'batchId required' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tmp_assessment_batch_keys (
        batch_id text PRIMARY KEY,
        private_key text NOT NULL,
        public_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `;

    if (action === 'init') {
      const existing = await sql`
        SELECT public_key
        FROM tmp_assessment_batch_keys
        WHERE batch_id = ${batchId}
        LIMIT 1
      `;

      if (existing[0]?.public_key) {
        return json(res, 200, {
          ok: true,
          batchId,
          responseVersion: 2,
          publicKey: Buffer.from(existing[0].public_key, 'utf8').toString('base64url')
        });
      }

      const pair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      await sql`
        INSERT INTO tmp_assessment_batch_keys (batch_id, private_key, public_key)
        VALUES (${batchId}, ${pair.privateKey}, ${pair.publicKey})
      `;

      return json(res, 200, {
        ok: true,
        batchId,
        responseVersion: 2,
        publicKey: Buffer.from(pair.publicKey, 'utf8').toString('base64url')
      });
    }

    if (action === 'run') {
      const payload = cleanString(body.payload, 100000);
      if (!payload) {
        return json(res, 400, { ok: false, error: 'payload required' });
      }

      const keys = await sql`
        SELECT private_key
        FROM tmp_assessment_batch_keys
        WHERE batch_id = ${batchId}
        LIMIT 1
      `;

      if (!keys[0]?.private_key) {
        return json(res, 404, { ok: false, error: 'batch key not found' });
      }

      const decoded = decryptPayload(keys[0].private_key, payload);
      const candidates = Array.isArray(decoded?.candidates) ? decoded.candidates : [];

      if (!candidates.length || candidates.length > 20) {
        return json(res, 400, { ok: false, error: 'invalid candidate batch' });
      }

      const results = [];

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const candidateName = cleanString(candidate?.name, 150);
        const candidateEmail = cleanString(candidate?.email, 200).toLowerCase();

        if (!candidateName || !EMAIL_RE.test(candidateEmail)) {
          results.push({
            index,
            ok: false,
            created: false,
            token: null,
            status: 'invalid',
            version: 'RESET-SWE-V1',
            matches: false
          });
          continue;
        }

        const candidateId = await getOrCreateCandidate(sql, candidateName, candidateEmail);

        const existing = await sql`
          SELECT s.session_id
          FROM assessment_sessions s
          WHERE s.candidate_id = ${candidateId}
            AND s.version = 'RESET-SWE-V1'
            AND COALESCE(s.browser->>'prestart', 'false') = 'true'
            AND COALESCE(s.browser->>'batch', '') = ${batchId}
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
              jsonb_build_object('prestart', true, 'batch', ${batchId}), NOW()
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

        const row = verify[0] || null;
        const matches = Boolean(
          row &&
          row.candidate_name === candidateName &&
          row.candidate_email === candidateEmail &&
          row.version === 'RESET-SWE-V1'
        );

        results.push({
          index,
          ok: Boolean(row) && matches,
          created,
          token: sessionId,
          status: row?.status || null,
          version: row?.version || null,
          matches
        });
      }

      return json(res, 200, { ok: true, batchId, results });
    }

    if (action === 'cleanup') {
      await sql`
        DELETE FROM tmp_assessment_batch_keys
        WHERE batch_id = ${batchId}
      `;

      const remaining = await sql`
        SELECT COUNT(*)::int AS count
        FROM tmp_assessment_batch_keys
      `;

      if ((remaining[0]?.count || 0) === 0) {
        await sql`DROP TABLE IF EXISTS tmp_assessment_batch_keys`;
      }

      return json(res, 200, { ok: true, batchId, cleaned: true });
    }

    return json(res, 400, { ok: false, error: 'invalid action' });
  } catch (error) {
    console.error('Temporary batch invite failed', {
      code: error?.code,
      message: error?.message
    });
    return json(res, 500, { ok: false, error: 'batch operation failed' });
  }
}
