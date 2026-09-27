import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types/auth';

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  activeShift: number | null;
  setActiveShift: (shift: number | null) => Promise<void>;
  activeLeader: UserProfile | null;
  setActiveLeader: (leader: UserProfile | null) => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  activeShift: null,
  setActiveShift: async () => {},
  activeLeader: null,
  setActiveLeader: async () => {},
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeShift, setActiveShiftState] = useState<number | null>(null);
  const [activeLeader, setActiveLeaderState] = useState<UserProfile | null>(null);

  const setActiveShift = async (shift: number | null) => {
    setActiveShiftState(shift);
    if (shift !== null) {
      await AsyncStorage.setItem('ongoingShift', shift.toString());
    } else {
      await AsyncStorage.removeItem('ongoingShift');
    }
  };

  const setActiveLeader = async (leader: UserProfile | null) => {
    setActiveLeaderState(leader);
    if (leader !== null) {
      await AsyncStorage.setItem('ongoingLeader', JSON.stringify(leader));
    } else {
      await AsyncStorage.removeItem('ongoingLeader');
    }
  };

  const fetchProfile = async (currentUser: User) => {
    try {
      if (!currentUser.email) {
        console.error('No email found for user');
        setProfile(null);
        return;
      }
      
      const q = query(collection(db, 'users'), where('email', '==', currentUser.email));
      const querySnapshot = await getDocs(q);
        
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        setProfile({
          id: docSnap.id,
          ...data
        } as UserProfile);
      } else {
        console.error('No profile found for user:', currentUser.email);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;
      
      setIsLoading(true);
      setUser(currentUser);
      
      if (currentUser) {
        if (!profile || profile.email !== currentUser.email) {
          await fetchProfile(currentUser);
        }
        
        try {
          // We intentionally DO NOT load ongoingShift into activeShiftState here.
          // This forces the user to go through the select-shift screen on app restart,
          // while keeping the ongoing data safe in AsyncStorage for validation.
        } catch (e) {
          console.error('Error loading persisted shift/leader:', e);
        }
      } else {
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setActiveShiftState(null);
      setActiveLeaderState(null);
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    isLoading,
    activeShift,
    setActiveShift,
    activeLeader,
    setActiveLeader,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
