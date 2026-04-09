// frontend/src/pages/Dashboard.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Plus, RefreshCw, Calendar, Target, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import transactionAPI from '../api/transaction.api';
import api from '../api/axios';
import toast from 'react-hot-toast';
import './Dashboard.css';

const fmt = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const COLORS = ['#1D9E75','#FF6B6B','#4DA6FF','#FFB547','#A78BFA','#F472B6','#34D399','#FB923C'];

// ── Spending Cap Widget ───────────────────────────────────────────────────────
const SpendingCapWidget = ({ currency }) => {
  const [budget,   setBudget]   = useState(null);
  const [capInput, setCapInput] = useState('');
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    api.get('/notifications/budget').then(res => {
      setBudget(res.data.budget);
      if (res.data.budget) setCapInput(res.data.budget.totalBudget);
    }).catch(() => {});
  }, []);

  const saveCap = async () => {
    const val = parseFloat(capInput);
    if (!val || val <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const res = await api.post('/notifications/budget', { totalBudget: val });
      setBudget(res.data.budget);
      setEditing(false);
      toast.success('Spending cap set! 🎯');
    } catch { toast.error('Failed to set cap'); }
    finally { setSaving(false); }
  };

  const pct     = budget ? Math.min((budget.totalSpent / budget.totalBudget) * 100, 100) : 0;
  const symbol  = { INR:'₹', USD:'$', EUR:'€', GBP:'£' }[currency] || '₹';
  const barColor = pct >= 100 ? 'var(--color-danger)' : pct >= 80 ? 'var(--color-warning)' : 'var(--color-primary)';

  return (
    <div className="cap-widget">
      <div className="cap-widget__header">
        <div className="cap-widget__title">
          <Target size={16} color="var(--color-primary)" />
          <span>Monthly Spending Cap</span>
        </div>
        <button className="cap-edit-btn" onClick={() => setEditing(e => !e)}>
          {editing ? <X size={14} /> : budget ? 'Edit' : 'Set Cap'}
        </button>
      </div>

      {editing ? (
        <div className="cap-widget__edit">
          <div className="cap-input-wrap">
            <span className="cap-symbol">{symbol}</span>
            <input type="number" className="cap-input" value={capInput}
              onChange={e => setCapInput(e.target.value)}
              placeholder="e.g. 13000" autoFocus
              onKeyDown={e => e.key === 'Enter' && saveCap()} />
          </div>
          <button className="btn btn--primary btn--sm" onClick={saveCap} disabled={saving}>
            {saving ? 'Saving...' : 'Save Cap'}
          </button>
        </div>
      ) : budget ? (
        <div className="cap-widget__progress">
          <div className="cap-progress-bar">
            <div className="cap-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <div className="cap-progress-labels">
            <span style={{ color: barColor, fontWeight: 700 }}>
              {pct >= 100 ? '🚨 Cap Exceeded!' : pct >= 80 ? '⚠️ ' : ''}{fmt(budget.totalSpent, currency)} spent
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              of {fmt(budget.totalBudget, currency)} cap
            </span>
          </div>
          {pct >= 80 && (
            <div className="cap-alert" style={{ background: pct >= 100 ? 'rgba(255,107,107,0.1)' : 'rgba(255,181,71,0.1)', color: pct >= 100 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
              <AlertTriangle size={12} />
              {pct >= 100 ? 'You have exceeded your spending cap!' : `${Math.round(100-pct)}% of budget remaining`}
            </div>
          )}
        </div>
      ) : (
        <p className="cap-empty">No spending cap set. Set a limit to stay on track! 🎯</p>
      )}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, trend, trendLabel, color, loading, subtitle }) => (
  <div className="stat-card">
    <div className="stat-card__header">
      <span className="stat-card__title">{title}</span>
      <div className="stat-card__icon" style={{ background: `${color}18`, color }}><Icon size={18}/></div>
    </div>
    {loading ? <div className="skeleton skeleton--value"/> : <div className="stat-card__value">{value}</div>}
    {subtitle && !loading && <div className="stat-card__subtitle">{subtitle}</div>}
    {trend !== undefined && !loading && (
      <div className={`stat-card__trend ${trend >= 0 ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
        {trend >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
        <span>{Math.abs(trend)}% {trendLabel}</span>
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color: p.color, margin:0, fontSize:12 }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats,    setStats]    = useState(null);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing,setRefreshing] = useState(false);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const currency = user?.currency || 'INR';

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true); else setLoading(true);
      const [statsRes, summaryRes] = await Promise.all([
        transactionAPI.getStats(),
        transactionAPI.getSummary({ month, year }),
      ]);
      setStats(statsRes.data);
      setSummary(summaryRes.data);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const thisMonth     = stats?.thisMonth     || {};
  const comparison    = stats?.comparison    || {};
  const recent        = stats?.recentTransactions || [];
  const breakdown     = summary?.categoryBreakdown || [];
  const dailyTrend    = summary?.dailyTrend   || [];
  const periodSummary = summary?.summary      || {};

  const trendData = dailyTrend.map(d => ({
    date: d._id?.slice(5), Expense: d.expense, Income: d.income,
  }));

  const pieData = breakdown.slice(0,6).map((b,i) => ({
    name: b._id || 'Other', value: b.total, color: COLORS[i % COLORS.length],
  }));

  // Show declared income as subtitle if no transactions
  const incomeSubtitle = !thisMonth.totalIncome && user?.monthlyIncome
    ? `Declared: ${fmt(user.monthlyIncome, currency)}` : null;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">
            Good {now.getHours()<12?'morning':now.getHours()<17?'afternoon':'evening'}, {user?.name?.split(' ')[0]||'there'} 👋
          </h1>
          <p className="dashboard__subtitle">
            <Calendar size={14}/>
            {now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
          </p>
        </div>
        <button className={`dashboard__refresh ${refreshing?'dashboard__refresh--spinning':''}`}
          onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw size={16}/><span>Refresh</span>
        </button>
      </div>

      {/* Spending Cap Widget */}
      <SpendingCapWidget currency={currency} />

      {/* Stats */}
      <div className="stats-grid">
        <StatCard title="Total Expenses" value={fmt(thisMonth.totalExpense||0,currency)} icon={TrendingDown}
          trend={comparison.expenseChange} trendLabel="vs last month" color="var(--color-danger)" loading={loading}/>
        <StatCard title="Total Income" value={fmt(thisMonth.totalIncome||0,currency)} icon={TrendingUp}
          subtitle={incomeSubtitle} color="var(--color-success)" loading={loading}/>
        <StatCard title="Net Savings" value={fmt(thisMonth.netSavings||0,currency)} icon={Wallet}
          color="var(--color-info)" loading={loading}/>
        <StatCard title="Transactions" value={thisMonth.transactionCount||0} icon={ArrowUpRight}
          color="var(--color-warning)" loading={loading}/>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card chart-card--wide">
          <div className="chart-card__header">
            <h3 className="chart-card__title">Daily Spending Trend</h3>
            <div className="chart-legend">
              <span className="chart-legend__item chart-legend__item--expense">Expense</span>
              <span className="chart-legend__item chart-legend__item--income">Income</span>
            </div>
          </div>
          {loading ? <div className="skeleton skeleton--chart"/> : trendData.length === 0 ? (
            <div className="chart-empty">No data for this month yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--color-text-muted)'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'var(--color-text-muted)'}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="Expense" fill="var(--color-danger)"  radius={[3,3,0,0]} maxBarSize={24}/>
                <Bar dataKey="Income"  fill="var(--color-success)" radius={[3,3,0,0]} maxBarSize={24}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card__header"><h3 className="chart-card__title">By Category</h3></div>
          {loading ? <div className="skeleton skeleton--chart"/> : pieData.length === 0 ? (
            <div className="chart-empty">No expenses yet</div>
          ) : (
            <div className="pie-wrapper">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v,currency)}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {pieData.map((item,i) => (
                  <div key={i} className="pie-legend__item">
                    <span className="pie-legend__dot" style={{background:item.color}}/>
                    <span className="pie-legend__name">{item.name}</span>
                    <span className="pie-legend__value">{fmt(item.value,currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="bottom-grid">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Recent Transactions</h3>
            <button className="card__link" onClick={() => navigate('/transactions')}>View all</button>
          </div>
          {loading ? Array(5).fill(0).map((_,i) => <div key={i} className="skeleton skeleton--row"/>) :
            recent.length === 0 ? (
              <div className="empty-state">
                <Plus size={24}/>
                <p>No transactions yet</p>
                <button className="btn btn--primary btn--sm" onClick={() => navigate('/transactions')}>Add your first</button>
              </div>
            ) : (
              <div className="txn-list">
                {recent.map(txn => (
                  <div key={txn._id} className="txn-item">
                    <div className="txn-item__icon" style={{
                      background: txn.type==='income'?'rgba(29,158,117,0.12)':'rgba(255,107,107,0.12)',
                      color: txn.type==='income'?'var(--color-success)':'var(--color-danger)',
                    }}>
                      {txn.categoryId?.icon||(txn.type==='income'?'💰':'💸')}
                    </div>
                    <div className="txn-item__info">
                      <span className="txn-item__name">{txn.merchant||txn.description||'Transaction'}</span>
                      <span className="txn-item__cat">{txn.categoryName}</span>
                    </div>
                    <div className="txn-item__right">
                      <span className={`txn-item__amount txn-item__amount--${txn.type}`}>
                        {txn.type==='income'?'+':'-'}{fmt(txn.amount,currency)}
                      </span>
                      <span className="txn-item__date">
                        {new Date(txn.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        <div className="card">
          <div className="card__header"><h3 className="card__title">Monthly Summary</h3></div>
          {loading ? Array(4).fill(0).map((_,i) => <div key={i} className="skeleton skeleton--row"/>) : (
            <div className="summary-list">
              {[
                { label:'Total Income',    value:periodSummary.totalIncome   ||0, color:'var(--color-success)' },
                { label:'Total Expenses',  value:periodSummary.totalExpense  ||0, color:'var(--color-danger)' },
                { label:'Net Savings',     value:periodSummary.netSavings    ||0, color:'var(--color-info)' },
                { label:'Avg Transaction', value:periodSummary.avgTransaction||0, color:'var(--color-warning)' },
              ].map(({label,value,color}) => (
                <div key={label} className="summary-row">
                  <span className="summary-row__label">{label}</span>
                  <span className="summary-row__value" style={{color}}>{fmt(value,currency)}</span>
                </div>
              ))}
              {periodSummary.totalIncome > 0 && (
                <div className="savings-bar">
                  <div className="savings-bar__header">
                    <span>Savings Rate</span>
                    <span>{Math.max(0,Math.round((periodSummary.netSavings/periodSummary.totalIncome)*100))}%</span>
                  </div>
                  <div className="savings-bar__track">
                    <div className="savings-bar__fill" style={{
                      width:`${Math.min(100,Math.max(0,Math.round((periodSummary.netSavings/periodSummary.totalIncome)*100)))}%`,
                    }}/>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;