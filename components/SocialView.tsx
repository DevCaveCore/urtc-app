import React from 'react';
import { Compass, Globe2, Users, MapPin } from 'lucide-react';

export const SocialView: React.FC = React.memo(() => {
  return (
    <div className="min-h-screen pt-20 px-6 pb-32 flex flex-col items-center justify-center text-center">
      
      {/* Animated Icon Group */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-brand-orange/20 blur-3xl rounded-full" />
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl">
          <Globe2 className="w-12 h-12 text-brand-orange animate-pulse" />
        </div>
        
        {/* Orbiting Icons */}
        <div className="absolute top-0 -left-4 w-10 h-10 rounded-full border border-white/10 bg-white/10 backdrop-blur-md flex items-center justify-center animate-float" style={{ animationDelay: '0s' }}>
          <Compass className="w-5 h-5 text-white/70" />
        </div>
        <div className="absolute bottom-4 -right-2 w-12 h-12 rounded-full border border-white/10 bg-white/10 backdrop-blur-md flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
          <Users className="w-6 h-6 text-white/70" />
        </div>
        <div className="absolute -top-6 right-4 w-8 h-8 rounded-full border border-white/10 bg-white/10 backdrop-blur-md flex items-center justify-center animate-float" style={{ animationDelay: '2s' }}>
          <MapPin className="w-4 h-4 text-white/70" />
        </div>
      </div>

      <h1 className="text-4xl font-display font-bold text-white mb-4">
        Wander
      </h1>
      
      <div className="inline-block px-4 py-1.5 rounded-full border border-brand-orange/30 bg-brand-orange/10 mb-8">
        <span className="text-xs font-bold text-brand-orange tracking-widest uppercase">
          Coming Soon
        </span>
      </div>

      <p className="text-lg text-white/60 max-w-md mx-auto leading-relaxed mb-12">
        A dedicated space to share your global adventures, discover hidden gems through community stories, and connect with fellow explorers worldwide. Your ultimate travel community is being built.
      </p>

      {/* Feature Preview Cards */}
      <div id="tour-wander-feed" className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl text-left">
        <div className="p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <Compass className="w-6 h-6 text-brand-orange mb-3" />
          <h3 className="text-white font-medium mb-1">Discover</h3>
          <p className="text-sm text-white/40">Find breathtaking locations shared by real travelers.</p>
        </div>
        
        <div className="p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <Globe2 className="w-6 h-6 text-brand-orange mb-3" />
          <h3 className="text-white font-medium mb-1">Share</h3>
          <p className="text-sm text-white/40">Post your favorite moments and travel highlights.</p>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <Users className="w-6 h-6 text-brand-orange mb-3" />
          <h3 className="text-white font-medium mb-1">Connect</h3>
          <p className="text-sm text-white/40">Build your network of worldwide adventurers.</p>
        </div>
      </div>

    </div>
  );
});
