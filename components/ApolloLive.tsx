

import React, { useEffect, useState, useRef } from 'react';
import { X, Mic, MicOff, Activity, Volume2, WifiOff, Share } from 'lucide-react';
import { EnhancedApolloDogIcon } from './ApolloDog';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { API_KEYS } from "../config";

interface ApolloLiveProps {
 isOpen: boolean;
 onClose: () => void;
}

export const ApolloLive: React.FC<ApolloLiveProps> = ({ isOpen, onClose }) => {
 const [status, setStatus] = useState('Initializing...');
 const [isUserSpeaking, setIsUserSpeaking] = useState(false);
 const [aiSpeaking, setAiSpeaking] = useState(false);
 const [volume, setVolume] = useState<number[]>(new Array(5).fill(10));
 const [error, setError] = useState<string | null>(null);
 const [transcript, setTranscript] = useState<string>('');

 // Refs for audio handling to avoid re-renders
 const audioContextRef = useRef<AudioContext | null>(null);
 const inputContextRef = useRef<AudioContext | null>(null);
 const nextStartTimeRef = useRef<number>(0);
 const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
 const streamRef = useRef<MediaStream | null>(null);
 const processorRef = useRef<ScriptProcessorNode | null>(null);
 const analyzerRef = useRef<AnalyserNode | null>(null);
 const visualizerFrameRef = useRef<number>(0);
 const sessionPromiseRef = useRef<Promise<any> | null>(null);

 // Cleanup function to stop audio and close connections
 const cleanup = () => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current);
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
 };

 // Audio Processing Helpers
 const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
 };

 const base64EncodeAudio = (int16Array: Int16Array) => {
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
 };

  const decodeAudioData = async (
      base64String: string, 
      ctx: AudioContext
  ): Promise<AudioBuffer> => {
    const binaryString = window.atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert PCM to AudioBuffer
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
       float32Data[i] = int16Data[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.copyToChannel(float32Data, 0);
    return buffer;
  };

 useEffect(() => {
   if (!isOpen) return;

   const startSession = async () => {
     try {
       setStatus('Connecting to Apollo...');
       const ai = new GoogleGenAI({ apiKey: API_KEYS.GEMINI });
       
       // 1. Setup Audio Output Context (24kHz for Gemini)
       audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
       
       // Setup Analyzer for Visualizer
       analyzerRef.current = audioContextRef.current.createAnalyser();
       analyzerRef.current.fftSize = 32;
       
       // 2. Setup Input Stream (16kHz for Gemini)
       inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
       streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
       
       const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
       processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
       
       source.connect(processorRef.current);
       processorRef.current.connect(inputContextRef.current.destination);

       // 3. Connect to Gemini Live API
       sessionPromiseRef.current = ai.live.connect({
           model: 'gemini-2.5-flash-native-audio-preview-09-2025',
           config: {
               responseModalities: [Modality.AUDIO],
               speechConfig: {
                   // Zephyr is calm, Puck is more energetic/playful male.
                   voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
               },
               systemInstruction: `You are Apollo, the ÜrTC travel companion. You are a **cool, energetic young adult male** who just happens to be a **dog**.
               - **Vibe**: Fun-loving, witty, and loyal.
               - **Dog Mannerisms**: Use slang like "pawsome", "ruff day", "sniffing around".
               - **Humor**: You crack travel jokes constantly.
               - **Helpful**: You know your stuff about flights and budgets, but you explain it like a bro.`,
           },
           callbacks: {
               onopen: () => {
                   setStatus('Listening');
                   nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
               },
               onmessage: async (msg: LiveServerMessage) => {
                   // Handle Transcript
                   const textData = msg.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
                   if (textData) {
                       setTranscript(prev => prev + textData);
                   }

                   // Handle Audio Output
                   const audioData = msg.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
                   if (audioData && audioContextRef.current) {
                       setAiSpeaking(true);
                       const buffer = await decodeAudioData(audioData, audioContextRef.current);
                       
                       const source = audioContextRef.current.createBufferSource();
                       source.buffer = buffer;
                       
                       // Connect to analyzer for visuals, then to destination
                       if (analyzerRef.current) {
                           source.connect(analyzerRef.current);
                           analyzerRef.current.connect(audioContextRef.current.destination);
                       } else {
                           source.connect(audioContextRef.current.destination);
                       }

                       // Gapless playback scheduling
                       const now = audioContextRef.current.currentTime;
                       // Ensure we don't schedule in the past, but try to keep it continuous
                       const startTime = Math.max(now, nextStartTimeRef.current);
                       
                       source.start(startTime);
                       nextStartTimeRef.current = startTime + buffer.duration;
                       
                       sourcesRef.current.add(source);
                       source.onended = () => {
                           sourcesRef.current.delete(source);
                           if (sourcesRef.current.size === 0) setAiSpeaking(false);
                       };
                   }

                   // Handle Interruptions
                   if (msg.serverContent?.interrupted) {
                       sourcesRef.current.forEach(s => s.stop());
                       sourcesRef.current.clear();
                       nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
                       setAiSpeaking(false);
                   }
               },
               onclose: () => {
                   setStatus('Disconnected');
               },
               onerror: (e) => {
                   console.error(e);
                   setError("Connection lost");
               }
           }
       });

       // 4. Handle Input Audio Streaming
       processorRef.current.onaudioprocess = (e) => {
           const inputData = e.inputBuffer.getChannelData(0);
           
           // Simple VAD (Voice Activity Detection) for UI
           let sum = 0;
           for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
           const rms = Math.sqrt(sum / inputData.length);
           setIsUserSpeaking(rms > 0.02);

           // Convert and Send
           const pcmData = floatTo16BitPCM(inputData);
           const base64Data = base64EncodeAudio(pcmData);
           
           if (sessionPromiseRef.current) {
               sessionPromiseRef.current.then(session => {
                   session.sendRealtimeInput({
                       media: {
                           mimeType: 'audio/pcm;rate=16000',
                           data: base64Data
                       }
                   });
               });
           }
       };
       
     } catch (err: any) {
       console.error("Live Error:", err);
       setError(err.message || "Failed to start audio session");
     }
   };

   startSession();

   // Visualizer Loop
   const visualize = () => {
       if (analyzerRef.current) {
           const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
           analyzerRef.current.getByteFrequencyData(dataArray);
           
           // Extract a few bins for the 5 bars
           const bars = [
               dataArray[2],
               dataArray[4],
               dataArray[6],
               dataArray[4],
               dataArray[2]
           ].map(val => Math.max(10, val / 255 * 60)); // Scale to height
           
           setVolume(bars);
       } else if (isUserSpeaking) {
            // Fallback user speaking visual
            setVolume(prev => prev.map(() => Math.random() * 30 + 15));
       } else {
            // Idle
            setVolume([10, 10, 10, 10, 10]);
       }
       visualizerFrameRef.current = requestAnimationFrame(visualize);
   };
   visualizerFrameRef.current = requestAnimationFrame(visualize);

   return () => cleanup();
 }, [isOpen]);

 if (!isOpen) return null;

 return (
   <div className="fixed inset-0 z-[60] bg-brand-dark/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
     <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 rounded-full hover:bg-white/20 transition text-white"><X size={24} /></button>
     
     {error ? (
         <div className="flex flex-col items-center gap-4 text-red-400">
             <WifiOff size={48} />
             <p>{error}</p>
             <button onClick={onClose} className="bg-white/10 px-6 py-2 rounded-full text-white">Close</button>
         </div>
     ) : (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm space-y-12">
            
            {/* Audio Visualizer */}
            <div className="h-20 flex items-center justify-center gap-3">
                {volume.map((h, i) => (
                    <div 
                        key={i} 
                        className={`w-3 rounded-full transition-all duration-75 ease-linear ${aiSpeaking ? 'bg-brand-orange shadow-[0_0_15px_rgba(255,107,53,0.8)]' : 'bg-gray-500/50'}`} 
                        style={{ height: `${h}px` }} 
                    />
                ))}
            </div>

            <div className="relative">
                {/* Status Glow */}
                <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-500 ${aiSpeaking ? 'bg-brand-orange/40 scale-110' : (isUserSpeaking ? 'bg-brand-blue/30' : 'bg-white/5')}`} />
                
                <div className="w-56 h-56 rounded-full border-4 border-white/10 flex items-center justify-center bg-brand-dark relative z-10 shadow-2xl overflow-hidden">
                    <EnhancedApolloDogIcon size={160} interactive={false} wagOnHover={false} className={aiSpeaking ? 'animate-bounce' : ''} />
                </div>
                
                {/* Status Badge */}
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg border border-white/10 z-20 flex items-center gap-2 transition-colors ${aiSpeaking ? 'bg-brand-orange text-white' : (isUserSpeaking ? 'bg-brand-blue text-white' : 'bg-brand-surface text-gray-400')}`}>
                    {aiSpeaking ? <Volume2 size={12} className="animate-pulse" /> : (isUserSpeaking ? <Mic size={12} /> : <Activity size={12} />)}
                    {aiSpeaking ? 'Apollo Speaking' : (isUserSpeaking ? 'Listening...' : status)}
                </div>
            </div>

            <p className="text-gray-500 text-sm font-medium max-w-[200px] text-center leading-relaxed">
                Start speaking. Apollo is listening using Gemini Live.
            </p>
            
            {transcript && (
                <button 
                    onClick={() => {
                        if (navigator.share) {
                            navigator.share({
                                title: "Apollo's Recommendations",
                                text: `Here is what Apollo suggested:\n\n${transcript}`
                            }).catch(console.error);
                        } else {
                            alert("Sharing is not supported on this device/browser.");
                        }
                    }}
                    className="mt-4 flex items-center gap-2 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 px-4 py-2 rounded-full text-xs font-bold transition-colors border border-brand-orange/20 shadow-sm"
                >
                    <Share size={14} />
                    Share Apollo's Advice
                </button>
            )}
        </div>
     )}
   </div>
 );
};
