// frontend/src/pages/Settings.jsx

import React, { useState } from 'react';
import { User, Bell, Shield, Smartphone, Save, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import authAPI from '../api/auth.api';
import toast from 'react-hot-toast';
import './Settings.css';

const CURRENCIES = [
  { code: 'INR', label: '₹ INR — Indian Rupee' },
  { code: 'USD', label: '$ USD — US Dollar' },
  { code: 'EUR', label: '€ EUR — Euro' },
  { code: 'GBP', label: '£ GBP — British Pound' },
  { code: 'AED', label: 'د.إ AED — UAE Dirham' },
];

const TIMEZONES = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Dubai', 'Asia/Singapore'];

const Settings = () => {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState({
    name:          user?.name          || '',
    phone:         user?.phone         || '',
    currency:      user?.currency      || 'INR',
    language:      user?.language      || 'en',
    timezone:      user?.timezone      || 'Asia/Kolkata',
    monthlyIncome: user?.monthlyIncome || '',
  });

  const [notifications, setNotifications] = useState({
    email:        user?.notifications?.email        ?? true,
    budgetAlerts: user?.notifications?.budgetAlerts ?? true,
    weeklyReport: user?.notifications?.weeklyReport ?? true,
    anomalyAlerts:user?.notifications?.anomalyAlerts?? true,
  });

  const [smsTracking, setSmsTracking] = useState({
    enabled: user?.smsTracking?.enabled ?? false,
    phone:   user?.smsTracking?.phone   || '',
  });

  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState('');

  const saveProfile = async () => {
    setSaving('profile');
    try {
      const res = await authAPI.updateProfile({
        ...profile,
        monthlyIncome: parseFloat(profile.monthlyIncome) || 0,
        notifications,
        smsTracking,
      });
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving('');
    }
  };

  const changePassword = async () => {
    if (passwords.newPass !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.newPass.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving('password');
    try {
      await authAPI.changePassword({
        currentPassword: passwords.current,
        newPassword:     passwords.newPass,
      });
      toast.success('Password changed!');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account preferences</p>
      </div>

      <div className="settings-layout">
        {/* Profile Section */}
        <div className="settings-card">
          <div className="settings-card__header">
            <User size={18} />
            <h2>Profile</h2>
          </div>

          <div className="settings-avatar">
            <div className="avatar-circle">
              {user?.initials || user?.name?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="avatar-name">{user?.name}</div>
              <div className="avatar-email">{user?.email}</div>
              <div className="avatar-plan">{user?.plan} plan</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" value={profile.phone} placeholder="+91 9876543210"
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select className="form-input" value={profile.currency}
                onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Income</label>
              <input className="form-input" type="number" value={profile.monthlyIncome}
                onChange={e => setProfile(p => ({ ...p, monthlyIncome: e.target.value }))}
                placeholder="0" />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select className="form-input" value={profile.timezone}
                onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button className="btn btn--primary" onClick={saveProfile} disabled={saving === 'profile'}>
            <Save size={16} />
            {saving === 'profile' ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Notifications */}
        <div className="settings-card">
          <div className="settings-card__header">
            <Bell size={18} />
            <h2>Notifications</h2>
          </div>

          <div className="toggle-list">
            {[
              { key: 'email',        label: 'Email Notifications',   desc: 'Receive updates via email' },
              { key: 'budgetAlerts', label: 'Budget Alerts',          desc: 'Alert when nearing budget limit' },
              { key: 'weeklyReport', label: 'Weekly Report',          desc: 'Weekly spending summary' },
              { key: 'anomalyAlerts',label: 'Anomaly Alerts',         desc: 'Alert for unusual transactions' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="toggle-item">
                <div className="toggle-item__info">
                  <span className="toggle-item__label">{label}</span>
                  <span className="toggle-item__desc">{desc}</span>
                </div>
                <button
                  className={`toggle-btn ${notifications[key] ? 'toggle-btn--on' : ''}`}
                  onClick={() => setNotifications(n => ({ ...n, [key]: !n[key] }))}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn--primary" onClick={saveProfile} disabled={saving === 'profile'}>
            <Save size={16} /> Save Notifications
          </button>
        </div>

        {/* SMS Tracking */}
        <div className="settings-card">
          <div className="settings-card__header">
            <Smartphone size={18} />
            <h2>SMS Auto-tracking</h2>
          </div>

          <p className="settings-desc">
            Automatically detect UPI and bank transactions from SMS messages.
          </p>

          <div className="toggle-item" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="toggle-item__info">
              <span className="toggle-item__label">Enable SMS Tracking</span>
              <span className="toggle-item__desc">Auto-create transactions from bank SMS</span>
            </div>
            <button
              className={`toggle-btn ${smsTracking.enabled ? 'toggle-btn--on' : ''}`}
              onClick={() => setSmsTracking(s => ({ ...s, enabled: !s.enabled }))}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {smsTracking.enabled && (
            <div className="form-group">
              <label>Phone Number (10 digits)</label>
              <input className="form-input" value={smsTracking.phone}
                onChange={e => setSmsTracking(s => ({ ...s, phone: e.target.value }))}
                placeholder="9876543210" maxLength={10} />
            </div>
          )}

          <button className="btn btn--primary" onClick={saveProfile} disabled={saving === 'profile'}>
            <Save size={16} /> Save SMS Settings
          </button>
        </div>

        {/* Security */}
        <div className="settings-card">
          <div className="settings-card__header">
            <Shield size={18} />
            <h2>Security</h2>
          </div>

          <div className="form-grid">
            <div className="form-group form-group--full">
              <label>Current Password</label>
              <div className="password-input">
                <input className="form-input" type={showPwd ? 'text' : 'password'}
                  value={passwords.current}
                  onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                  placeholder="Enter current password" />
                <button type="button" className="pwd-eye" onClick={() => setShowPwd(s => !s)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input className="form-input" type="password"
                value={passwords.newPass}
                onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                placeholder="Min 6 characters" />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input className="form-input" type="password"
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat new password" />
            </div>
          </div>

          <button className="btn btn--primary" onClick={changePassword} disabled={saving === 'password' || !passwords.current}>
            <Shield size={16} />
            {saving === 'password' ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;