# Security Specification & Test Protocol

## 1. Data Invariants

1. **Candidate Privacy & PII**: Only authorized administrators can browse candidate lists and view submitted assessments. Candidates access their own test through their unique token.
2. **Invitation Expiration & Single-Use**: Invitations cannot be reused once completed, and cannot be started after the expiration timestamp.
3. **Session Timing & Immutable Timestamps**: Assessment start time (`startedAt`) and ID are immutable. Submissions cannot exceed the allowed duration.
4. **Integrity Event Immutability**: Integrity events (copy, paste, blur, fullscreen exit) are append-only and cannot be altered or deleted.
5. **Score Protection**: Candidates are mathematically prevented from writing or modifying `totalScore`, `objectiveScore`, `manualScore`, `autoScore`, or evaluation feedback.
6. **Work Style Separation**: Work style responses and dimensions (0–100) are stored in their dedicated collection without clinical labels.
7. **Admin Privilege Enforcement**: Administrative actions (viewing all sessions, generating invites, scoring open questions) require authenticated admin credentials matching the admin email (`l.lum@reset-corp.com`) or entry in `/admins/`.

## 2. The Dirty Dozen Malicious Payloads

1. **Self-Score Injection**: Unauthenticated candidate sends `totalScore: 100, manualScore: 100` in `assessment_sessions`. (Denied)
2. **Expired Invitation Exploitation**: Request to start test using an invitation whose `expiresAt` < current time. (Denied)
3. **Ghost Field Poisoning**: Inserting unexpected fields like `isAdmin: true` into candidate or session document. (Denied)
4. **Session Hijacking**: Candidate A attempting to update Candidate B's answers. (Denied)
5. **Answer Score Tampering**: Candidate trying to write `autoScore: 20` directly on question 12 in `assessment_answers`. (Denied)
6. **Event Log Deletion**: Candidate trying to delete recorded `blur` or `paste` events from `integrity_events`. (Denied)
7. **Timestamp Spoofing**: Overwriting `startedAt` with a future or past timestamp to bypass the 50-minute timer. (Denied)
8. **Admin Collection Self-Provisioning**: Unauthenticated or unauthorized user creating a document in `/admins/`. (Denied)
9. **Oversized String / DoW Attack**: Candidate sending a 5MB payload in question answer to exhaust storage quota. (Denied by string size limit).
10. **Re-submission After Completion**: Candidate attempting to update answers after status is `'submitted'`. (Denied by terminal state lock).
11. **Negative Score Injection**: Malicious input setting negative values or invalid types for dimension scores. (Denied).
12. **Unauthorized Candidate List Scraping**: Anonymous client attempting to list all documents in `/candidates`. (Denied).
