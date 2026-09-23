import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appUrl = 'https://candidateassesment.vercel.app';
const probeToken = `inv_smoke_${Date.now().toString(36)}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. Production app is publicly reachable.
const home = await fetch(`${appUrl}/`, { redirect: 'follow' });
assert(home.ok, `Production home returned HTTP ${home.status}`);
const homeHtml = await home.text();
assert(
  homeHtml.includes('id="root"') || homeHtml.includes("id='root'"),
  'Production HTML does not contain the React root element'
);

// 2. Generated-token URL is routed to the SPA (the token itself is intentionally nonexistent).
const tokenPage = await fetch(`${appUrl}/?token=${encodeURIComponent(probeToken)}`, { redirect: 'follow' });
assert(tokenPage.ok, `Generated-token URL returned HTTP ${tokenPage.status}`);
const tokenHtml = await tokenPage.text();
assert(
  tokenHtml.includes('id="root"') || tokenHtml.includes("id='root'"),
  'Generated-token URL does not load the assessment SPA'
);

const key = encodeURIComponent(config.apiKey);

// 3. Firebase Auth must accept the production Vercel origin as a continue URI.
// createAuthUri is the same public Auth backend family used by Firebase Web Auth;
// a misconfigured authorized domain causes this request to be rejected.
const authUri = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${key}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'reset.assessment.smoke@example.com',
      continueUri: `${appUrl}/?admin=true`
    })
  }
);
const authBody = await authUri.json().catch(() => ({}));
assert(
  authUri.ok,
  `Firebase Auth rejected the production domain with HTTP ${authUri.status}: ${JSON.stringify(authBody).slice(0, 300)}`
);
console.log('Firebase Auth providers:', JSON.stringify({
  signinMethods: authBody.signinMethods || [],
  allProviders: authBody.allProviders || [],
  registered: authBody.registered || false
}));

const anonymousProbe = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  }
);
const anonymousBody = await anonymousProbe.json().catch(() => ({}));
console.log('Firebase Anonymous Auth probe:', JSON.stringify({
  status: anonymousProbe.status,
  enabled: anonymousProbe.ok,
  error: anonymousBody?.error?.message || null
}));

// 4. Verify the REAL Firestore database permits individual invitation lookups.
// A correctly secured nonexistent document returns 404. A 403 means production
// rules do not match the candidate link flow.
const base = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;

const getInvite = await fetch(
  `${base}/invitations/${encodeURIComponent(probeToken)}?key=${key}`
);
assert(
  getInvite.status === 404,
  `Production Firestore invitation GET expected 404 for a missing token, got HTTP ${getInvite.status}: ${(await getInvite.text()).slice(0, 300)}`
);

// 5. Anonymous candidates must NOT be able to enumerate invitations.
const listInvites = await fetch(
  `${base}/invitations?pageSize=1&key=${key}`
);
assert(
  listInvites.status === 403,
  `Production Firestore invitation LIST expected 403, got HTTP ${listInvites.status}: ${(await listInvites.text()).slice(0, 300)}`
);

console.log('PRODUCTION SMOKE PASS: Vercel app + token route + Firebase Auth domain + Firestore get/list security');
