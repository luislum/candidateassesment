import React, { useState, useEffect } from 'react';
import { CandidateAssessment } from './components/CandidateAssessment';
import { AdminDashboard } from './components/AdminDashboard';
import { Shield, UserCheck, Play, ArrowRight, Lock } from 'lucide-react';

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const isAdmin = params.get('admin') === 'true' || window.location.hash === '#admin';

    if (urlToken) {
      setToken(urlToken);
      setShowAdmin(false);
    } else if (isAdmin) {
      setShowAdmin(true);
    }
  }, []);

  const handleOpenAdmin = () => {
    setShowAdmin(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.set('admin', 'true');
    window.history.pushState({}, '', url);
  };

  const handleOpenCandidateLink = (tokenToOpen: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('token', tokenToOpen);
    url.searchParams.delete('admin');
    window.history.pushState({}, '', url);
    setToken(tokenToOpen);
    setShowAdmin(false);
  };

  // If candidate token is active, show candidate evaluation experience
  if (token) {
    return (
      <CandidateAssessment
        invitationToken={token}
        onExit={() => {
          setToken(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          window.history.pushState({}, '', url);
        }}
      />
    );
  }

  // If Admin Dashboard is active
  if (showAdmin) {
    return <AdminDashboard onOpenCandidateLink={handleOpenCandidateLink} />;
  }

  // Default Landing / Portal Router
  return (
    <div className="min-h-screen bg-[#090d12] text-[#edf3f8] flex flex-col justify-between p-6">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-[#263241] pb-4">
        <div className="text-xl font-black tracking-widest text-blue-500">RESET</div>
        <button
          onClick={handleOpenAdmin}
          className="px-3.5 py-1.5 bg-[#101721] hover:bg-[#17202c] border border-[#263241] rounded-xl text-xs font-bold text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Lock size={13} className="text-blue-400" />
          <span>Panel Administrativo</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto my-auto py-12">
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Shield size={14} />
            Proceso de Selección Técnica
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 tracking-tight">
            RESET Candidate Assessment
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            Plataforma integral de evaluación de habilidades técnicas de desarrollo de software y Perfil de Estilo de Trabajo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Candidate Access with Token */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-blue-400">
                <UserCheck size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Acceso Candidato</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Si recibiste una invitación individual, ingresa el código o token de tu enlace para acceder al assessment.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <input
                type="text"
                placeholder="Código de invitación (ej. inv_xyz...)"
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                className="w-full bg-[#0a1017] border border-[#263241] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                disabled={!manualTokenInput.trim()}
                onClick={() => {
                  if (manualTokenInput.trim()) {
                    setToken(manualTokenInput.trim());
                  }
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Ingresar a la Evaluación</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Card 2: Invitation Management */}
          <div className="bg-[#101721] border border-[#263241] rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <Play size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Generar Invitación</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Las invitaciones y pruebas internas se generan desde el panel administrativo autenticado para asegurar que cada enlace exista realmente en Firestore.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleOpenAdmin}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 font-bold text-white rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                Abrir Panel Administrativo
                <ArrowRight size={14} />
              </button>
              <span className="block text-[10px] text-slate-500 text-center">
                Desde allí puedes crear enlaces para Variante A, B o C.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center border-t border-[#263241] pt-4 text-xs text-slate-500">
        RESET · Proceso de Selección e Integración Técnica
      </footer>
    </div>
  );
}
