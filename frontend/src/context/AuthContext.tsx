import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  settings?: { theme: string };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasCheckedHash = useRef(false);

  const exchangeSession = async (sessionId: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) throw new Error('Session exchange failed');
    const data = await res.json();
    await AsyncStorage.setItem('session_token', data.session_token);
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  };

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Not authenticated');
      const userData = await res.json();
      setUser(userData);
      setIsAuthenticated(true);
    } catch {
      await AsyncStorage.removeItem('session_token');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !hasCheckedHash.current) {
      hasCheckedHash.current = true;
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');
        if (sessionId) {
          window.history.replaceState(null, '', window.location.pathname);
          exchangeSession(sessionId)
            .then(() => setIsLoading(false))
            .catch(() => {
              setIsAuthenticated(false);
              setIsLoading(false);
            });
          return;
        }
      }
    }
    checkAuth();
  }, []);

  const login = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirectUrl = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      const redirectUrl = Linking.createURL('/');
      const result = await WebBrowser.openAuthSessionAsync(
        `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`,
        redirectUrl
      );
      if (result.type === 'success' && result.url) {
        const hashPart = result.url.split('#')[1];
        if (hashPart) {
          const params = new URLSearchParams(hashPart);
          const sessionId = params.get('session_id');
          if (sessionId) {
            await exchangeSession(sessionId);
          }
        }
      }
    }
  };

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
    } catch {}
    await AsyncStorage.removeItem('session_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
