// frontend/src/components/ProfilePanel.jsx

import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Settings, LogOut, User, Shield, TrendingUp, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './ProfilePanel.css';

const fmt = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const ProfilePanel = ({ onClose }) => {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const panelRef  = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
    onClose();
  };

  const go = (path) => { navigate(path); onClose(); };

  return (
    <div className="profile-panel" ref={panelRef}>
      {/* Header */}
      <div className="profile-panel__header">
        <div className="profile-avatar-lg">
          {user?.initials || user?.name?.slice(0, 2).toUpperCase() || 'U'}
        </div>
        <button className="profile-close" onClick={onClose}><X size={16} /></button>
      </div>

      {/* User info */}
      <div className="profile-info">
        <h3 className="profile-name">{user?.name}</h3>
        <p className="profile-email">{user?.email}</p>
        <div className="profile-plan">
          {user?.plan === 'premium' ? <Crown size={12} /> : <Shield size={12} />}
          <span>{user?.plan === 'premium' ? 'Premium' : 'Free'} Plan</span>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat__value">{user?.currency || 'INR'}</span>
          <span className="profile-stat__label">Currency</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">
            {user?.monthlyIncome ? fmt(user.monthlyIncome, user.currency) : '—'}
          </span>
          <span className="profile-stat__label">Monthly Income</span>
        </div>
        {user?.financialScore?.score && (
          <div className="profile-stat">
            <span className="profile-stat__value" style={{ color: 'var(--color-success)' }}>
              {user.financialScore.score}
            </span>
            <span className="profile-stat__label">Score</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="profile-actions">
        <button className="profile-action" onClick={() => go('/settings')}>
          <Settings size={16} /> Account Settings
        </button>
        <button className="profile-action" onClick={() => go('/goals')}>
          <TrendingUp size={16} /> Financial Goals
        </button>
        <button className="profile-action profile-action--danger" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePanel;