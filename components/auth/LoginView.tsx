
import React, { useState } from 'react';
import { login, redeemAccessCode, setRememberMe } from '../../services/authService';
import { UserAccount } from '../../types';
import { EnhancedApolloDogIcon } from '../ApolloDog';
import { Lock, User, KeyRound, CheckCircle } from 'lucide-react';

interface Props {
  onSuccess: (user: UserAccount) => void;
  onRegisterClick: () => void;
}

export const LoginView: React.FC<Props> = ({ onSuccess, onRegisterClick }) => {
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
    <div className="w-full bg-brand-surface border border-white/10 p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center mb-6">
            <div className="bg-brand-orange/10 p-3 rounded-full mb-3">
                <EnhancedApolloDogIcon size={60} interactive />
            </div>
            <h2 className="text-2xl font-bold text-white">{isCrewMode ? 'Crew Access' : 'Welcome Back'}</h2>
            <p className="text-xs text-gray-400 mt-1">Login to sync your trips.</p>
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
