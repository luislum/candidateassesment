/**
 * RESET Assessment Backend - Google Apps Script
 *
 * Instalación:
 * 1) Crear un Google Sheet.
 * 2) Extensions > Apps Script.
 * 3) Pegar este archivo completo.
 * 4) Ejecutar setup() UNA VEZ desde el editor y autorizar.
 * 5) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 6) Copiar la URL terminada en /exec y pegarla en CONFIG.endpoint del index.html.
 */

const TAB_SESSIONS = 'Sessions';
const TAB_ANSWERS = 'Answers';
const TAB_EVENTS = 'Events';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Ejecuta setup() desde un Apps Script vinculado al Google Sheet.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  ensureSheet_(ss, TAB_SESSIONS, [
    'Session_ID','Version','Candidate_Name','Candidate_Email','Status',
    'Started_At','Last_Seen_At','Submitted_At','Elapsed_Seconds',
    'Copy_Count','Paste_Count','Cut_Count','Hidden_Count','Blur_Count','Fullscreen_Exit_Count',
    'Integrity_Event_Count','Objective_Score','Objective_Max',
    'Browser_Language','Browser_Timezone','Screen','User_Agent'
  ]);

  ensureSheet_(ss, TAB_ANSWERS, [
    'Session_ID','Candidate_Email','Question_ID','Answer','Recorded_At'
  ]);

  ensureSheet_(ss, TAB_EVENTS, [
    'Event_ID','Session_ID','Candidate_Email','Timestamp','Type','Question_ID','Detail'
  ]);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ok:true, service:'RESET Assessment Backend'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const p = JSON.parse(raw || '{}');

    validatePayload_(p);

    const ss = openSpreadsheet_();
    ensureReady_(ss);

    upsertSession_(ss, p);
    appendUniqueEvents_(ss, p);

    if (p.action === 'submit') {
      replaceAnswers_(ss, p);
    }

    return json_({ok:true, action:p.action, sessionId:p.sessionId});
  } catch (err) {
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function validatePayload_(p) {
  if (!p || !p.sessionId) throw new Error('sessionId requerido');
  if (!p.action) throw new Error('action requerido');
  if (!p.candidate || !p.candidate.email) throw new Error('candidate.email requerido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.candidate.email))) throw new Error('email inválido');
  if (String(p.sessionId).length > 120) throw new Error('sessionId inválido');
}

function openSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Ejecuta setup() una vez antes de desplegar.');
  return SpreadsheetApp.openById(id);
}

function ensureReady_(ss) {
  ensureSheet_(ss, TAB_SESSIONS, [
    'Session_ID','Version','Candidate_Name','Candidate_Email','Status',
    'Started_At','Last_Seen_At','Submitted_At','Elapsed_Seconds',
    'Copy_Count','Paste_Count','Cut_Count','Hidden_Count','Blur_Count','Fullscreen_Exit_Count',
    'Integrity_Event_Count','Objective_Score','Objective_Max',
    'Browser_Language','Browser_Timezone','Screen','User_Agent'
  ]);
  ensureSheet_(ss, TAB_ANSWERS, ['Session_ID','Candidate_Email','Question_ID','Answer','Recorded_At']);
  ensureSheet_(ss, TAB_EVENTS, ['Event_ID','Session_ID','Candidate_Email','Timestamp','Type','Question_ID','Detail']);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
  }
  return sh;
}

function upsertSession_(ss, p) {
  const sh = ss.getSheetByName(TAB_SESSIONS);
  const row = findRowByValue_(sh, 1, p.sessionId);
  const c = p.counters || {};
  const b = p.browser || {};
  const objective = scoreObjective_(p.answers || {});
  const submitted = p.action === 'submit';

  const values = [
    p.sessionId,
    p.version || '',
    safe_(p.candidate && p.candidate.name),
    safe_(p.candidate && p.candidate.email),
    submitted ? 'SUBMITTED' : 'IN_PROGRESS',
    p.startedAt || '',
    p.sentAt || new Date().toISOString(),
    submitted ? (p.sentAt || new Date().toISOString()) : '',
    Number(p.elapsedSeconds || 0),
    Number(c.copy || 0),
    Number(c.paste || 0),
    Number(c.cut || 0),
    Number(c.hidden || 0),
    Number(c.blur || 0),
    Number(c.fullscreen_exit || 0),
    Number(c.copy || 0) + Number(c.paste || 0) + Number(c.cut || 0) + Number(c.hidden || 0) + Number(c.blur || 0) + Number(c.fullscreen_exit || 0),
    objective.score,
    objective.max,
    safe_(b.language),
    safe_(b.timezone),
    safe_(b.screen),
    safe_(b.userAgent)
  ];

  if (row) sh.getRange(row,1,1,values.length).setValues([values]);
  else sh.appendRow(values);
}

function scoreObjective_(answers) {
  let score = 0;
  const max = 4;
  if (String(answers.q1 || '') === 'B') score += 4;
  return {score, max};
}

function appendUniqueEvents_(ss, p) {
  const events = Array.isArray(p.events) ? p.events : [];
  if (!events.length) return;

  const sh = ss.getSheetByName(TAB_EVENTS);
  const existing = new Set();
  const last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2,1,last-1,1).getValues().flat().forEach(v => existing.add(String(v)));
  }

  const rows = [];
  events.forEach(ev => {
    const id = safe_(ev.eventId);
    if (!id || existing.has(id)) return;
    rows.push([
      id,
      p.sessionId,
      safe_(p.candidate && p.candidate.email),
      safe_(ev.timestamp),
      safe_(ev.type),
      safe_(ev.qid),
      safe_(ev.detail)
    ]);
    existing.add(id);
  });

  if (rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
}

function replaceAnswers_(ss, p) {
  const sh = ss.getSheetByName(TAB_ANSWERS);

  for (let r = sh.getLastRow(); r >= 2; r--) {
    if (String(sh.getRange(r,1).getValue()) === String(p.sessionId)) sh.deleteRow(r);
  }

  const answers = p.answers || {};
  const rows = Object.keys(answers).sort(naturalQSort_).map(qid => [
    p.sessionId,
    safe_(p.candidate && p.candidate.email),
    qid,
    safeLong_(answers[qid]),
    p.sentAt || new Date().toISOString()
  ]);

  if (rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
}

function naturalQSort_(a,b) {
  return Number(String(a).replace(/\D/g,'')) - Number(String(b).replace(/\D/g,''));
}

function findRowByValue_(sh, col, value) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2,col,last-1,1).getValues();
  for (let i=0;i<vals.length;i++) {
    if (String(vals[i][0]) === String(value)) return i+2;
  }
  return 0;
}

function safe_(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.slice(0, 1000);
}

function safeLong_(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.slice(0, 30000);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
