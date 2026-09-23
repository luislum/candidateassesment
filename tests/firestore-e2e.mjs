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
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const projectId = 'reset-candidate-assessment-e2e';
const rules = fs.readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules }
});

try {
  const adminDb = testEnv.authenticatedContext('admin-luis', {
    email: 'l.lum@reset-corp.com',
    email_verified: true
  }).firestore();

  const candidateDb = testEnv.unauthenticatedContext().firestore();

  const token = 'inv_e2e_candidate_001';
  const candidateId = 'cand_e2e_candidate_reset_corp_com';
  const sessionId = 'sess_e2e_candidate_001';
  const workStyleId = `ws_${sessionId}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Admin creates candidate + invitation.
  await assertSucceeds(setDoc(doc(adminDb, 'candidates', candidateId), {
    id: candidateId,
    name: 'E2E Candidate',
    email: 'e2e.candidate@reset-corp.com',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }));

  await assertSucceeds(setDoc(doc(adminDb, 'invitations', token), {
    id: token,
    candidateId,
    candidateName: 'E2E Candidate',
    candidateEmail: 'e2e.candidate@reset-corp.com',
    variant: 'A',
    status: 'pending',
    expiresAt,
    createdAt: now.toISOString()
  }));

  // 2. Candidate can resolve the generated invitation link/token.
  const inviteSnap = await assertSucceeds(getDoc(doc(candidateDb, 'invitations', token)));
  if (!inviteSnap.exists()) throw new Error('Invitation was not readable by candidate');

  // 3. Candidate starts the assessment atomically, mirroring production.
  const startBatch = writeBatch(candidateDb);
  startBatch.set(doc(candidateDb, 'candidates', candidateId), {
    id: candidateId,
    name: 'E2E Candidate',
    email: 'e2e.candidate@reset-corp.com',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }, { merge: true });

  startBatch.set(doc(candidateDb, 'assessment_sessions', sessionId), {
    sessionId,
    candidateId,
    invitationId: token,
    variant: 'A',
    status: 'started',
    version: 'RESET-V2',
    startedAt: now.toISOString(),
    elapsedSeconds: 0,
    copyCount: 0,
    pasteCount: 0,
    cutCount: 0,
    hiddenCount: 0,
    blurCount: 0,
    fullscreenExitCount: 0,
    browser: {
      userAgent: 'E2E Test',
      language: 'es',
      timezone: 'America/Panama',
      screen: '1920x1080'
    },
    updatedAt: now.toISOString()
  }, { merge: true });

  startBatch.update(doc(candidateDb, 'invitations', token), {
    status: 'in_progress',
    usedAt: now.toISOString()
  });
  await assertSucceeds(startBatch.commit());

  // 4. Candidate autosaves a response.
  await assertSucceeds(setDoc(doc(candidateDb, 'assessment_answers', `${sessionId}_q1`), {
    id: `${sessionId}_q1`,
    sessionId,
    questionId: 'q1',
    answer: 'B',
    recordedAt: now.toISOString()
  }, { merge: true }));

  // 5. Security invariant: candidate cannot self-assign objectiveScore.
  await assertFails(setDoc(doc(candidateDb, 'assessment_sessions', sessionId), {
    status: 'submitted',
    submittedAt: now.toISOString(),
    elapsedSeconds: 120,
    objectiveScore: 4,
    evaluationStatus: 'pending_review',
    updatedAt: now.toISOString()
  }, { merge: true }));

  // 6. Part 1 final submission: session + q1-q14 commit atomically.
  const part1Batch = writeBatch(candidateDb);
  part1Batch.set(doc(candidateDb, 'assessment_sessions', sessionId), {
    status: 'submitted',
    submittedAt: now.toISOString(),
    elapsedSeconds: 120,
    evaluationStatus: 'pending_review',
    copyCount: 0,
    pasteCount: 0,
    cutCount: 0,
    hiddenCount: 0,
    blurCount: 0,
    fullscreenExitCount: 0,
    updatedAt: now.toISOString()
  }, { merge: true });

  for (let i = 1; i <= 14; i += 1) {
    const qid = `q${i}`;
    const answerId = `${sessionId}_${qid}`;
    part1Batch.set(doc(candidateDb, 'assessment_answers', answerId), {
      id: answerId,
      sessionId,
      questionId: qid,
      answer: i === 1 ? 'B' : `E2E answer ${i}`,
      recordedAt: now.toISOString()
    }, { merge: true });
  }
  await assertSucceeds(part1Batch.commit());

  // 7. Part 2 final submission + invitation completion commit atomically.
  const responses = {};
  for (let i = 1; i <= 30; i += 1) responses[i] = ((i - 1) % 5) + 1;

  const part2Batch = writeBatch(candidateDb);
  part2Batch.set(doc(candidateDb, 'work_style_assessments', workStyleId), {
    id: workStyleId,
    candidateId,
    sessionId,
    invitationId: token,
    startedAt: now.toISOString(),
    submittedAt: now.toISOString(),
    elapsedSeconds: 420,
    assessmentVersion: 'RESET-WORK-STYLE-V1',
    responses,
    dimensionScores: {},
    consistencyFlags: [],
    completed: true
  });
  part2Batch.update(doc(candidateDb, 'invitations', token), {
    status: 'completed',
    usedAt: now.toISOString()
  });
  await assertSucceeds(part2Batch.commit());

  // 8. Candidate cannot list the database.
  await assertFails(getDocs(collection(candidateDb, 'assessment_answers')));

  // 9. Admin sees the complete result.
  const adminInvite = await assertSucceeds(getDoc(doc(adminDb, 'invitations', token)));
  if (adminInvite.data()?.status !== 'completed') {
    throw new Error('Invitation did not finish as completed');
  }

  const adminSession = await assertSucceeds(getDoc(doc(adminDb, 'assessment_sessions', sessionId)));
  if (adminSession.data()?.status !== 'submitted') {
    throw new Error('Technical session did not finish as submitted');
  }

  const answers = await assertSucceeds(getDocs(collection(adminDb, 'assessment_answers')));
  const sessionAnswers = answers.docs.filter((d) => d.data().sessionId === sessionId);
  if (sessionAnswers.length !== 14) {
    throw new Error(`Expected 14 technical answers, found ${sessionAnswers.length}`);
  }

  const workStyle = await assertSucceeds(getDoc(doc(adminDb, 'work_style_assessments', workStyleId)));
  if (!workStyle.exists() || workStyle.data()?.completed !== true) {
    throw new Error('Work-style assessment was not saved as completed');
  }

  console.log('E2E PASS: invitation -> session -> 14 answers -> work style -> completed -> admin review');
} finally {
  await testEnv.cleanup();
}
