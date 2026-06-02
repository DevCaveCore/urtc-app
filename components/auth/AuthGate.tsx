
import React, { useState, useEffect } from 'react';
import { UserAccount } from '../../types';
import { getActiveUser } from '../../services/authService';
import { LoginView } from './LoginView';
import { RegisterView } from './RegisterView';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  user: UserAccount | null;
  onUserChange: (user: UserAccount | null) => void;
}

export const AuthGate: React.FC<Props> = ({ children, user, onUserChange }) => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const storedUser = getActiveUser();
    if (storedUser && !user) {
      onUserChange(storedUser);
    }
    // Simulate a quick check delay for smoother transition
    setTimeout(() => setChecking(false), 500);
  }, []);

  if (checking) return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-white">
        <Loader2 size={40} className="animate-spin text-brand-orange mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Authenticating</p>
    </div>
  );

  if (user) {
    return <>{children}</>;
  }

  return view === 'login' ? (
    <LoginView onSuccess={onUserChange} onRegisterClick={() => setView('register')} />
  ) : (
    <RegisterView onSuccess={onUserChange} onLoginClick={() => setView('login')} />
  );
};
