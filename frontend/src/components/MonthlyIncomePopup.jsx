// frontend/src/components/MonthlyIncomePopup.jsx

import React, { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import authAPI from '../api/auth.api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './MonthlyIncomePopup.css';

const SYMBOLS = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ' };

const MonthlyIncomePopup = ({ onClose }) => {
  const { user, updateUser, refreshUser } = useAuth();
  const [income,  setIncome]  = useState(user?.monthlyIncome || '');
  const [loading, setLoading] = useState(false);

  const currency  = user?.currency || 'INR';
  const symbol    = SYMBOLS[currency] || '₹';
  const now       = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });

  const handleSave = async () => {
    const val = parseFloat(income);
    if (!val || val < 0) { toast.error('Please enter a valid income'); return; }
    setLoading(true);
    try {
      const res = await authAPI.updateProfile({ monthlyIncome: val });
      // Update local user state immediately
      updateUser({ monthlyIncome: val });
      // Also refresh from server to get latest
      if (refreshUser) await refreshUser();
      // Mark as set for this month
      localStorage.setItem('sw_income_set', `${now.getMonth()}_${now.getFullYear()}`);
      toast.success(`✅ ${monthName} income set to ${symbol}${val.toLocaleString('en-IN')}!`);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update income');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('sw_income_set', `${now.getMonth()}_${now.getFullYear()}`);
    onClose();
  };

  return (
    <div className="income-popup-overlay">
      <div className="income-popup">
        <button className="income-popup__close" onClick={handleSkip}><X size={18}/></button>
        <div className="income-popup__icon"><TrendingUp size={28}/></div>
        <h2 className="income-popup__title">Set {monthName} Income</h2>
        <p className="income-popup__desc">
          Set your income for {monthName} to accurately track savings rate and budget recommendations.
        </p>
        <div className="income-popup__input-wrap">
          <span className="income-popup__symbol">{symbol}</span>
          <input
            type="number"
            className="income-popup__input"
            value={income}
            onChange={e => setIncome(e.target.value)}
            placeholder="Enter monthly income"
            min="0"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        {user?.monthlyIncome > 0 && (
          <p className="income-popup__prev">
            Last set: {symbol}{user.monthlyIncome.toLocaleString('en-IN')}
          </p>
        )}
        <div className="income-popup__actions">
          <button className="income-popup__save" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : `Set ${monthName} Income`}
          </button>
          <button className="income-popup__skip" onClick={handleSkip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
};

export const shouldShowIncomePopup = () => {
  const now = new Date();
  const key = `${now.getMonth()}_${now.getFullYear()}`;
  return localStorage.getItem('sw_income_set') !== key;
};

export default MonthlyIncomePopup;