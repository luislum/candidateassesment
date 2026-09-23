import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';

const projectId = 'reset-candidate-simple-flow';
const rules = fs.readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });

try {
  const db = testEnv.unauthenticatedContext().firestore();

  const candidateId = 'cand_simple_e2e';
  const sessionId = 'sess_simple_e2e';
  const now = new Date().toISOString();

  // Candidate starts from a self-contained link: no invitation document is required.
  const start = writeBatch(db);
  start.set(doc(db, 'candidates', candidateId), {
    id: candidateId,
    name: 'Simple E2E Candidate',
    email: 'simple.e2e@example.com',
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  start.set(doc(db, 'assessment_sessions', sessionId), {
    sessionId,
    candidateId,
    invitationId: 'ca1_test',
    variant: 'A',
    status: 'started',
    version: 'RESET-V2',
    startedAt: now,
    elapsedSeconds: 0,
    copyCount: 0,
    pasteCount: 0,
    cutCount: 0,
    hiddenCount: 0,
    blurCount: 0,
    fullscreenExitCount: 0,
    browser: {},
    updatedAt: now
  }, { merge: true });

  await assertSucceeds(start.commit());

  const part1 = writeBatch(db);
  part1.set(doc(db, 'assessment_sessions', sessionId), {
    status: 'submitted',
    submittedAt: now,
    elapsedSeconds: 60,
    evaluationStatus: 'pending_review',
    copyCount: 0,
    pasteCount: 0,
    cutCount: 0,
    hiddenCount: 0,
    blurCount: 0,
    fullscreenExitCount: 0,
    updatedAt: now
  }, { merge: true });

  for (let i = 1; i <= 14; i += 1) {
    const qid = `q${i}`;
    const id = `${sessionId}_${qid}`;
    part1.set(doc(db, 'assessment_answers', id), {
      id,
      sessionId,
      questionId: qid,
      answer: i === 1 ? 'B' : `Simple answer ${i}`,
      recordedAt: now
    }, { merge: true });
  }

  await assertSucceeds(part1.commit());

  const responses = {};
  for (let i = 1; i <= 30; i += 1) responses[i] = ((i - 1) % 5) + 1;

  await assertSucceeds(setDoc(doc(db, 'work_style_assessments', `ws_${sessionId}`), {
    id: `ws_${sessionId}`,
    candidateId,
    sessionId,
    invitationId: 'ca1_test',
    startedAt: now,
    submittedAt: now,
    elapsedSeconds: 120,
    assessmentVersion: 'RESET-WORK-STYLE-V1',
    responses,
    dimensionScores: {},
    consistencyFlags: [],
    completed: true
  }));

  // The simple dashboard uses only direct GETs with known IDs.
  const session = await assertSucceeds(getDoc(doc(db, 'assessment_sessions', sessionId)));
  if (!session.exists() || session.data().status !== 'submitted') throw new Error('Session was not stored');

  for (let i = 1; i <= 14; i += 1) {
    const id = `${sessionId}_q${i}`;
    const answer = await assertSucceeds(getDoc(doc(db, 'assessment_answers', id)));
    if (!answer.exists()) throw new Error(`Missing ${id}`);
  }

  const workStyle = await assertSucceeds(getDoc(doc(db, 'work_style_assessments', `ws_${sessionId}`)));
  if (!workStyle.exists() || workStyle.data().completed !== true) throw new Error('Work style missing');

  // Database enumeration remains blocked.
  await assertFails(getDocs(collection(db, 'assessment_answers')));

  console.log('SIMPLE FLOW PASS: link payload -> candidate writes -> 14 answers -> work style -> dashboard direct reads');
} finally {
  await testEnv.cleanup();
}
