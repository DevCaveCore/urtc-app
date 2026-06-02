import React from 'react';
import { AboutView } from './AboutView';
import { UserAccount } from '../types';

interface ExtrasViewProps {
 currentUser: UserAccount;
 onUserUpdate: (user: UserAccount) => void;
 onUnlockFun: () => void;
 textSize: 'sm' | 'base' | 'lg';
 onTextSizeChange: (size: 'sm' | 'base' | 'lg') => void;
}

export const ExtrasView: React.FC<ExtrasViewProps> = ({ currentUser, onUserUpdate, onUnlockFun, textSize, onTextSizeChange }) => {
 return (
   <div className="h-full flex flex-col pb-24">
     <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
       <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-orange to-white">Settings & Extras</h2>
     </div>
     <AboutView currentUser={currentUser} onUserUpdate={onUserUpdate} textSize={textSize} onTextSizeChange={onTextSizeChange} />
   </div>
 );
};