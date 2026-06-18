import { UserAccount, UserTier } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_KEY_ACTIVE = 'urtc_active_user';
const STORAGE_KEY_STATS = 'urtc_stats_nerd';
const STORAGE_KEY_REMEMBER = 'urtc_remember_me';

export const getStatsForNerds = (): boolean => {
  return localStorage.getItem(STORAGE_KEY_STATS) === 'true';
};

export const setStatsForNerds = (enabled: boolean) => {
  localStorage.setItem(STORAGE_KEY_STATS, String(enabled));
};

export const register = async (username: string, passwordHash: string, email?: string, promoOptIn?: boolean): Promise<UserAccount> => {
  if (!email) throw new Error("Email is required for registration.");
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: passwordHash,
    options: {
      data: {
        username,
      }
    }
  });

  if (error) throw new Error(error.message);

  const newUser: UserAccount = {
    id: data.user?.id || Date.now().toString(),
    username,
    passwordHash: '',
    email,
    promoOptIn,
    tier: UserTier.Free, 
    savedTrips: [],
    xp: 0,
    level: 1
  };
  
  setActiveUser(newUser);
  return newUser;
};

export const login = async (email: string, passwordHash: string): Promise<UserAccount> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: passwordHash,
  });

  if (error) throw new Error(error.message);
  
  // Fetch profile
  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();

  const user: UserAccount = {
    id: data.user.id,
    username: profileData?.username || data.user.email?.split('@')[0] || 'Traveler',
    passwordHash: '',
    email: data.user.email,
    tier: profileData?.tier as UserTier || UserTier.Free,
    savedTrips: [],
    xp: profileData?.xp || 0,
    level: profileData?.level || 1
  };

  setActiveUser(user);
  setRememberMe(true);
  return user;
};

export const redeemAccessCode = (code: string): UserAccount => {
  const cleanCode = code.toUpperCase().trim();
  let tier: UserTier = UserTier.Guest;
  let name = "Traveler";

  switch (cleanCode) {
    case '1': tier = UserTier.Guest; name = "Guest User"; break; 
    case '2': tier = UserTier.Free; name = "Silver User"; break; 
    case '3': tier = UserTier.Diamond; name = "Diamond User"; break; 
    case '4': tier = UserTier.Professional; name = "Professional User"; break; 
    case '070512': tier = UserTier.Dev; name = "Developer"; break; 
    default: throw new Error("Invalid Access Code");
  }

  const tempUser: UserAccount = {
    id: `code-${Date.now()}`,
    username: name,
    passwordHash: 'access-code',
    tier: tier,
    savedTrips: [],
    xp: 0,
    level: 1
  };

  setActiveUser(tempUser);
  return tempUser;
};

export const logout = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem(STORAGE_KEY_ACTIVE);
  localStorage.removeItem(STORAGE_KEY_REMEMBER);
};

export const setRememberMe = (remember: boolean) => {
  localStorage.setItem(STORAGE_KEY_REMEMBER, String(remember));
};

export const getRememberMe = (): boolean => {
  return localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
};

export const getActiveUser = (): UserAccount => {
  const data = localStorage.getItem(STORAGE_KEY_ACTIVE);
  if (data) return JSON.parse(data);

  return {
    id: 'guest',
    username: 'Guest',
    passwordHash: '',
    tier: UserTier.Guest,
    savedTrips: [],
    xp: 0,
    level: 1
  };
};

export const setActiveUser = (user: UserAccount | null) => {
  if (user) {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }
};

export const updateUserTier = async (userId: string, tier: UserTier) => {
  // Update local session
  const active = getActiveUser();
  if (active && active.id === userId) {
    active.tier = tier;
    setActiveUser(active);
  }

  // Update backend if real user
  if (!userId.startsWith('guest') && !userId.startsWith('code-')) {
    await supabase.from('profiles').update({ tier }).eq('id', userId);
  }
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserAccount>) => {
  const active = getActiveUser();
  if (active && active.id === userId) {
    const updatedUser = { ...active, ...profileData };
    setActiveUser(updatedUser);
  }

  if (!userId.startsWith('guest') && !userId.startsWith('code-')) {
    await supabase.from('profiles').update({
      avatar_url: profileData.avatarUrl,
      bio: profileData.bio,
      is_private: profileData.isPrivate
    }).eq('id', userId);
  }
};

export const addXp = async (amount: number): Promise<{ leveledUp: boolean, newLevel: number }> => {
  const user = getActiveUser();
  const oldLevel = user.level || 1;
  const newXp = (user.xp || 0) + amount;
  
  const newLevel = Math.floor(Math.sqrt(newXp / 50)) + 1;
  const leveledUp = newLevel > oldLevel;

  user.xp = newXp;
  user.level = newLevel;
  setActiveUser(user);

  if (!user.id.startsWith('guest') && !user.id.startsWith('code-')) {
    await supabase.from('profiles').update({ xp: newXp, level: newLevel }).eq('id', user.id);
  }

  return { leveledUp, newLevel };
};