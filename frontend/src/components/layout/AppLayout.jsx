// frontend/src/components/layout/AppLayout.jsx

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, BarChart2, Users, UserCheck,
  Target, Sparkles, Settings, LogOut, Menu, X, Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import FoxMascot from '../FoxMascot';
import NotificationsPanel from '../NotificationsPanel';
import ProfilePanel from '../ProfilePanel';
import MonthlyIncomePopup, { shouldShowIncomePopup } from '../MonthlyIncomePopup';
import toast from 'react-hot-toast';
import './AppLayout.css';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transactions' },
  { to: '/analytics',    icon: BarChart2,       label: 'Analytics' },
  { to: '/groups',       icon: Users,           label: 'Groups' },
  { to: '/friends',      icon: UserCheck,       label: 'Friends' },
  { to: '/goals',        icon: Target,          label: 'Goals' },
  { to: '/ai-assistant', icon: Sparkles,        label: 'AI Assistant' },
  { to: '/settings',     icon: Settings,        label: 'Settings' },
];

const AppLayout = () => {
  const { user, logout }       = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs,  setShowNotifs]  = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showIncome,  setShowIncome]  = useState(false);
  const [notifCount,  setNotifCount]  = useState(0);

  useEffect(() => {
    if (shouldShowIncomePopup()) {
      const t = setTimeout(() => setShowIncome(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const mod = await import('../NotificationsPanel');
        if (mod.getNotifCount) {
          const c = await mod.getNotifCount();
          setNotifCount(c);
        }
      } catch {}
    };
    fetchCount();
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const toggleNotifs = () => {
    setShowNotifs(p => !p);
    setShowProfile(false);
    if (!showNotifs) setNotifCount(0);
  };

  const toggleProfile = () => {
    setShowProfile(p => !p);
    setShowNotifs(false);
  };

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__logo" onClick={() => { navigate("/dashboard"); setSidebarOpen(false); }} style={{ cursor: "pointer" }} title="Go to Dashboard">
          <div className="sidebar__logo-icon">SW</div>
          <span className="sidebar__logo-text">SpendWise</span>
          <button className="sidebar__close" onClick={() => setSidebarOpen(false)}><X size={18}/></button>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <Icon size={17}/><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__user">
          <div className="sidebar__avatar">
            {user?.initials || user?.name?.slice(0,2).toUpperCase() || 'U'}
          </div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{user?.name || 'User'}</span>
            <span className="sidebar__user-plan">{user?.plan || 'free'} plan</span>
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Logout">
            <LogOut size={15}/>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-wrapper">
        <header className="header" style={{ position: 'relative' }}>

          {/* LEFT — hamburger + brand */}
          <div className="header__left">
            <button className="header__menu" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button>
            <div className="header__brand">
              <span>SpendWise</span>
            </div>
          </div>

          {/* CENTRE — 🦊 Fox mascot */}
          <div className="header__centre">
            <FoxMascot />
          </div>

          {/* RIGHT — theme, bell, avatar */}
          <div className="header__right">
            <button className="header__btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button
              className={`header__btn header__btn--icon ${showNotifs ? 'active' : ''}`}
              onClick={toggleNotifs}
              title="Notifications"
            >
              <Bell size={18}/>
              {notifCount > 0 && (
                <span className="notif-dot">{notifCount > 9 ? '9+' : notifCount}</span>
              )}
            </button>

            <button
              className={`header__avatar-btn ${showProfile ? 'active' : ''}`}
              onClick={toggleProfile}
              title={user?.name}
            >
              {user?.initials || user?.name?.slice(0,2).toUpperCase() || 'U'}
            </button>
          </div>

          {/* Panels */}
          {showNotifs  && <NotificationsPanel onClose={() => setShowNotifs(false)}/>}
          {showProfile && <ProfilePanel       onClose={() => setShowProfile(false)}/>}
        </header>

        <main className="main-content">
          <div key={location.pathname} className="page-transition">
            <Outlet/>
          </div>
        </main>
      </div>

      {showIncome && <MonthlyIncomePopup onClose={() => setShowIncome(false)}/>}
    </div>
  );
};

export default AppLayout;