import { generateAiNote } from './services/geminiService';
generateAiNote('Paris', 'France', 'Test Trip').then(console.log).catch(console.error);
