import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Play, RotateCcw, Crown, Shirt, ArrowLeft, Cookie, Zap, Circle, Hexagon, Star, Grid3X3, Ghost, Wind, Brain, Lock, Ban, Box, Snowflake, Link as LinkIcon, Bomb } from 'lucide-react';

interface GameProps {
   onBack: () => void;
   onScore: (score: number, treats: number) => void;
   unlockedCosmetics: { hat: boolean; cape: boolean };
}

// --- GAME 3: ESCAPE THE PUPPIES (8-Bit Flappy Style) ---
const EscapeThePuppiesGame: React.FC<GameProps> = ({ onBack, onScore }) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
   const [score, setScore] = useState(0);
   const [gravityInverted, setGravityInverted] = useState(false);
   const state = useRef({ cookie: { x: 50, y: 300, dy: 0 }, obstacles: [] as any[], frame: 0, score: 0 });
   const reqId = useRef(0);

   const init = () => {
       state.current = { cookie: { x: 50, y: 300, dy: 0 }, obstacles: [{ x: 400, gapTop: 200, passed: false }], frame: 0, score: 0 };
       setScore(0);
       setGravityInverted(false);
       setGameState('playing');
   };

   const loop = () => {
       if (gameState !== 'playing') return;
       const cvs = canvasRef.current;
       const ctx = cvs?.getContext('2d');
       if (!cvs || !ctx) return;
       const width = cvs.width;
       const height = cvs.height;
       const s = state.current;
       const g = gravityInverted ? -0.4 : 0.4;
       s.cookie.dy += g;
       s.cookie.y += s.cookie.dy;
       s.obstacles.forEach((o: any) => o.x -= 3);
       if (s.obstacles[s.obstacles.length - 1].x < width - 200) {
           s.obstacles.push({ x: width, gapTop: Math.random() * (height - 210) + 50, passed: false });
       }
       if (s.obstacles[0].x < -50) s.obstacles.shift();
       
       ctx.fillStyle = gravityInverted ? '#2D0A31' : '#0F0518';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#8B5A2B';
       s.obstacles.forEach((o: any) => {
           ctx.fillRect(o.x, 0, 50, o.gapTop);
           ctx.fillRect(o.x, o.gapTop + 160, 50, height - (o.gapTop + 160));
       });
       ctx.fillStyle = '#D69E2E';
       ctx.beginPath();
       ctx.arc(s.cookie.x, s.cookie.y, 15, 0, Math.PI*2);
       ctx.fill();

       if (s.cookie.y < 0 || s.cookie.y > height) setGameState('gameover');
       s.obstacles.forEach((o: any) => {
           if (s.cookie.x + 15 > o.x && s.cookie.x - 15 < o.x + 50 && (s.cookie.y - 15 < o.gapTop || s.cookie.y + 15 > o.gapTop + 160)) setGameState('gameover');
           if (!o.passed && s.cookie.x > o.x + 50) { o.passed = true; s.score++; setScore(s.score); }
       });

       reqId.current = requestAnimationFrame(loop);
   };

   useEffect(() => { if (gameState === 'playing') reqId.current = requestAnimationFrame(loop); return () => cancelAnimationFrame(reqId.current); }, [gameState]);
   useEffect(() => {
       const handleResize = () => { if(canvasRef.current) { canvasRef.current.width = canvasRef.current.offsetWidth; canvasRef.current.height = canvasRef.current.offsetHeight; } };
       window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize);
   }, []);

   return (
       <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl flex flex-col touch-none" onClick={() => { if(gameState==='playing') state.current.cookie.dy = gravityInverted ? 7 : -7; }}>
           <canvas ref={canvasRef} className="w-full h-full touch-none" />
           <button onClick={onBack} className="absolute top-4 left-4 p-2 bg-black/40 rounded-full text-white z-50"><ArrowLeft /></button>
           <div className="absolute top-4 right-4 text-white font-black text-4xl drop-shadow-md z-10 pointer-events-none font-mono">{score}</div>
           {gameState === 'start' && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-40"><h2 className="text-3xl font-black mb-4">ESCAPE THE PUPPIES</h2><button onClick={init} className="bg-purple-600 px-8 py-4 rounded-xl font-bold">START</button></div>}
           {gameState === 'gameover' && <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-40"><h2 className="text-4xl font-black text-red-500 mb-4">GAME OVER</h2><button onClick={init} className="bg-white text-black px-8 py-4 rounded-xl font-bold">RETRY</button></div>}
       </div>
   );
};

export const FunView: React.FC = () => {
   const [activeGame, setActiveGame] = useState<'menu' | 'escape'>('menu');
   const [highScores, setHighScores] = useState({ escape: 0 });
   
   useEffect(() => {
       const saved = localStorage.getItem('urtc_arcade_data');
       if (saved) setHighScores(JSON.parse(saved).highScores || { escape: 0 });
   }, []);

   if (activeGame === 'escape') return <EscapeThePuppiesGame onBack={() => setActiveGame('menu')} onScore={(s) => { if(s > highScores.escape) { const newScores = {...highScores, escape: s}; setHighScores(newScores); localStorage.setItem('urtc_arcade_data', JSON.stringify({ highScores: newScores })); }}} unlockedCosmetics={{ hat: false, cape: false }} />;

   return (
       <div className="h-full flex flex-col p-4 pb-24 space-y-6 animate-in fade-in">
           <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
               <div><h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-purple-500 italic tracking-tighter">APOLLO'S ARCADE</h2><p className="text-xs text-gray-400 font-bold">BETA 4.1</p></div>
           </div>
           <button onClick={() => setActiveGame('escape')} className="relative group overflow-hidden rounded-3xl h-40 border-4 border-white/10 hover:border-purple-500/50 transition-all shadow-2xl active:scale-[0.98]">
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-black group-hover:scale-110 transition duration-700"></div>
               <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 to-transparent flex flex-col items-start text-left">
                   <div className="bg-purple-600 px-2 py-0.5 rounded text-[10px] font-black uppercase text-white mb-1 font-mono">8-BIT</div>
                   <h3 className="text-2xl font-black text-white italic tracking-tighter leading-none font-mono">ESCAPE PUPPIES</h3>
                   <p className="text-xs text-gray-300 mt-1 font-mono">Best: {highScores.escape}</p>
               </div>
           </button>
       </div>
   );
};
