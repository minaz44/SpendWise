// frontend/src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authAPI from '../api/auth.api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('spendwise_token');
    const savedUser  = localStorage.getItem('spendwise_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('spendwise_token');
        localStorage.removeItem('spendwise_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { user: newUser, accessToken } = response.data;
    localStorage.setItem('spendwise_token', accessToken);
    localStorage.setItem('spendwise_user', JSON.stringify(newUser));
    setToken(accessToken);
    setUser(newUser);
    return newUser;
  }, []);

  const register = useCallback(async (name, email, password, currency) => {
    // monthlyIncome removed from registration — set via monthly popup instead
    const response = await authAPI.register({ name, email, password, currency, monthlyIncome: 0 });
    const { user: newUser, accessToken } = response.data;
    localStorage.setItem('spendwise_token', accessToken);
    localStorage.setItem('spendwise_user', JSON.stringify(newUser));
    setToken(accessToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('spendwise_token');
    localStorage.removeItem('spendwise_user');
    setToken(null);
    setUser(null);
  }, []);

  // ── KEY FIX: updateUser now always saves to localStorage and merges properly ──
  const updateUser = useCallback((updatedUser) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedUser };
      localStorage.setItem('spendwise_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  // ── Refresh user from server (for when data changes externally) ──
  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.getMe();
      const freshUser = res.data.user;
      localStorage.setItem('spendwise_user', JSON.stringify(freshUser));
      setUser(freshUser);
      return freshUser;
    } catch { return null; }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      isAuthenticated: Boolean(token && user),
      login, register, logout, updateUser, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};