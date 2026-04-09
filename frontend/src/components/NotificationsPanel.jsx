// frontend/src/components/NotificationsPanel.jsx

import React, { useState, useEffect, useRef } from 'react';
import { X, Bell, TrendingDown, AlertTriangle, CheckCircle, Info, Trash2 } from 'lucide-react';
import api from '../api/axios';
import './NotificationsPanel.css';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const ICON_MAP = {
  danger:      <TrendingDown size={16} />,
  warning:     <AlertTriangle size={16} />,
  achievement: <CheckCircle size={16} />,
  info:        <Info size={16} />,
};

const COLOR_MAP = {
  danger:      '#FF6B6B',
  warning:     '#FFB547',
  achievement: '#1D9E75',
  info:        '#4DA6FF',
};

const NotificationsPanel = ({ onClose }) => {
  const [alerts,  setAlerts]  = useState([]);
  const [summary, setSummary] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sw_dismissed_notifs') || '[]'); }
    catch { return []; }
  });
  const panelRef = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [alertsRes, summaryRes, anomaliesRes] = await Promise.all([
          api.get('/notifications/budget-alerts'),
          api.get('/notifications/weekly-summary'),
          api.get('/notifications/anomaly-alerts'),
        ]);
        setAlerts(alertsRes.data.alerts || []);
        setSummary(summaryRes.data);
        setAnomalies(anomaliesRes.data.anomalies || []);
      } catch {}
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const dismiss = (id) => {
    const newDismissed = [...dismissed, id];
    setDismissed(newDismissed);
    localStorage.setItem('sw_dismissed_notifs', JSON.stringify(newDismissed));
  };

  const visibleAlerts = alerts.filter((_, i) => !dismissed.includes(`alert_${i}`));
  const visibleAnomalies = anomalies.filter((_, i) => !dismissed.includes(`anomaly_${i}`));
  const totalCount = visibleAlerts.length + visibleAnomalies.length;

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-panel__header">
        <div className="notif-panel__title">
          <Bell size={18} />
          <span>Notifications</span>
          {totalCount > 0 && <span className="notif-badge">{totalCount}</span>}
        </div>
        <button className="notif-close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="notif-panel__body">
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="notif-skeleton" />)
        ) : totalCount === 0 ? (
          <div className="notif-empty">
            <CheckCircle size={32} color="var(--color-success)" />
            <p>All caught up! No new notifications.</p>
          </div>
        ) : (
          <>
            {/* Budget Alerts */}
            {visibleAlerts.length > 0 && (
              <div className="notif-section">
                <h4 className="notif-section__title">Budget Alerts</h4>
                {visibleAlerts.map((alert, i) => (
                  <div key={i} className={`notif-item notif-item--${alert.type}`}
                    style={{ borderLeftColor: COLOR_MAP[alert.type] || '#888' }}>
                    <div className="notif-item__icon" style={{ color: COLOR_MAP[alert.type] }}>
                      {ICON_MAP[alert.type] || <Info size={16} />}
                    </div>
                    <div className="notif-item__content">
                      <p className="notif-item__title">{alert.title}</p>
                      <p className="notif-item__msg">{alert.message}</p>
                      {alert.pct !== undefined && (
                        <div className="notif-progress">
                          <div className="notif-progress__fill"
                            style={{ width: `${Math.min(alert.pct, 100)}%`, background: COLOR_MAP[alert.type] }} />
                        </div>
                      )}
                    </div>
                    <button className="notif-dismiss" onClick={() => dismiss(`alert_${i}`)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Summary */}
            {summary && (
              <div className="notif-section">
                <h4 className="notif-section__title">Weekly Summary</h4>
                <div className="notif-summary">
                  <div className="notif-summary__stat">
                    <span className="notif-summary__label">Spent</span>
                    <span className="notif-summary__value notif-summary__value--danger">
                      {fmt(summary.totalExpense || 0)}
                    </span>
                  </div>
                  <div className="notif-summary__stat">
                    <span className="notif-summary__label">Transactions</span>
                    <span className="notif-summary__value">{summary.transactions || 0}</span>
                  </div>
                  {summary.topCategory && (
                    <div className="notif-summary__stat notif-summary__stat--full">
                      <span className="notif-summary__label">Top Category</span>
                      <span className="notif-summary__value">{summary.topCategory.name} — {fmt(summary.topCategory.amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {visibleAnomalies.length > 0 && (
              <div className="notif-section">
                <h4 className="notif-section__title">Unusual Transactions</h4>
                {visibleAnomalies.map((anomaly, i) => (
                  <div key={i} className="notif-item notif-item--warning"
                    style={{ borderLeftColor: '#FFB547' }}>
                    <div className="notif-item__icon" style={{ color: '#FFB547' }}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="notif-item__content">
                      <p className="notif-item__title">
                        {fmt(anomaly.amount)} at {anomaly.merchant || 'Unknown'}
                      </p>
                      <p className="notif-item__msg">{anomaly.reason || 'Unusual spending detected'}</p>
                    </div>
                    <button className="notif-dismiss" onClick={() => dismiss(`anomaly_${i}`)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
export const getNotifCount = async () => {
  try {
    const [a, b] = await Promise.all([
      api.get('/notifications/budget-alerts'),
      api.get('/notifications/anomaly-alerts'),
    ]);
    return (a.data.alerts?.length || 0) + (b.data.anomalies?.length || 0);
  } catch { return 0; }
};