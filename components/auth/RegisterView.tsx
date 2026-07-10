
import React, { useState } from 'react';
import { register } from '../../services/authService';
import { UserAccount } from '../../types';
import { ArrowLeft, Mail, User, KeyRound, CheckCircle } from 'lucide-react';

interface Props {
  onSuccess: (user: UserAccount) => void;
  onLoginClick: () => void;
}

export const RegisterView: React.FC<Props> = ({ onSuccess, onLoginClick }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [promoOptIn, setPromoOptIn] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      const user = await register(username, password, email, promoOptIn);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-dark p-6 text-white relative">
       {/* Background Ambience */}
       <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/10 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-sm relative z-10">
        <button onClick={onLoginClick} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
            <ArrowLeft size={16} /> Back to Login
        </button>

        <form onSubmit={handleSubmit} className="w-full bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-black mb-2 text-white">Join the Crew</h2>
            <p className="text-xs font-bold text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-lg py-1.5 px-3 inline-block mb-1">✨ Includes 7 days of Diamond free — no card needed</p>
            <p className="text-sm text-gray-400 mb-6">Create your account to start tracking trips.</p>
            
            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">{error}</div>}
            
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Username</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition-all placeholder-gray-600"
                            placeholder="Choose a handle"
                            required
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition-all placeholder-gray-600"
                            placeholder="traveler@example.com"
                            required
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Password</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition-all placeholder-gray-600"
                            placeholder="••••••"
                            required
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400 ml-1">Confirm Password</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-3 text-gray-500" size={16} />
                        <input 
                            type="password" 
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-orange outline-none transition-all placeholder-gray-600"
                            placeholder="••••••"
                            required
                        />
                    </div>
                </div>

                {/* Promo Opt-In */}
                <label className="flex items-start gap-3 cursor-pointer group">
                    <button
                        type="button"
                        onClick={() => setPromoOptIn(!promoOptIn)}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                            promoOptIn 
                                ? 'bg-brand-orange border-brand-orange' 
                                : 'border-gray-600 bg-transparent hover:border-gray-400'
                        }`}
                    >
                        {promoOptIn && <CheckCircle size={12} className="text-white" />}
                    </button>
                    <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition">
                        Send me travel deals, feature updates, and promotions from Cave Core Dynamics
                    </span>
                </label>
                
                <button type="submit" className="w-full py-4 bg-brand-orange rounded-xl font-bold text-white hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-brand-orange/20 mt-2">
                Create Account
                </button>

                <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="px-3 text-xs text-gray-500 font-bold uppercase tracking-widest">Or Continue With</span>
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
            </div>
        </form>
      </div>
    </div>
  );
};
