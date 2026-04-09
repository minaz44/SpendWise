// frontend/src/pages/Goals.jsx

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Plus, Lightbulb, Trophy, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import transactionAPI from '../api/transaction.api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Goals.css';

const fmt = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const Goals = () => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [stats,       setStats]       = useState(null);
  const [score,       setScore]       = useState(null);
  const [recs,        setRecs]        = useState([]);
  const [forecast,    setForecast]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [aiLoading,   setAILoading]   = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const statsRes = await transactionAPI.getStats();
        setStats(statsRes.data);
      } catch { toast.error('Failed to load goals data'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const fetchAIData = async () => {
    setAILoading(true);
    try {
      const [scoreRes, recsRes, forecastRes] = await Promise.all([
        api.get('/ai/score'),
        api.get('/ai/recommendations'),
        api.get('/ai/advanced/forecast?months=3'),
      ]);
      setScore(scoreRes.data);
      setRecs(recsRes.data.recommendations || []);
      setForecast(forecastRes.data);
    } catch { toast.error('Failed to load AI data'); }
    finally { setAILoading(false); }
  };

  const thisMonth = stats?.thisMonth || {};
  const savingsRate = thisMonth.totalIncome > 0
    ? Math.round((thisMonth.netSavings / thisMonth.totalIncome) * 100)
    : 0;

  const gradeColor = (g) => {
    if (!g) return 'var(--color-text-muted)';
    if (g.startsWith('A')) return 'var(--color-success)';
    if (g.startsWith('B')) return 'var(--color-info)';
    if (g.startsWith('C')) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className="goals-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Goals & Score</h1>
          <p className="page-subtitle">Track your financial health and goals</p>
        </div>
        <button className="btn btn--primary" onClick={fetchAIData} disabled={aiLoading}>
          {aiLoading ? <RefreshCw size={16} className="spin" /> : <Lightbulb size={16} />}
          Get AI Analysis
        </button>
      </div>

      {/* Quick Stats */}
      <div className="goals-stats">
        {[
          { label: 'This Month Spent', value: fmt(thisMonth.totalExpense || 0, currency), color: 'var(--color-danger)' },
          { label: 'This Month Income', value: fmt(thisMonth.totalIncome || 0, currency), color: 'var(--color-success)' },
          { label: 'Net Savings', value: fmt(thisMonth.netSavings || 0, currency), color: 'var(--color-info)' },
          { label: 'Savings Rate', value: `${savingsRate}%`, color: savingsRate >= 20 ? 'var(--color-success)' : savingsRate >= 10 ? 'var(--color-warning)' : 'var(--color-danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-pill">
            <div className="stat-pill__value" style={{ color }}>{loading ? '—' : value}</div>
            <div className="stat-pill__label">{label}</div>
          </div>
        ))}
      </div>

      {/* Financial Score */}
      {score ? (
        <div className="score-card">
          <div className="score-card__left">
            <div className="score-circle" style={{ '--score-color': gradeColor(score.grade) }}>
              <div className="score-circle__value">{score.score}</div>
              <div className="score-circle__grade" style={{ color: gradeColor(score.grade) }}>{score.grade}</div>
            </div>
          </div>
          <div className="score-card__right">
            <h2 className="score-label">{score.label}</h2>
            <p className="score-summary">{score.summary}</p>
            <div className="score-breakdown">
              {Object.entries(score.breakdown || {}).map(([key, val]) => (
                <div key={key} className="breakdown-item">
                  <span className="breakdown-label">{key.replace('Score', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                  <div className="breakdown-bar">
                    <div className="breakdown-fill" style={{ width: `${(val / 25) * 100}%` }} />
                  </div>
                  <span className="breakdown-val">{val}/25</span>
                </div>
              ))}
            </div>
            <div className="score-lists">
              {score.strengths?.length > 0 && (
                <div>
                  <h4>✅ Strengths</h4>
                  {score.strengths.map((s, i) => <p key={i} className="score-list-item">{s}</p>)}
                </div>
              )}
              {score.weaknesses?.length > 0 && (
                <div>
                  <h4>⚠️ Improve</h4>
                  {score.weaknesses.map((w, i) => <p key={i} className="score-list-item">{w}</p>)}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="score-placeholder">
          <Trophy size={32} color="var(--color-warning)" />
          <h3>Get Your Financial Score</h3>
          <p>Click "Get AI Analysis" to calculate your personalized financial health score</p>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="recs-section">
          <h3 className="section-title">AI Recommendations</h3>
          <div className="recs-grid">
            {recs.map((rec, i) => (
              <div key={i} className={`rec-card rec-card--${rec.impact}`}>
                <div className="rec-card__header">
                  <span className={`impact-badge impact-badge--${rec.impact}`}>{rec.impact} impact</span>
                  {rec.estimatedMonthlySaving > 0 && (
                    <span className="saving-chip">Save {fmt(rec.estimatedMonthlySaving, currency)}/mo</span>
                  )}
                </div>
                <h4 className="rec-title">{rec.title}</h4>
                <p className="rec-desc">{rec.description}</p>
                {rec.actionSteps?.length > 0 && (
                  <div className="action-steps">
                    {rec.actionSteps.map((step, j) => (
                      <div key={j} className="action-step">
                        <span className="action-step__num">{j + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast?.forecast?.forecast?.length > 0 && (
        <div className="forecast-section">
          <h3 className="section-title">3-Month Forecast</h3>
          <div className="forecast-grid">
            {forecast.forecast.forecast.slice(0, 3).map((f, i) => (
              <div key={i} className="forecast-card">
                <div className="forecast-month">{f.month}</div>
                <div className="forecast-amount">{fmt(f.totalExpense, currency)}</div>
                <div className="forecast-savings" style={{ color: f.netSavings >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {f.netSavings >= 0 ? '+' : ''}{fmt(f.netSavings, currency)} savings
                </div>
                <div className="forecast-confidence">
                  <div className="confidence-bar" style={{ width: `${f.confidence}%` }} />
                  <span>{f.confidence}% confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;