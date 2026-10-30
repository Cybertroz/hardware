import React, { useState } from 'react';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { User } from '../types/index.ts';
import { users as defaultUsers } from '../../server/db.ts';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('omondi@jengapro.co.ke');
  const [password, setPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = (role: 'owner' | 'cashier') => {
    const matched = defaultUsers.find(u => u.role === role) || defaultUsers[0];
    onLogin(matched);
  };

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = defaultUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase() || u.name.toLowerCase().includes(email.toLowerCase())
    );
    if (matched) {
      onLogin(matched);
    } else {
      setError('Invalid username/email or password. Try quick demo sign-in below.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 flex flex-col items-center justify-center p-4 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-md bg-white border border-sky-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Branded Logo Placeholder */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30">
            <Building2 className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider text-slate-900">JENGA PRO ERP</h1>
            <p className="text-xs text-sky-700 font-semibold tracking-wide mt-0.5">
              Hardware & Building Materials Management System
            </p>
          </div>
        </div>

        {/* Quick Demo Access Buttons */}
        <div className="space-y-2 bg-sky-50/80 p-3.5 rounded-xl border border-sky-200">
          <label className="text-[11px] font-bold text-sky-800 block uppercase tracking-wider mb-2">
            ⚡ Quick Staff Access (Demo):
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('cashier')}
              className="p-2.5 rounded-lg bg-white border border-sky-200 hover:border-sky-500 text-left transition space-y-0.5 group cursor-pointer shadow-2xs"
            >
              <div className="font-bold text-slate-900 group-hover:text-sky-600 flex items-center justify-between">
                <span>POS Cashier</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-[10px] text-slate-500">Sales & M-Pesa Counter</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('owner')}
              className="p-2.5 rounded-lg bg-white border border-sky-200 hover:border-sky-500 text-left transition space-y-0.5 group cursor-pointer shadow-2xs"
            >
              <div className="font-bold text-slate-900 group-hover:text-sky-600 flex items-center justify-between">
                <span>Owner / Admin</span>
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              </div>
              <div className="text-[10px] text-slate-500">Full Finance & Reports</div>
            </button>
          </div>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-sky-100"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">or sign in with credentials</span>
          <div className="flex-grow border-t border-sky-100"></div>
        </div>

        {/* Professional Sign-In Form */}
        <form onSubmit={handleFormLogin} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-slate-700 font-semibold block">Username or Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                placeholder="e.g. omondi@jengapro.co.ke"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-700 font-semibold block">Password / Security PIN</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2.5 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
            >
              {rememberMe ? (
                <CheckSquare className="w-4 h-4 text-sky-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Remember this device</span>
            </button>
            <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-sky-600 hover:underline font-semibold">
              Forgot PIN?
            </a>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <span>Sign In to Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-sky-100 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>KRA eTIMS & M-Pesa Daraja 2.0 Secure Session</span>
        </div>
      </div>
    </div>
  );
};
