// frontend/src/App.jsx

import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import SplashScreen from './components/SplashScreen';
import './styles/global.css';

const Login        = React.lazy(() => import('./pages/Login'));
const Register     = React.lazy(() => import('./pages/Register'));
const Dashboard    = React.lazy(() => import('./pages/Dashboard'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Analytics    = React.lazy(() => import('./pages/Analytics'));
const Groups       = React.lazy(() => import('./pages/Groups'));
const Friends      = React.lazy(() => import('./pages/Friends'));
const Goals        = React.lazy(() => import('./pages/Goals'));
const AIAssistant  = React.lazy(() => import('./pages/AIAssistant'));
const Settings     = React.lazy(() => import('./pages/Settings'));
const NotFound     = React.lazy(() => import('./pages/NotFound'));
const AppLayout      = React.lazy(() => import('./components/layout/AppLayout'));
const ProtectedRoute = React.lazy(() => import('./components/common/ProtectedRoute'));

const LoadingScreen = () => (
  <div style={{
    display:'flex',alignItems:'center',justifyContent:'center',
    height:'100vh',background:'#0D0D0D',flexDirection:'column',gap:'12px',
  }}>
    <div style={{
      width:28,height:28,
      border:'3px solid rgba(29,158,117,0.2)',borderTopColor:'#1D9E75',
      borderRadius:'50%',animation:'spin 0.8s linear infinite',
    }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const App = () => {
  const [showSplash, setShowSplash] = useState(
    !sessionStorage.getItem('sw_splash_shown')
  );

  useEffect(() => { document.title = 'SpendWise — AI Finance'; }, []);

  if (showSplash) {
    return (
      <ThemeProvider>
        <SplashScreen onComplete={() => {
          sessionStorage.setItem('sw_splash_shown', '1');
          setShowSplash(false);
        }} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                },
                success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#FF6B6B', secondary: '#fff' } },
              }}
            />
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/"             element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard"    element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/analytics"    element={<Analytics />} />
                  <Route path="/groups"       element={<Groups />} />
                  <Route path="/friends"      element={<Friends />} />
                  <Route path="/goals"        element={<Goals />} />
                  <Route path="/ai-assistant" element={<AIAssistant />} />
                  <Route path="/settings"     element={<Settings />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;