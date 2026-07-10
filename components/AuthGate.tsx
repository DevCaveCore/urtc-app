
import React, { useState, useEffect, useCallback } from 'react';
import { Lock, LogIn, UserPlus } from 'lucide-react';

interface AuthGateProps {
  isGuest: boolean;
  children: React.ReactNode;
  featureName?: string;
  onAuthRequest?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  isGuest,
  children,
  featureName,
  onAuthRequest,
}) => {
  if (!isGuest) {
    return <>{children}</>;
  }

  const handleAction = () => {
    if (onAuthRequest) {
      onAuthRequest();
    }
  };

  return (
    <div className="relative">
      {/* Children rendered with blur + reduced opacity */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(4px)', opacity: 0.45 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Glassmorphic overlay card — positioned over children, does NOT block parent scroll */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
        <div
          className="w-full max-w-sm rounded-3xl border border-white/10 p-8 text-center"
          style={{
            background: 'rgba(16, 19, 26, 0.75)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            animation: 'blurIn 0.4s ease-out forwards',
          }}
        >
          {/* Lock icon with glow ring */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,92,26,0.15)]">
            <Lock size={28} className="text-brand-orange" />
          </div>

          <h3 className="text-lg font-display font-bold text-white mb-2">
            Sign in to access{' '}
            <span className="text-brand-orange">
              {featureName || 'this feature'}
            </span>
          </h3>

          <p className="text-sm text-white/45 leading-relaxed mb-7">
            Create a free account to unlock all of ÜrTC's travel tools
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAction}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border border-white/15 text-white/80 font-semibold text-sm hover:bg-white/5 hover:border-white/25 active:scale-[0.97] transition-all duration-150"
            >
              <LogIn size={16} />
              Sign In
            </button>

            <button
              onClick={handleAction}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-brand-orange to-[#FF8A50] text-white font-bold text-sm shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 active:scale-[0.97] transition-all duration-150"
            >
              <UserPlus size={16} />
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
