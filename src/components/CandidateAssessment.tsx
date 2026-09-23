import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TECHNICAL_QUESTIONS,
  PRACTICAL_CASE,
  WORK_STYLE_STATEMENTS,
  calculateWorkStyleScores
} from '../data/questions';
import { Clock, ShieldAlert, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

interface CandidateAssessmentProps {
  invitationToken: string;
  onExit?: () => void;
}

async function assessmentPost(body: any) {
  const response = await fetch('/api/assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || ('HTTP ' + response.status));
  }
  return data;
}

async function assessmentGet(token: string) {
  const response = await fetch('/api/assessment?token=' + encodeURIComponent(token), {
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || ('HTTP ' + response.status));
  }
  return data.assessment;
}

export const CandidateAssessment: React.FC<CandidateAssessmentProps> = ({
  invitationToken
}) => {
  // Assessment Flow Phase:
  // 'validating' -> 'intro' -> 'technical_quiz' -> 'part1_done' -> 'work_style' -> 'all_completed' | 'error'
  const [phase, setPhase] = useState<'validating' | 'intro' | 'technical_quiz' | 'part1_done' | 'work_style' | 'all_completed' | 'error'>('validating');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Candidate and Invitation Info
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [sessionId, setSessionId] = useState('');

  // Integrity Declaration
  const [integrityAccepted, setIntegrityAccepted] = useState(false);

  // Technical Quiz State
  const [technicalAnswers, setTechnicalAnswers] = useState<Record<string, string>>({});
  const [technicalStartTime, setTechnicalStartTime] = useState<number | null>(null);
  const [technicalSecondsLeft, setTechnicalSecondsLeft] = useState(50 * 60);
  const [saveStatus, setSaveStatus] = useState('No iniciado');

  // Work Style State
  const [workStyleResponses, setWorkStyleResponses] = useState<Record<number, number>>({});
  const [workStyleStartTime, setWorkStyleStartTime] = useState<number | null>(null);
  const [workStyleSecondsElapsed, setWorkStyleSecondsElapsed] = useState(0);

  // Integrity Counters
  const [counters, setCounters] = useState({
    copy: 0,
    paste: 0,
    cut: 0,
    hidden: 0,
    blur: 0,
    fullscreen_exit: 0
  });

  const eventQueueRef = useRef<any[]>([]);
  const lastActiveQidRef = useRef<string>('');

  // Unique ID generator
  const uid = (prefix = 'ev') =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  // Log integrity event locally; events are sent to Neon with checkpoints/submission.
  const logEvent = useCallback((type: string, detail = '') => {
    if (!sessionId || phase === 'all_completed' || phase === 'validating') return;

    setCounters(prev => {
      const next = { ...prev };
      if (type in next) {
        (next as any)[type] = ((next as any)[type] || 0) + 1;
      }
      return next;
    });

    eventQueueRef.current.push({
      eventId: uid('ev'),
      sessionId,
      type,
      questionId: lastActiveQidRef.current || null,
      detail: String(detail).slice(0, 300),
      timestamp: new Date().toISOString()
    });
  }, [sessionId, phase]);

  // Validate the invitation against Neon.
  useEffect(() => {
    async function checkInvitation() {
      if (!invitationToken) {
        setErrorMessage('No se proporcionó un enlace de evaluación válido.');
        setPhase('error');
        return;
      }

      try {
        const data = await assessmentGet(invitationToken);

        if (data.status === 'completed') {
          setErrorMessage('Este enlace de evaluación ya fue utilizado y completado. No se permiten reintentos.');
          setPhase('error');
          return;
        }

        setCandidateName(data.candidateName || '');
        setCandidateEmail(data.candidateEmail || '');
        setCandidateId(String(data.candidateId || ''));
        setSessionId(data.sessionId || invitationToken);

        const storedKey = 'reset_assessment_' + invitationToken;
        const local = localStorage.getItem(storedKey);
        let restoredSession = false;
        let restoredPhase: any = null;

        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed.sessionId === data.sessionId) {
              restoredSession = true;
              restoredPhase = parsed.phase;
              if (parsed.technicalAnswers) setTechnicalAnswers(parsed.technicalAnswers);
              if (parsed.workStyleResponses) setWorkStyleResponses(parsed.workStyleResponses);
              if (parsed.technicalStartTime) setTechnicalStartTime(parsed.technicalStartTime);
              if (parsed.workStyleStartTime) setWorkStyleStartTime(parsed.workStyleStartTime);
              if (parsed.counters) setCounters(parsed.counters);
            }
          } catch {
            localStorage.removeItem(storedKey);
          }
        }

        if (data.status === 'technical_submitted') {
          setPhase('part1_done');
          return;
        }

        if ((data.status === 'started' || data.status === 'in_progress') && !restoredSession) {
          setErrorMessage(
            'Esta evaluación ya fue iniciada. Continúa desde el navegador donde comenzaste o contacta al equipo de RESET.'
          );
          setPhase('error');
          return;
        }

        if (restoredSession && restoredPhase && restoredPhase !== 'error' && restoredPhase !== 'all_completed') {
          setPhase(restoredPhase);
        } else {
          setPhase('intro');
        }
      } catch (err: any) {
        console.error('Error validating invitation:', err);
        setErrorMessage(err?.message || 'No se pudo verificar la invitación. Intenta recargar la página.');
        setPhase('error');
      }
    }

    void checkInvitation();
  }, [invitationToken]);

  // Persist resumable browser state locally. Neon remains the source of truth.
  useEffect(() => {
    if (!sessionId || phase === 'validating' || phase === 'error' || phase === 'all_completed') return;

    localStorage.setItem(`reset_assessment_${invitationToken}`, JSON.stringify({
      sessionId,
      phase,
      candidateName,
      candidateEmail,
      technicalAnswers,
      workStyleResponses,
      counters,
      technicalStartTime,
      workStyleStartTime
    }));
  }, [
    sessionId,
    phase,
    invitationToken,
    candidateName,
    candidateEmail,
    technicalAnswers,
    workStyleResponses,
    counters,
    technicalStartTime,
    workStyleStartTime
  ]);

  // Fullscreen helper
  const requestFullscreenSafe = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // Browsers may ignore if not direct user gesture
    }
  };

  // Start Technical Assessment
  const handleStartTechnical = async () => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert('Por favor verifica tu nombre y correo.');
      return;
    }
    if (!integrityAccepted) {
      alert('Debes aceptar la declaración de integridad para comenzar.');
      return;
    }

    await requestFullscreenSafe();

    const now = Date.now();

    try {
      await assessmentPost({
        action: 'session_start',
        sessionId,
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: window.screen.width + 'x' + window.screen.height
        }
      });

      setTechnicalStartTime(now);
      setTechnicalSecondsLeft(50 * 60);
      setPhase('technical_quiz');
      setSaveStatus('Guardado');
      logEvent('start', 'Assessment técnico iniciado');
    } catch (error) {
      console.error('Error starting session:', error);
      alert('No se pudo iniciar la evaluación. Verifica tu conexión e intenta nuevamente.');
    }
  };

  // Technical Quiz Timer Tick
  useEffect(() => {
    if (phase !== 'technical_quiz' || !technicalStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - technicalStartTime) / 1000);
      const remaining = Math.max(0, 50 * 60 - elapsed);
      setTechnicalSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleFinishTechnical(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, technicalStartTime]);

  // Work Style Timer Tick
  useEffect(() => {
    if (phase !== 'work_style' || !workStyleStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - workStyleStartTime) / 1000);
      setWorkStyleSecondsElapsed(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, workStyleStartTime]);

  // Autosave Technical Answers to Neon
  const autosaveToNeon = useCallback(async () => {
    if (!sessionId || phase !== 'technical_quiz') return;
    setSaveStatus('Guardando...');

    try {
      const elapsed = technicalStartTime ? Math.floor((Date.now() - technicalStartTime) / 1000) : 0;
      const pendingEvents = [...eventQueueRef.current];

      await assessmentPost({
        action: 'checkpoint',
        sessionId,
        elapsedSeconds: elapsed,
        counters,
        answers: technicalAnswers,
        events: pendingEvents
      });

      if (pendingEvents.length) {
        eventQueueRef.current = eventQueueRef.current.slice(pendingEvents.length);
      }
      setSaveStatus('Guardado');
    } catch (e) {
      console.warn('Autosave sync delayed', e);
      setSaveStatus('Guardado local');
    }
  }, [sessionId, phase, technicalAnswers, technicalStartTime, counters]);

  // Periodic Autosave every 25 seconds
  useEffect(() => {
    if (phase !== 'technical_quiz') return;
    const interval = setInterval(autosaveToNeon, 25000);
    return () => clearInterval(interval);
  }, [phase, autosaveToNeon]);

  // Browser Integrity Event Listeners
  useEffect(() => {
    if (phase !== 'technical_quiz' && phase !== 'work_style') return;

    const handleCopy = () => logEvent('copy', 'Acción de copiar detectada');
    const handleCut = () => logEvent('cut', 'Acción de cortar detectada');
    const handlePaste = () => logEvent('paste', 'Acción de pegar detectada');

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        logEvent('hidden', 'Pestaña minimizada o cambio de pestaña');
      } else {
        logEvent('visible', 'Pestaña activa nuevamente');
      }
    };

    const handleBlur = () => logEvent('blur', 'Ventana perdió el foco');
    const handleFocus = () => logEvent('focus', 'Ventana recuperó el foco');

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logEvent('fullscreen_exit', 'Salida de modo pantalla completa');
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [phase, logEvent]);

  // Finish Technical Assessment and Proceed to Part 2
  const handleFinishTechnical = async (auto = false) => {
    if (!auto) {
      for (const q of TECHNICAL_QUESTIONS) {
        if (q.required && (!technicalAnswers[q.id] || !technicalAnswers[q.id].trim())) {
          alert('Falta responder la pregunta ' + q.id.replace('q', '') + ': ' + q.title.slice(0, 50) + '...');
          const el = document.getElementById('q_wrapper_' + q.id);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
    }

    logEvent(auto ? 'time_expired' : 'submit_clicked', auto ? 'Tiempo de evaluación agotado' : 'Entrega manual de Parte 1');

    try {
      const elapsed = technicalStartTime ? Math.floor((Date.now() - technicalStartTime) / 1000) : 0;
      const pendingEvents = [...eventQueueRef.current];

      await assessmentPost({
        action: 'technical_submit',
        sessionId,
        elapsedSeconds: elapsed,
        counters,
        answers: technicalAnswers,
        events: pendingEvents
      });

      eventQueueRef.current = [];
      setSaveStatus('Entregado');
      setPhase('part1_done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error submitting technical quiz:', err);
      alert('Ocurrió un problema al guardar la entrega. Tus respuestas siguen guardadas localmente; intenta nuevamente.');
    }
  };

  // Start Part 2: Work Style Profile
  const handleStartWorkStyle = async () => {
    await requestFullscreenSafe();
    const now = Date.now();
    setWorkStyleStartTime(now);
    setWorkStyleSecondsElapsed(0);
    setPhase('work_style');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Work Style Profile
  const handleSubmitWorkStyle = async () => {
    for (let i = 1; i <= 30; i++) {
      if (!workStyleResponses[i]) {
        alert('Falta responder la afirmación número ' + i + '. Por favor responde todas las afirmaciones.');
        const el = document.getElementById('stmt_' + i);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    try {
      const calculation = calculateWorkStyleScores(workStyleResponses);
      const workStyleElapsed = workStyleStartTime
        ? Math.floor((Date.now() - workStyleStartTime) / 1000)
        : workStyleSecondsElapsed;
      const technicalElapsed = technicalStartTime
        ? Math.floor((Date.now() - technicalStartTime) / 1000)
        : 0;

      const answers: Record<string, any> = {};
      for (let i = 1; i <= 30; i++) {
        answers['ws' + i] = workStyleResponses[i];
      }
      answers.ws_dimensions = calculation.dimensionScores;
      answers.ws_consistency = calculation.consistencyFlags;

      await assessmentPost({
        action: 'work_style_submit',
        sessionId,
        elapsedSeconds: technicalElapsed + workStyleElapsed,
        counters,
        answers,
        events: [...eventQueueRef.current]
      });

      eventQueueRef.current = [];
      localStorage.removeItem('reset_assessment_' + invitationToken);

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      setPhase('all_completed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Error submitting work style:', err);
      alert('Ocurrió un error al procesar la entrega final. Tus respuestas siguen guardadas localmente; intenta nuevamente.');
    }
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- RENDER ERROR SCREEN ---
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#101721] border border-[#263241] rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-red-950/60 border border-red-800 rounded-full flex items-center justify-center mx-auto mb-5 text-red-400">
            <AlertCircle size={28} />
          </div>
          <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">RESET</div>
          <h2 className="text-xl font-bold text-slate-100 mb-3">Enlace no disponible</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {errorMessage}
          </p>
          <div className="text-xs text-slate-400 border-t border-[#263241] pt-4">
            Si crees que esto es un error, por favor contacta al equipo de selección de RESET.
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER VALIDATING SCREEN ---
  if (phase === 'validating') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-300">Cargando evaluación de RESET...</p>
        </div>
      </div>
    );
  }

  // --- RENDER INTRO SCREEN ---
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Top Brand Bar */}
          <div className="flex items-center justify-between border-b border-[#263241] pb-4 mb-8">
            <div className="text-xl font-black tracking-widest text-blue-500">RESET</div>
            <div className="text-xs text-slate-400">Proceso de Selección</div>
          </div>

          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
              Assessment – Ingeniero en Desarrollo de Software / Sistemas
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-50 mb-3">
              Evaluación Técnica y de Personalidad Laboral
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              Duración estimada: 50 min (Técnica) + 7–10 min (Personalidad Laboral) · Puntaje técnico: 100 puntos
            </p>

            <div className="bg-[#0c121a] border border-[#263241] rounded-xl p-4 mb-6 text-sm text-slate-300 leading-relaxed">
              <strong className="text-slate-100">Objetivo.</strong> Evaluar razonamiento lógico, desarrollo de software, APIs, bases de datos, integración de sistemas, troubleshooting, automatización y criterio técnico aplicado a proyectos empresariales. No necesitas conocer herramientas propietarias específicas para responder.
            </div>

            <div className="space-y-3 mb-6 text-sm text-slate-300 leading-relaxed">
              <h3 className="text-base font-bold text-slate-100">Reglas de integridad</h3>
              <p>
                La evaluación debe realizarse individualmente, sin herramientas de inteligencia artificial, buscadores, documentación externa ni asistencia de terceros.
              </p>
              <p>
                El sistema registra únicamente eventos de integridad del navegador: copiar, cortar, pegar, pérdida de foco, cambio de pestaña/ventana, salida de pantalla completa, hora de inicio, progreso y tiempo de entrega. <strong className="text-slate-200">No se graba audio ni video y no se capturan imágenes.</strong>
              </p>
              <p className="text-slate-400 text-xs">
                No necesitas una cuenta especial ni iniciar sesión. Puedes participar directamente con este enlace individual.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="w-full bg-[#0a1017] border border-[#263241] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 bg-[#0a1017] p-3.5 border border-[#263241] rounded-xl cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={integrityAccepted}
                onChange={(e) => setIntegrityAccepted(e.target.checked)}
                className="mt-1 accent-blue-500"
              />
              <span className="text-xs sm:text-sm text-slate-300 leading-snug">
                Declaro que realizaré esta evaluación personalmente y acepto el registro de los eventos de integridad indicados arriba.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#263241] pt-6">
              <span className="text-xs text-slate-400">
                Al comenzar se solicitará pantalla completa.
              </span>
              <button
                type="button"
                onClick={handleStartTechnical}
                disabled={!integrityAccepted || !candidateName.trim() || !candidateEmail.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Comenzar assessment
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER TECHNICAL QUIZ SCREEN ---
  if (phase === 'technical_quiz') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8]">
        {/* Sticky Header with Timer & Progress */}
        <header className="sticky top-0 z-30 bg-[#090d12]/95 backdrop-blur-md border-b border-[#263241] px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-black tracking-widest text-blue-500">RESET</span>
                <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-[#263241] pl-3">
                  Parte 1: Assessment Técnico
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400">{saveStatus}</span>
                <div className={`flex items-center gap-1.5 font-mono font-bold text-sm px-2.5 py-1 rounded-md ${
                  technicalSecondsLeft < 300 ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse' : 'bg-[#101721] text-slate-200 border border-[#263241]'
                }`}>
                  <Clock size={15} />
                  <span>{formatTime(technicalSecondsLeft)}</span>
                </div>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[#17202b] h-1.5 rounded-full overflow-hidden mt-2.5">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, ((3000 - technicalSecondsLeft) / 3000) * 100))}%` }}
              />
            </div>
          </div>
        </header>

        {/* Quiz Body */}
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Candidate Info Pill */}
          <div className="bg-[#101721] border border-[#263241] rounded-xl p-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div>
              Candidato: <strong className="text-slate-200">{candidateName}</strong> ({candidateEmail})
            </div>
            <div>
              Evaluación: <span className="text-blue-400 font-bold">Ingeniero en Desarrollo de Software / Sistemas</span>
            </div>
          </div>

          {/* Group questions by section */}
          {Array.from(new Set(TECHNICAL_QUESTIONS.map(q => q.section))).map((sectionTitle) => {
            const sectionQuestions = TECHNICAL_QUESTIONS.filter(q => q.section === sectionTitle);
            const totalPoints = sectionQuestions.reduce((acc, q) => acc + q.points, 0);

            return (
              <section key={sectionTitle} className="bg-[#101721] border border-[#263241] rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#263241] pb-3 mb-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
                    {sectionTitle}
                  </h2>
                  {totalPoints > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#0a1017] border border-[#263241] text-slate-300">
                      {totalPoints} pts
                    </span>
                  )}
                </div>

                <div className="space-y-8">
                  {sectionQuestions.map((q) => {
                    // Special rendering for Q12: Practical Case with Variant
                    if (q.id === 'q12') {
                      return (
                        <div
                          key={q.id}
                          id={`q_wrapper_${q.id}`}
                          className="space-y-4 pt-4 first:pt-0"
                          onFocus={() => { lastActiveQidRef.current = q.id; }}
                        >
                          <div className="flex items-baseline justify-between">
                            <h3 className="font-bold text-slate-100 text-base leading-snug">
                              12. {PRACTICAL_CASE.title}
                            </h3>
                            <span className="text-xs text-slate-400 font-semibold">{q.points} pts</span>
                          </div>

                          <div className="bg-[#0a1017] border border-[#263241] rounded-xl p-4 text-sm text-slate-300 space-y-3">
                            <p>{PRACTICAL_CASE.scenario}</p>
                            <ul className="list-none space-y-1.5 pl-1 text-slate-200">
                              {PRACTICAL_CASE.requirements.map((req, rIdx) => (
                                <li key={rIdx} className="text-xs sm:text-sm">{req}</li>
                              ))}
                            </ul>
                            <p className="text-xs text-slate-400 border-t border-[#263241] pt-3">
                              {PRACTICAL_CASE.evaluationCriteria}
                            </p>
                          </div>

                          <textarea
                            rows={10}
                            value={technicalAnswers[q.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTechnicalAnswers(prev => ({ ...prev, [q.id]: val }));
                              setSaveStatus('Guardado local');
                            }}
                            placeholder="Desarrolla tu arquitectura cubriendo todos los aspectos solicitados..."
                            className="w-full bg-[#0a1017] border border-[#263241] rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={q.id}
                        id={`q_wrapper_${q.id}`}
                        className="space-y-3 pt-4 first:pt-0 border-t border-[#263241]/60 first:border-t-0"
                        onFocus={() => { lastActiveQidRef.current = q.id; }}
                      >
                        <div className="flex items-baseline justify-between">
                          <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-snug">
                            {q.title}
                          </h3>
                          {q.points > 0 && (
                            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap ml-2">
                              {q.points} pts
                            </span>
                          )}
                        </div>

                        {q.codeSnippet && (
                          <pre className="bg-[#080d13] border border-[#263241] rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap">
                            {q.codeSnippet}
                          </pre>
                        )}

                        {q.type === 'radio' && q.options && (
                          <div className="space-y-2 mt-2">
                            {q.options.map((opt) => (
                              <label
                                key={opt.value}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors text-sm ${
                                  technicalAnswers[q.id] === opt.value
                                    ? 'bg-blue-950/40 border-blue-500 text-slate-100'
                                    : 'bg-[#0a1017] border-[#263241] text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt.value}
                                  checked={technicalAnswers[q.id] === opt.value}
                                  onChange={() => {
                                    setTechnicalAnswers(prev => ({ ...prev, [q.id]: opt.value }));
                                    setSaveStatus('Guardado local');
                                  }}
                                  className="accent-blue-500"
                                />
                                <span>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === 'textarea' && (
                          <textarea
                            rows={q.points >= 10 ? 6 : 4}
                            value={technicalAnswers[q.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTechnicalAnswers(prev => ({ ...prev, [q.id]: val }));
                              setSaveStatus('Guardado local');
                            }}
                            placeholder={q.placeholder || 'Escribe tu respuesta aquí...'}
                            className="w-full bg-[#0a1017] border border-[#263241] rounded-xl p-3.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 leading-relaxed"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Bottom Actions Card */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Al finalizar esta sección avanzarás a la segunda parte: Perfil de Personalidad Laboral y Estilo de Trabajo.
            </div>
            <button
              type="button"
              onClick={() => handleFinishTechnical(false)}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30"
            >
              Completar Parte 1 y Continuar
              <ChevronRight size={18} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --- RENDER PART 1 DONE TRANSITION SCREEN ---
  if (phase === 'part1_done') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-[#101721] border border-[#263241] rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-emerald-950/60 border border-emerald-700 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400">
            <CheckCircle2 size={32} />
          </div>

          <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-2">
            Parte 1 completada
          </div>
          <h1 className="text-2xl font-black text-slate-50 mb-3">
            Assessment Técnico Recibido
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Has finalizado la primera etapa técnica con éxito. Tus respuestas quedaron aseguradas.
          </p>

          <div className="bg-[#0c121a] border border-[#263241] rounded-xl p-5 mb-8 text-left space-y-2">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Parte 2 de 2
            </div>
            <div className="text-lg font-bold text-slate-100">
              Perfil de Personalidad Laboral y Estilo de Trabajo – RESET
            </div>
            <p className="text-xs text-slate-300">
              Tiempo estimado: 7–10 minutos. Este módulo contiene 30 afirmaciones sobre personalidad laboral, hábitos de ejecución, resolución de problemas, aprendizaje, colaboración, autonomía y manejo de ambigüedad. No existen respuestas correctas o incorrectas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartWorkStyle}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/40"
          >
            Continuar a Parte 2
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER WORK STYLE MODULE SCREEN ---
  if (phase === 'work_style') {
    return (
      <div className="min-h-screen bg-[#090d12] text-[#edf3f8]">
        {/* Sticky Header with Work Style Title & Timer */}
        <header className="sticky top-0 z-30 bg-[#090d12]/95 backdrop-blur-md border-b border-[#263241] px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black tracking-widest text-blue-500">RESET</span>
              <span className="text-xs text-slate-400 border-l border-[#263241] pl-3">
                Parte 2 de 2: Perfil de Personalidad Laboral y Estilo de Trabajo
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono bg-[#101721] px-3 py-1.5 rounded-lg border border-[#263241] text-slate-300">
              <Clock size={14} />
              <span>Tiempo transcurrido: {formatTime(workStyleSecondsElapsed)}</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Instructions Box verbatim as requested */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Instrucciones al candidato
            </div>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
              “Las siguientes afirmaciones describen distintas formas de trabajar. No existen respuestas correctas o incorrectas. Selecciona la opción que mejor represente cómo normalmente actúas en situaciones de trabajo reales.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Responde pensando en cómo trabajas habitualmente, no en cómo consideras que deberías trabajar.”
            </p>
            <div className="bg-[#0a1017] border border-[#263241] rounded-xl p-3 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
              <span>1 = Totalmente en desacuerdo</span>
              <span>2 = En desacuerdo</span>
              <span>3 = Ni de acuerdo ni en desacuerdo</span>
              <span>4 = De acuerdo</span>
              <span>5 = Totalmente de acuerdo</span>
            </div>
          </div>

          {/* 30 Likert Statements */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 sm:p-8 shadow-xl space-y-8">
            {WORK_STYLE_STATEMENTS.map((stmt, idx) => {
              const selectedValue = workStyleResponses[stmt.id];

              return (
                <div
                  key={stmt.id}
                  id={`stmt_${stmt.id}`}
                  className="space-y-3 pt-6 first:pt-0 border-t border-[#263241]/60 first:border-t-0"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-blue-400 w-6">{stmt.id}.</span>
                    <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
                      {stmt.statement}
                    </p>
                  </div>

                  {/* 5-point Likert Option Scale */}
                  <div className="grid grid-cols-5 gap-2 sm:gap-3 pt-2">
                    {[
                      { val: 1, label: 'Totalmente en desacuerdo' },
                      { val: 2, label: 'En desacuerdo' },
                      { val: 3, label: 'Neutro' },
                      { val: 4, label: 'De acuerdo' },
                      { val: 5, label: 'Totalmente de acuerdo' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setWorkStyleResponses(prev => ({ ...prev, [stmt.id]: opt.val }));
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedValue === opt.val
                            ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/50 scale-[1.02]'
                            : 'bg-[#0a1017] border-[#263241] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-sm sm:text-base font-bold mb-1">{opt.val}</span>
                        <span className="text-[10px] sm:text-xs leading-tight opacity-90 hidden sm:inline">
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Work Style Button */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Has respondido {Object.keys(workStyleResponses).length} de 30 afirmaciones.
            </div>
            <button
              type="button"
              onClick={handleSubmitWorkStyle}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/40"
            >
              Finalizar y Entregar Evaluación
              <CheckCircle2 size={20} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --- RENDER ALL COMPLETED SCREEN (Verbatim message as requested) ---
  return (
    <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#101721] border border-[#263241] rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-blue-950/60 border border-blue-500/50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400">
          <CheckCircle2 size={36} />
        </div>
        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">RESET</div>
        <h1 className="text-2xl font-black text-slate-50 mb-4">
          Evaluación completada
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          Gracias por completar el proceso de evaluación de RESET. Tus respuestas han sido registradas correctamente.
        </p>
        <p className="text-xs text-slate-400 border-t border-[#263241] pt-4">
          Puedes cerrar esta ventana de manera segura. Nuestro equipo de selección revisará tu entrega.
        </p>
      </div>
    </div>
  );
};
