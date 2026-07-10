import { UserAccount, UserTier } from '../types';
import { auth, db } from './firebaseClient';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';

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
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, passwordHash);
    const firebaseUser = userCredential.user;

    const newUser: UserAccount = {
      id: firebaseUser.uid,
      username,
      passwordHash: '',
      email,
      promoOptIn,
      tier: UserTier.Free, 
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days of Diamond free
      savedTrips: []
    };

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    
    // Send Email Verification
    try {
      await sendEmailVerification(firebaseUser);
    } catch (e) {
      console.warn("Failed to send verification email:", e);
    }
    
    setActiveUser(newUser);
    return newUser;
  } catch (err: any) {
    if (err.code === 'auth/operation-not-allowed') {
        throw new Error('Email/Password authentication is disabled in your Firebase console. Please enable it in Build > Authentication.');
    }
    if (err.code === 'auth/email-already-in-use') throw new Error('That email is already registered.');
    if (err.code === 'auth/weak-password') throw new Error('Password should be at least 6 characters.');
    if (err.code === 'auth/invalid-email') throw new Error('Invalid email address.');
    throw new Error('Registration failed. Please try again.');
  }
};

export const login = async (email: string, passwordHash: string): Promise<UserAccount> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, passwordHash);
    const firebaseUser = userCredential.user;
    
    // Fetch profile from Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    const profileData = userDoc.exists() ? userDoc.data() : null;

    const user: UserAccount = {
      id: firebaseUser.uid,
      username: profileData?.username || firebaseUser.email?.split('@')[0] || 'Traveler',
      passwordHash: '',
      email: firebaseUser.email || email,
      tier: profileData?.tier as UserTier || UserTier.Free,
      savedTrips: []
    };

    setActiveUser(user);
    setRememberMe(true);
    return user;
  } catch (err: any) {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
      throw new Error('Invalid email or password.');
    }
    throw new Error('Login failed. Please check your connection and try again.');
  }
};

const handleSocialLogin = async (provider: any): Promise<UserAccount> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    
    // Fetch or Create profile from Firestore
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    
    let user: UserAccount;
    
    if (userDoc.exists()) {
      const profileData = userDoc.data();
      user = {
        id: firebaseUser.uid,
        username: profileData?.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Traveler',
        passwordHash: '',
        email: firebaseUser.email || undefined,
        tier: profileData?.tier as UserTier || UserTier.Free,
        trialEndsAt: profileData?.trialEndsAt,
        savedTrips: []
      };
    } else {
      // New user
      user = {
        id: firebaseUser.uid,
        username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Traveler',
        passwordHash: '',
        email: firebaseUser.email || undefined,
        tier: UserTier.Free,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days of Diamond free
        savedTrips: []
      };
      await setDoc(userRef, user);
    }

    setActiveUser(user);
    setRememberMe(true);
    return user;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled.');
    }
    throw new Error('Social login failed. ' + err.message);
  }
};

export const loginWithGoogle = () => handleSocialLogin(new GoogleAuthProvider());

export const loginWithApple = () => handleSocialLogin(new OAuthProvider('apple.com'));

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
    case 'QRT922': tier = UserTier.Dev; name = "Hello User"; break; 
    default: throw new Error("Invalid Access Code");
  }

  const tempUser: UserAccount = {
    id: `code-${Date.now()}`,
    username: name,
    passwordHash: 'access-code',
    tier: tier,
    savedTrips: []
  };

  setActiveUser(tempUser);
  return tempUser;
};

export const logout = async () => {
  await signOut(auth);
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
    savedTrips: []
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
    await updateDoc(doc(db, 'users', userId), { tier });
  }
};

export const updateUserProfile = async (userId: string, profileData: Partial<UserAccount>) => {
  const active = getActiveUser();
  if (active && active.id === userId) {
    const updatedUser = { ...active, ...profileData };
    setActiveUser(updatedUser);
  }

  if (!userId.startsWith('guest') && !userId.startsWith('code-')) {
    await updateDoc(doc(db, 'users', userId), {
      avatarUrl: profileData.avatarUrl || null,
      bio: profileData.bio || null,
      isPrivate: profileData.isPrivate || false
    });
  }
};

// ── Diamond access: paid tier OR an active free trial ──
export const hasDiamondAccess = (user: UserAccount | null): boolean => {
  if (!user) return false;
  if (user.tier === UserTier.Diamond || user.tier === UserTier.Professional || user.tier === UserTier.Dev) return true;
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return true;
  return false;
};

export const trialDaysLeft = (user: UserAccount | null): number => {
  if (!user?.trialEndsAt) return 0;
  const ms = new Date(user.trialEndsAt).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
};
