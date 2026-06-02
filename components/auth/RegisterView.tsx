
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
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
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
            </div>
        </form>
      </div>
    </div>
  );
};
