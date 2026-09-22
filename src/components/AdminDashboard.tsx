import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';
import {
  TECHNICAL_QUESTIONS,
  PRACTICAL_CASE_VARIANTS,
  WORK_STYLE_DIMENSIONS,
  generateStarQuestions,
  getDimensionTendency
} from '../data/questions';
import { RadarChart } from './RadarChart';
import {
  Users,
  Link as LinkIcon,
  Shield,
  FileCheck,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Search,
  Eye,
  LogOut,
  Plus,
  RefreshCw,
  AlertTriangle,
  Award,
  BookOpen,
  Filter,
  Check,
  Lock
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenCandidateLink: (token: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenCandidateLink }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Admin Passcode fallback or Google Login
  const [adminPasscode, setAdminPasscode] = useState('');
  const [passcodeAuthenticated, setPasscodeAuthenticated] = useState(false);

  // Data lists
  const [invitations, setInvitations] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [workStyleResults, setWorkStyleResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  // Active view: 'candidates' | 'detail' | 'new_invite'
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, any>>({});
  const [selectedEvents, setSelectedEvents] = useState<any[]>([]);

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'in_progress' | 'pending'>('all');

  // New Invite Modal State
  const [showNewInviteModal, setShowNewInviteModal] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidateEmail, setNewCandidateEmail] = useState('');
  const [newVariant, setNewVariant] = useState<'A' | 'B' | 'C'>('A');
  const [newExpiryDays, setNewExpiryDays] = useState(3);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Scoring in detail view
  const [scoresInput, setScoresInput] = useState<Record<string, number>>({});
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoresSavedNotification, setScoresSavedNotification] = useState(false);

  // Monitor Auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user && (user.email === 'l.lum@reset-corp.com' || user.email?.endsWith('@reset-corp.com'))) {
        setIsSuperAdmin(true);
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  // Fetch all invitations, sessions, and work style evaluations
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Invitations
      const invSnap = await getDocs(collection(db, 'invitations'));
      const invList: any[] = [];
      invSnap.forEach((d) => invList.push({ id: d.id, ...d.data() }));
      setInvitations(invList);

      // 2. Sessions
      const sessSnap = await getDocs(collection(db, 'assessment_sessions'));
      const sessList: any[] = [];
      sessSnap.forEach((d) => sessList.push({ id: d.id, ...d.data() }));
      setSessions(sessList);

      // 3. Work Style Assessments
      const wsSnap = await getDocs(collection(db, 'work_style_assessments'));
      const wsMap: Record<string, any> = {};
      wsSnap.forEach((d) => {
        const data = d.data();
        if (data.sessionId) wsMap[data.sessionId] = data;
        if (data.invitationId) wsMap[data.invitationId] = data;
      });
      setWorkStyleResults(wsMap);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser || passcodeAuthenticated) {
      fetchData();
    }
  }, [currentUser, passcodeAuthenticated]);

  // Load detailed session answers and integrity events
  const loadSessionDetail = async (sessId: string) => {
    setSelectedSessionId(sessId);
    try {
      // Answers
      const answersSnap = await getDocs(collection(db, 'assessment_answers'));
      const answers: Record<string, any> = {};
      const initialScores: Record<string, number> = {};
      const initialFeedbacks: Record<string, string> = {};

      answersSnap.forEach((d) => {
        const data = d.data();
        if (data.sessionId === sessId) {
          answers[data.questionId] = data;
          if (data.manualScore !== undefined) initialScores[data.questionId] = data.manualScore;
          if (data.feedback) initialFeedbacks[data.questionId] = data.feedback;
        }
      });
      setSelectedAnswers(answers);
      setScoresInput(initialScores);
      setFeedbackInput(initialFeedbacks);

      // Integrity Events
      const eventsSnap = await getDocs(collection(db, 'integrity_events'));
      const evList: any[] = [];
      eventsSnap.forEach((d) => {
        const data = d.data();
        if (data.sessionId === sessId) evList.push(data);
      });
      evList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setSelectedEvents(evList);
    } catch (err) {
      console.error('Error loading session detail:', err);
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setCurrentUser(res.user);
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  // Passcode verification for direct team access
  const handlePasscodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode === 'reset2025' || adminPasscode === 'RESET-ADMIN-KEY') {
      setPasscodeAuthenticated(true);
    } else {
      alert('Código de acceso no válido.');
    }
  };

  // Create New Single-Use Invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidateName.trim() || !newCandidateEmail.trim()) {
      alert('Completa nombre y correo electrónico del candidato.');
      return;
    }

    try {
      const tokenId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      const expiresAt = new Date(Date.now() + newExpiryDays * 24 * 60 * 60 * 1000).toISOString();
      const candId = `cand_${newCandidateEmail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Save invitation in Firestore
      await setDoc(doc(db, 'invitations', tokenId), {
        id: tokenId,
        candidateId: candId,
        candidateName: newCandidateName.trim(),
        candidateEmail: newCandidateEmail.trim().toLowerCase(),
        variant: newVariant,
        status: 'pending',
        expiresAt,
        createdAt: new Date().toISOString()
      });

      // Also ensure candidate record exists
      await setDoc(doc(db, 'candidates', candId), {
        id: candId,
        name: newCandidateName.trim(),
        email: newCandidateEmail.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const link = `${window.location.origin}${window.location.pathname}?token=${tokenId}`;
      setGeneratedInviteLink(link);
      fetchData();
    } catch (err) {
      console.error('Error creating invitation:', err);
      alert('Error al generar la invitación.');
    }
  };

  // Save Manual Scores and update Session total score
  const handleSaveScores = async () => {
    if (!selectedSessionId) return;
    setSavingScores(true);

    try {
      let manualTotal = 0;

      // Update each answer document
      for (const q of TECHNICAL_QUESTIONS) {
        if (q.id === 'q1') continue; // Q1 is objective (autoScore)
        const qScore = scoresInput[q.id] || 0;
        manualTotal += qScore;
        const feedback = feedbackInput[q.id] || '';
        const answerId = `${selectedSessionId}_${q.id}`;

        await setDoc(doc(db, 'assessment_answers', answerId), {
          id: answerId,
          sessionId: selectedSessionId,
          questionId: q.id,
          manualScore: qScore,
          feedback,
          scoredAt: new Date().toISOString()
        }, { merge: true });
      }

      // Objective Q1 score
      const q1Ans = selectedAnswers['q1']?.answer || '';
      const objectiveScore = q1Ans === 'B' ? 4 : 0;
      const totalScore = objectiveScore + manualTotal;

      // Update session document
      await updateDoc(doc(db, 'assessment_sessions', selectedSessionId), {
        objectiveScore,
        manualScore: manualTotal,
        totalScore,
        evaluationStatus: 'completed',
        evaluatedAt: new Date().toISOString()
      });

      setScoresSavedNotification(true);
      setTimeout(() => setScoresSavedNotification(false), 3000);
      fetchData();
    } catch (err) {
      console.error('Error saving scores:', err);
      alert('Error al guardar las calificaciones.');
    } finally {
      setSavingScores(false);
    }
  };

  const isAccessAuthorized = currentUser !== null || passcodeAuthenticated;

  // --- LOGIN / PROTECTED SCREEN ---
  if (!isAccessAuthorized && !authChecking) {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#101721] border border-[#263241] rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-950/70 border border-blue-600/40 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-400">
              <Lock size={24} />
            </div>
            <div className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">RESET CORP</div>
            <h1 className="text-xl font-bold text-slate-100">Portal Administrativo</h1>
            <p className="text-xs text-slate-400 mt-1">Acceso restringido para el equipo de selección técnica</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-[#17202c] hover:bg-[#202c3d] border border-[#2d3a4b] text-slate-100 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-md"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Iniciar sesión con Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-[#263241] flex-1" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">o clave de equipo</span>
              <div className="h-px bg-[#263241] flex-1" />
            </div>

            <form onSubmit={handlePasscodeLogin} className="space-y-3">
              <input
                type="password"
                placeholder="Código de acceso administrativo"
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-sm transition-colors cursor-pointer"
              >
                Ingresar al Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Current session under review
  const activeSession = sessions.find((s) => s.id === selectedSessionId);
  const activeInvitation = invitations.find(
    (inv) => inv.id === activeSession?.invitationId || inv.id === activeSession?.id
  );
  const activeWorkStyle = selectedSessionId
    ? workStyleResults[selectedSessionId] ||
      (activeSession?.invitationId ? workStyleResults[activeSession.invitationId] : null)
    : null;

  return (
    <div className="min-h-screen bg-[#090d12] text-[#edf3f8]">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-30 bg-[#090d12]/95 backdrop-blur-md border-b border-[#263241] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-widest text-blue-500">RESET</span>
            <span className="text-xs bg-blue-950/60 border border-blue-800/60 text-blue-300 font-bold px-2 py-0.5 rounded-md">
              Admin Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setGeneratedInviteLink(null);
                setNewCandidateName('');
                setNewCandidateEmail('');
                setShowNewInviteModal(true);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Plus size={15} />
              <span>Generar Invitación</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 bg-[#17202c] hover:bg-[#202c3d] border border-[#2d3a4b] text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => {
                signOut(auth);
                setPasscodeAuthenticated(false);
              }}
              className="p-1.5 bg-[#17202c] hover:bg-red-950/60 hover:text-red-400 border border-[#2d3a4b] text-slate-400 rounded-lg text-xs flex items-center transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {selectedSessionId && activeSession ? (
          // ==================== CANDIDATE DETAIL REVIEW VIEW ====================
          <div className="space-y-6">
            {/* Header with back button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#263241] pb-4">
              <div>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="text-xs text-blue-400 hover:underline mb-2 flex items-center gap-1 cursor-pointer"
                >
                  ← Volver a lista de candidatos
                </button>
                <h1 className="text-2xl font-black text-slate-100">
                  {activeInvitation?.candidateName || activeSession.candidateId}
                </h1>
                <p className="text-xs text-slate-400">
                  {activeInvitation?.candidateEmail} · Caso asignado: Variante {activeSession.variant || 'A'}
                </p>
              </div>

              {/* Status and Score Badges */}
              <div className="flex items-center gap-3">
                <div className="bg-[#101721] border border-[#263241] rounded-xl px-4 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Technical Assessment
                  </div>
                  <div className="text-2xl font-black text-blue-400">
                    {activeSession.totalScore !== undefined
                      ? `${activeSession.totalScore} / 100`
                      : activeSession.objectiveScore !== undefined
                      ? `${activeSession.objectiveScore} / 100 (Parcial)`
                      : 'Sin calificar'}
                  </div>
                </div>

                <button
                  onClick={handleSaveScores}
                  disabled={savingScores}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-white text-sm rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-900/40"
                >
                  {scoresSavedNotification ? (
                    <>
                      <Check size={18} className="text-emerald-300" />
                      <span>¡Guardado!</span>
                    </>
                  ) : (
                    <>
                      <Award size={18} />
                      <span>{savingScores ? 'Guardando...' : 'Guardar Calificación'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Grid with 2 columns: Left = Work Style & Integrity, Right = Technical Questions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Work Style Profile & Integrity Audit */}
              <div className="space-y-6">
                {/* 1. Work Style Profile Card */}
                <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl space-y-5">
                  <div className="flex items-center justify-between border-b border-[#263241] pb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <BookOpen size={16} />
                      Perfil de Estilo de Trabajo
                    </h2>
                    {activeWorkStyle?.completed ? (
                      <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        Completado
                      </span>
                    ) : (
                      <span className="text-[11px] bg-amber-950 border border-amber-800 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {activeWorkStyle && activeWorkStyle.dimensionScores ? (
                    <>
                      {/* Dimension Scores Listing */}
                      <div className="space-y-2.5 text-xs">
                        {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((code) => {
                          const dim = WORK_STYLE_DIMENSIONS[code];
                          const score = activeWorkStyle.dimensionScores[code] ?? 0;
                          return (
                            <div key={code} className="bg-[#0a1017] p-2.5 rounded-xl border border-[#263241]/70">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-slate-200">{dim.name}</span>
                                <span className="font-mono font-bold text-blue-400">{score}/100</span>
                              </div>
                              <div className="w-full bg-[#17202b] h-1.5 rounded-full overflow-hidden mb-1.5">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${score}%` }} />
                              </div>
                              <p className="text-[11px] text-slate-400 leading-snug">
                                {getDimensionTendency(code, score)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Radar Chart */}
                      <div className="pt-2 border-t border-[#263241] flex flex-col items-center">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Gráfico Radar de Dimensiones
                        </div>
                        <RadarChart scores={activeWorkStyle.dimensionScores} size={300} />
                      </div>

                      {/* Response Consistency Check */}
                      <div className="pt-3 border-t border-[#263241] space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Consistencia de respuestas
                        </div>
                        {activeWorkStyle.consistencyFlags?.hasFlag ? (
                          <div className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <div>
                              <div className="font-bold">Revisar durante entrevista</div>
                              <div className="text-[11px] text-amber-300/80 mt-0.5">
                                Se detectaron patrones de respuesta (ej. valores homogéneos o contradicciones directas/inversas). Indagar con preguntas conductuales.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-900 border border-[#263241] rounded-xl p-2.5 text-xs text-slate-300">
                            Patrón de respuestas consistente y balanceado.
                          </div>
                        )}
                      </div>

                      {/* STAR Behavioral Questions Generator */}
                      <div className="pt-3 border-t border-[#263241] space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                          Preguntas Conductuales Sugeridas (Método STAR)
                        </div>
                        <div className="space-y-2">
                          {generateStarQuestions(activeWorkStyle.dimensionScores).map((star, idx) => (
                            <div key={idx} className="bg-[#0a1017] border border-[#263241] rounded-xl p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between text-slate-400 font-bold text-[10px]">
                                <span>{star.dimension}</span>
                                <span className="text-blue-400">{star.method}</span>
                              </div>
                              <p className="text-slate-200 leading-relaxed font-medium">
                                “{star.question}”
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400">
                      El candidato aún no ha completado el módulo de Estilo de Trabajo.
                    </div>
                  )}
                </div>

                {/* 2. Integrity Telemetry Audit Card */}
                <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#263241] pb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Shield size={16} />
                      Registro de Integridad
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedEvents.length} eventos
                    </span>
                  </div>

                  {/* Integrity Event Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Copy</div>
                      <div className="font-bold text-slate-200">{activeSession.copyCount ?? 0}</div>
                    </div>
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Paste</div>
                      <div className="font-bold text-slate-200">{activeSession.pasteCount ?? 0}</div>
                    </div>
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Salida Fullscreen</div>
                      <div className="font-bold text-amber-400">{activeSession.fullscreenExitCount ?? 0}</div>
                    </div>
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Pérdida Foco</div>
                      <div className="font-bold text-slate-200">{activeSession.blurCount ?? 0}</div>
                    </div>
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Pestaña Oculta</div>
                      <div className="font-bold text-slate-200">{activeSession.hiddenCount ?? 0}</div>
                    </div>
                    <div className="bg-[#0a1017] border border-[#263241] p-2 rounded-xl">
                      <div className="text-slate-400 text-[10px]">Duración</div>
                      <div className="font-bold text-blue-400">
                        {Math.floor((activeSession.elapsedSeconds || 0) / 60)} min
                      </div>
                    </div>
                  </div>

                  {/* Timeline of events */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {selectedEvents.map((ev, i) => (
                      <div
                        key={i}
                        className="bg-[#0a1017] border border-[#263241]/60 rounded-lg p-2 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ev.type === 'copy' || ev.type === 'paste'
                              ? 'bg-amber-950 text-amber-300'
                              : ev.type === 'fullscreen_exit'
                              ? 'bg-red-950 text-red-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {ev.type}
                          </span>
                          <span className="text-slate-300">{ev.detail || 'Evento registrado'}</span>
                        </div>
                        <span className="text-slate-500 font-mono">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (2 cols width): Technical Questions and Grading */}
              <div className="lg:col-span-2 space-y-6">
                {TECHNICAL_QUESTIONS.map((q) => {
                  const ansDoc = selectedAnswers[q.id];
                  const candidateAnswer = ansDoc?.answer || '';
                  const isQ1 = q.id === 'q1';
                  const isQ12 = q.id === 'q12';
                  const activeVariant = PRACTICAL_CASE_VARIANTS[activeSession.variant as 'A' | 'B' | 'C'] || PRACTICAL_CASE_VARIANTS.A;

                  return (
                    <div key={q.id} className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl space-y-4">
                      <div className="flex items-baseline justify-between border-b border-[#263241] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300">
                            {q.id.toUpperCase()}
                          </span>
                          <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                            {isQ12 ? `12. ${activeVariant.title}` : q.title}
                          </h3>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          Máx: {q.points} pts
                        </span>
                      </div>

                      {/* Question Rubric & Context */}
                      {q.rubricHint && (
                        <div className="bg-[#0a1017] border border-[#263241]/70 rounded-xl p-3 text-xs text-slate-400">
                          <strong className="text-slate-300">Rúbrica de evaluación:</strong> {q.rubricHint}
                        </div>
                      )}

                      {/* Candidate Answer Box */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Respuesta del Candidato
                        </div>
                        {candidateAnswer ? (
                          <div className="bg-[#080d13] border border-[#263241] rounded-xl p-4 text-sm text-slate-100 whitespace-pre-wrap font-sans leading-relaxed">
                            {candidateAnswer}
                          </div>
                        ) : (
                          <div className="bg-[#080d13] border border-dashed border-[#263241] rounded-xl p-4 text-xs text-slate-500 italic">
                            Sin respuesta registrada.
                          </div>
                        )}
                      </div>

                      {/* Grading Input Controls */}
                      {q.points > 0 && (
                        <div className="bg-[#0c121a] border border-[#263241] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                          {isQ1 ? (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-300 font-semibold">Calificación automática:</span>
                              <span className={`px-2.5 py-1 rounded-md font-mono font-bold ${
                                candidateAnswer === 'B'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-red-950 text-red-300 border border-red-800'
                              }`}>
                                {candidateAnswer === 'B' ? '4 / 4 pts (Correcto - B)' : '0 / 4 pts (Incorrecto)'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                                Puntos asignados:
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={q.points}
                                value={scoresInput[q.id] ?? ansDoc?.manualScore ?? 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(q.points, Number(e.target.value)));
                                  setScoresInput(prev => ({ ...prev, [q.id]: val }));
                                }}
                                className="w-20 bg-[#0a1017] border border-[#263241] rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-center text-blue-400 focus:outline-none focus:border-blue-500"
                              />
                              <span className="text-xs text-slate-400">/ {q.points} pts</span>
                            </div>
                          )}

                          {/* Feedback Input */}
                          {!isQ1 && (
                            <input
                              type="text"
                              placeholder="Comentarios o feedback técnico para esta respuesta..."
                              value={feedbackInput[q.id] ?? ansDoc?.feedback ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFeedbackInput(prev => ({ ...prev, [q.id]: val }));
                              }}
                              className="w-full sm:flex-1 bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // ==================== CANDIDATE SESSIONS LIST VIEW ====================
          <div className="space-y-6">
            {/* Search, Filter & Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold uppercase">Total Invitaciones</div>
                <div className="text-2xl font-black text-slate-100 mt-1">{invitations.length}</div>
              </div>
              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold uppercase">Sesiones Iniciadas</div>
                <div className="text-2xl font-black text-blue-400 mt-1">{sessions.length}</div>
              </div>
              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold uppercase">Entregadas</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {sessions.filter(s => s.status === 'submitted').length}
                </div>
              </div>
              <div className="bg-[#101721] border border-[#263241] rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold uppercase">Perfiles de Trabajo</div>
                <div className="text-2xl font-black text-purple-400 mt-1">
                  {Object.keys(workStyleResults).length}
                </div>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-[#101721] border border-[#263241] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por candidato o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a1017] border border-[#263241] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={15} className="text-slate-400" />
                <span className="text-xs text-slate-400 font-semibold">Estado:</span>
                {(['all', 'submitted', 'in_progress', 'pending'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#0a1017] border border-[#263241] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'all' ? 'Todos' : st === 'submitted' ? 'Entregados' : st === 'in_progress' ? 'En Curso' : 'Pendientes'}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidates Table */}
            <div className="bg-[#101721] border border-[#263241] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0a1017] border-b border-[#263241] text-slate-400 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-5 py-3.5">Candidato</th>
                      <th className="px-4 py-3.5">Variante Caso</th>
                      <th className="px-4 py-3.5">Estado</th>
                      <th className="px-4 py-3.5">Assessment Técnico</th>
                      <th className="px-4 py-3.5">Perfil Estilo Trabajo</th>
                      <th className="px-4 py-3.5">Expiración</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#263241]/60">
                    {invitations
                      .filter((inv) => {
                        const nameMatches = (inv.candidateName || '').toLowerCase().includes(searchTerm.toLowerCase());
                        const emailMatches = (inv.candidateEmail || '').toLowerCase().includes(searchTerm.toLowerCase());
                        if (searchTerm && !nameMatches && !emailMatches) return false;

                        const linkedSession = sessions.find((s) => s.invitationId === inv.id || s.id === inv.id);
                        if (statusFilter === 'submitted' && linkedSession?.status !== 'submitted') return false;
                        if (statusFilter === 'in_progress' && linkedSession?.status !== 'in_progress') return false;
                        if (statusFilter === 'pending' && linkedSession) return false;
                        return true;
                      })
                      .map((inv) => {
                        const linkedSession = sessions.find((s) => s.invitationId === inv.id || s.id === inv.id);
                        const linkedWorkStyle = workStyleResults[linkedSession?.id || ''] || workStyleResults[inv.id];
                        const isExpired = new Date(inv.expiresAt).getTime() < Date.now();

                        return (
                          <tr key={inv.id} className="hover:bg-[#141d2a] transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-100 text-sm">{inv.candidateName}</div>
                              <div className="text-slate-400 text-[11px]">{inv.candidateEmail}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-bold text-blue-400 bg-blue-950/60 border border-blue-900 px-2 py-0.5 rounded text-[11px]">
                                Variante {inv.variant || 'A'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {linkedSession?.status === 'submitted' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-900 px-2.5 py-0.5 rounded-full text-[11px]">
                                  <CheckCircle size={12} /> Entregado
                                </span>
                              ) : linkedSession?.status === 'in_progress' || linkedSession?.status === 'started' ? (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 border border-amber-900 px-2.5 py-0.5 rounded-full text-[11px]">
                                  <Clock size={12} /> En curso
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-950/60 border border-red-900 px-2.5 py-0.5 rounded-full text-[11px]">
                                  Expirado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full text-[11px]">
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {linkedSession ? (
                                <div className="font-bold text-slate-100">
                                  {linkedSession.totalScore !== undefined
                                    ? `${linkedSession.totalScore} / 100`
                                    : linkedSession.objectiveScore !== undefined
                                    ? `${linkedSession.objectiveScore} / 100 (auto)`
                                    : 'Por calificar'}
                                </div>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {linkedWorkStyle ? (
                                <span className="text-purple-400 font-semibold bg-purple-950/60 border border-purple-900 px-2 py-0.5 rounded text-[11px]">
                                  Completado (6 dims)
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-slate-400 font-mono text-[11px]">
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {linkedSession ? (
                                  <button
                                    onClick={() => loadSessionDetail(linkedSession.id)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
                                  >
                                    <Eye size={13} />
                                    <span>Evaluar</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onOpenCandidateLink(inv.id)}
                                    className="px-2.5 py-1.5 bg-[#17202c] hover:bg-[#202c3d] text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
                                    title="Abrir enlace de candidato"
                                  >
                                    <ExternalLink size={13} />
                                    <span>Abrir</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    const link = `${window.location.origin}${window.location.pathname}?token=${inv.id}`;
                                    navigator.clipboard.writeText(link);
                                    alert('Enlace individual copiado al portapapeles');
                                  }}
                                  className="p-1.5 bg-[#17202c] hover:bg-[#202c3d] text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                                  title="Copiar enlace"
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL: GENERATE NEW INVITATION ==================== */}
      {showNewInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#263241] pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <LinkIcon size={18} className="text-blue-400" />
                Nueva Invitación de Evaluación
              </h2>
              <button
                onClick={() => setShowNewInviteModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {generatedInviteLink ? (
              <div className="space-y-4">
                <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-xs text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle size={16} />
                    Invitación creada exitosamente
                  </div>
                  <p className="text-emerald-300/80">
                    Este enlace es individual y de un solo uso para el candidato.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Enlace de evaluación para el candidato
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#263241]">
                  <button
                    onClick={() => {
                      setGeneratedInviteLink(null);
                      setShowNewInviteModal(false);
                    }}
                    className="px-4 py-2 bg-[#17202c] hover:bg-[#202c3d] text-slate-300 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvitation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nombre del Candidato</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ana García"
                    value={newCandidateName}
                    onChange={(e) => setNewCandidateName(e.target.value)}
                    className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="ana.garcia@email.com"
                    value={newCandidateEmail}
                    onChange={(e) => setNewCandidateEmail(e.target.value)}
                    className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Variante Caso Práctico</label>
                    <select
                      value={newVariant}
                      onChange={(e) => setNewVariant(e.target.value as any)}
                      className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="A">Variante A (CRM & Facturación)</option>
                      <option value="B">Variante B (E-commerce ERP Pagos)</option>
                      <option value="C">Variante C (ATS & Firma Digital)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Expiración del Enlace</label>
                    <select
                      value={newExpiryDays}
                      onChange={(e) => setNewExpiryDays(Number(e.target.value))}
                      className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value={1}>24 horas (1 día)</option>
                      <option value={2}>48 horas (2 días)</option>
                      <option value={3}>3 días</option>
                      <option value={7}>7 días</option>
                      <option value={14}>14 días</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#263241]">
                  <button
                    type="button"
                    onClick={() => setShowNewInviteModal(false)}
                    className="px-4 py-2 bg-[#17202c] hover:bg-[#202c3d] text-slate-300 font-bold rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Generar Enlace
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
