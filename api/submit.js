/**
 * RESET Candidate Assessment - Vercel serverless proxy
 *
 * Required Vercel Environment Variables:
 * APPS_SCRIPT_URL
 * ASSESSMENT_SHARED_SECRET
 */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  const sharedSecret = process.env.ASSESSMENT_SHARED_SECRET;
  const configured = Boolean(appsScriptUrl && sharedSecret);

  if (req.method === "GET") {
    return res.status(configured ? 200 : 503).json({
      ok: configured,
      configured,
      service: "RESET Assessment Proxy",
      error: configured ? undefined : "Backend environment variables are not configured"
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!configured) {
    return res.status(503).json({ ok: false, error: "Backend not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const rawSize = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (rawSize > 250000) {
      return res.status(413).json({ ok: false, error: "Payload too large" });
    }

    if (!body.sessionId || !body.action || !body.candidate || !body.candidate.email) {
      return res.status(400).json({ ok: false, error: "Invalid assessment payload" });
    }

    const forwarded = {
      ...body,
      _proxySecret: sharedSecret
    };

    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(forwarded)
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Apps Script returned non-JSON response", {
        status: upstream.status,
        contentType: upstream.headers.get("content-type"),
        preview: text.slice(0, 180)
      });
      return res.status(502).json({
        ok: false,
        code: "UPSTREAM_NOT_JSON",
        error: "Google Apps Script no devolvió una respuesta válida. Verifica que el Web App esté desplegado con acceso anónimo y con la versión actual."
      });
    }

    if (!upstream.ok || data.ok !== true) {
      console.error("Apps Script rejected assessment payload", {
        status: upstream.status,
        error: data.error || null
      });
      return res.status(502).json({
        ok: false,
        code: "UPSTREAM_REJECTED",
        error: data.error || `Storage backend returned HTTP ${upstream.status}`
      });
    }

    return res.status(200).json({
      ok: true,
      action: data.action,
      sessionId: data.sessionId
    });
  } catch (error) {
    console.error("Assessment proxy error:", error);
    return res.status(500).json({ ok: false, error: "Unable to save assessment" });
  }
};
