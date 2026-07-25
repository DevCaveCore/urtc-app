
import React, { useState } from 'react';
import { login, redeemAccessCode, setRememberMe } from '../../services/authService';
import { UserAccount } from '../../types';
import { EnhancedApolloDogIcon } from '../ApolloDog';
import { Lock, User, KeyRound, CheckCircle, X } from 'lucide-react';

interface Props {
  onSuccess: (user: UserAccount) => void;
  onRegisterClick: () => void;
  onClose?: () => void;
}

export const LoginView: React.FC<Props> = ({ onSuccess, onRegisterClick, onClose }) => {
  const [isCrewMode, setIsCrewMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [crewCode, setCrewCode] = useState('');
  const [rememberMe, setRememberMeState] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isCrewMode) {
        const user = redeemAccessCode(crewCode);
        setRememberMe(rememberMe);
        onSuccess(user);
      } else {
        const user = await login(email, password);
        setRememberMe(rememberMe);
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full bg-[#101319] border border-white/10 p-6 rounded-[28px] shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-orange/10 to-transparent pointer-events-none" />
        {onClose && (
            <button
                type="button"
                onClick={onClose}
                title="Continue as guest"
                className="absolute top-4 right-4 z-20 p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition"
            >
                <X size={18} />
            </button>
        )}
        <div className="relative z-10 flex flex-col items-center mb-6">
            <div className="bg-brand-orange/10 border border-brand-orange/20 p-3 rounded-full mb-3 shadow-lg shadow-brand-orange/10">
                <EnhancedApolloDogIcon size={60} interactive />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">{isCrewMode ? 'Crew Access' : 'Welcome aboard'}</h2>
            <p className="text-xs text-gray-400 mt-1.5">{isCrewMode ? 'Enter your crew credentials.' : 'Apollo kept your seat warm.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-bold">{error}</div>}

            {!isCrewMode ? (
                <>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Email</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-500" size={16} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition" placeholder="traveler@example.com" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Password</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 text-gray-500" size={16} />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition" placeholder="••••••" />
                        </div>
                    </div>

                    {/* Remember Me */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <button
                            type="button"
                            onClick={() => setRememberMeState(!rememberMe)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                rememberMe 
                                    ? 'bg-brand-orange border-brand-orange' 
                                    : 'border-gray-600 bg-transparent hover:border-gray-400'
                            }`}
                        >
                            {rememberMe && <CheckCircle size={12} className="text-white" />}
                        </button>
                        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition">Remember me</span>
                    </label>
                </>
            ) : (
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-purple-400 ml-1">Access Code</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-purple-500" size={16} />
                        <input type="text" value={crewCode} onChange={e => setCrewCode(e.target.value)} className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl py-3 pl-10 pr-4 text-white focus:border-purple-500 outline-none font-mono tracking-widest transition" placeholder="BS123" />
                    </div>
                </div>
            )}

            <button type="submit" className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition ${isCrewMode ? 'bg-purple-600' : 'bg-brand-orange'}`}>
                {isCrewMode ? 'Verify Access' : 'Login'}
            </button>

            {!isCrewMode && (
                <>
                    <div className="flex items-center my-4">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="px-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">One-tap instead</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={async () => {
                                try {
                                    const { loginWithGoogle } = await import('../../services/authService');
                                    const user = await loginWithGoogle();
                                    onSuccess(user);
                                } catch(e: any) { setError(e.message); }
                            }}
                            className="flex-1 py-3 bg-white hover:bg-gray-100 text-black rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                        </button>
                        <button 
                            type="button" 
                            onClick={async () => {
                                try {
                                    const { loginWithApple } = await import('../../services/authService');
                                    const user = await loginWithApple();
                                    onSuccess(user);
                                } catch(e: any) { setError(e.message); }
                            }}
                            className="flex-1 py-3 bg-black hover:bg-gray-900 border border-white/20 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.88 3.5-.84 1.58.11 2.81.7 3.58 1.83-3.01 1.77-2.52 5.76.48 6.94-1.02 2.62-2.02 3.98-2.64 4.26zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.35 2.45-1.92 4.39-3.74 4.25z"/>
                            </svg>
                            Apple
                        </button>
                    </div>
                </>
            )}

            <div className="text-center pt-2">
                <button type="button" onClick={() => {setIsCrewMode(!isCrewMode); setError('');}} className="text-xs text-gray-500 hover:text-white underline">
                    {isCrewMode ? 'Back to Traveler Login' : 'Have a Crew Code?'}
                </button>
            </div>

            {!isCrewMode && (
                <div className="text-center text-xs text-gray-500 mt-4">
                    Don't have an account? <button type="button" onClick={onRegisterClick} className="text-brand-orange font-bold hover:underline">Sign Up</button>
                </div>
            )}
        </form>
    </div>
  );
};
