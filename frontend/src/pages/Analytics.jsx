// frontend/src/pages/Analytics.jsx

import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Lightbulb, RefreshCw, Calendar } from 'lucide-react';
import transactionAPI from '../api/transaction.api';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Analytics.css';

const fmt = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const COLORS = ['#1D9E75','#E85D24','#378ADD','#EF9F27','#7F77DD','#D4537E','#3B6D11','#993556'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
      <p style={{ margin: '0 0 4px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ margin: 0, color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

const Analytics = () => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const now = new Date();

  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [year,     setYear]     = useState(now.getFullYear());
  const [summary,  setSummary]  = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [aiLoading,setAILoading]= useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await transactionAPI.getSummary({ month, year });
        setSummary(res.data);
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, year]);

  const fetchAIInsights = async () => {
    setAILoading(true);
    try {
      const [analysisRes, insightsRes] = await Promise.all([
        api.get(`/ai/analysis?month=${month}&year=${year}`),
        api.get('/ai/insights'),
      ]);
      setAnalysis(analysisRes.data);
      setInsights(insightsRes.data.insights || []);
    } catch {
      toast.error('Failed to load AI insights');
    } finally {
      setAILoading(false);
    }
  };

  const pieData = (summary?.categoryBreakdown || []).slice(0, 7).map((b, i) => ({
    name: b._id || 'Other', value: b.total, color: COLORS[i % COLORS.length],
  }));

  const trendData = (summary?.dailyTrend || []).map(d => ({
    date: d._id?.slice(5), Expense: d.expense, Income: d.income,
  }));

  const s = summary?.summary || {};
  const months = [];
  for (let i = 1; i <= 12; i++) months.push(i);
  const years = [now.getFullYear() - 1, now.getFullYear()];

  const insightColors = { warning: '#EF9F27', tip: '#1D9E75', achievement: '#378ADD', alert: '#E85D24' };

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Spending insights and trends</p>
        </div>
        <div className="page-actions">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="period-select">
            {months.map(m => <option key={m} value={m}>{new Date(2026, m-1).toLocaleString('en-IN', { month: 'long' })}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="period-select">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn--primary" onClick={fetchAIInsights} disabled={aiLoading}>
            {aiLoading ? <RefreshCw size={16} className="spin" /> : <Lightbulb size={16} />}
            AI Insights
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analytics-cards">
        {[
          { label: 'Total Income',  value: s.totalIncome  || 0, icon: TrendingUp,   color: 'var(--color-success)' },
          { label: 'Total Expense', value: s.totalExpense || 0, icon: TrendingDown,  color: 'var(--color-danger)' },
          { label: 'Net Savings',   value: s.netSavings   || 0, icon: TrendingUp,   color: 'var(--color-info)' },
          { label: 'Transactions',  value: s.count        || 0, icon: Calendar,     color: 'var(--color-warning)', noFmt: true },
        ].map(({ label, value, icon: Icon, color, noFmt }) => (
          <div key={label} className="analytics-card">
            <div className="analytics-card__icon" style={{ background: `${color}18`, color }}>
              <Icon size={18} />
            </div>
            <div className="analytics-card__value">
              {loading ? <div className="skeleton-line" /> : noFmt ? value : fmt(value, currency)}
            </div>
            <div className="analytics-card__label">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="analytics-charts">
        {/* Daily Trend */}
        <div className="chart-card chart-card--wide">
          <h3 className="chart-title">Daily Trend</h3>
          {loading ? <div className="skeleton-chart" /> : trendData.length === 0 ? (
            <div className="chart-empty">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Expense" fill="var(--color-danger)"  radius={[3,3,0,0]} maxBarSize={20} />
                <Bar dataKey="Income"  fill="var(--color-success)" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="chart-card">
          <h3 className="chart-title">By Category</h3>
          {loading ? <div className="skeleton-chart" /> : pieData.length === 0 ? (
            <div className="chart-empty">No expenses yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {pieData.map((item, i) => (
                  <div key={i} className="pie-legend-item">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{fmt(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="ai-analysis">
          <div className="ai-analysis__header">
            <Lightbulb size={18} color="var(--color-warning)" />
            <h3>AI Analysis</h3>
            <span className={`health-badge health-badge--${analysis.analysis?.spendingHealth}`}>
              {analysis.analysis?.spendingHealth}
            </span>
          </div>
          <p className="ai-analysis__summary">{analysis.analysis?.summary}</p>
          <div className="ai-findings">
            {(analysis.analysis?.keyFindings || []).map((f, i) => (
              <div key={i} className="finding-item">
                <span className="finding-num">{i + 1}</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="insights-grid">
          {insights.map((insight, i) => (
            <div key={i} className="insight-card" style={{ borderLeftColor: insightColors[insight.type] || '#888' }}>
              <div className="insight-card__header">
                <span className="insight-type" style={{ color: insightColors[insight.type] }}>
                  {insight.type?.toUpperCase()}
                </span>
                <span className={`priority-badge priority-badge--${insight.priority}`}>{insight.priority}</span>
              </div>
              <h4 className="insight-title">{insight.title}</h4>
              <p className="insight-msg">{insight.message}</p>
              {insight.potentialSaving > 0 && (
                <div className="insight-saving">
                  💰 Save up to {fmt(insight.potentialSaving, currency)}/month
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Analytics;