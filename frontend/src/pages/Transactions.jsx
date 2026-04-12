// frontend/src/pages/Transactions.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios'; // ✅ shared instance — has Bearer token interceptor built in

const CATEGORIES = [
  { value: 'Uncategorized',   emoji: '📦' },
  { value: 'Education',       emoji: '📚' },
  { value: 'Entertainment',   emoji: '🎬' },
  { value: 'Food & Dining',   emoji: '🍔' },
  { value: 'Groceries',       emoji: '🛒' },
  { value: 'Health & Medical',emoji: '🏥' },
  { value: 'Investment',      emoji: '📈' },
  { value: 'Other',           emoji: '📌' },
  { value: 'Personal Care',   emoji: '💆' },
  { value: 'Rent & Housing',  emoji: '🏠' },
  { value: 'Shopping',        emoji: '🛍️' },
  { value: 'Transportation',  emoji: '🚗' },
  { value: 'Travel',          emoji: '✈️' },
  { value: 'Utilities',       emoji: '💡' },
  { value: 'Salary',          emoji: '💰' },
  { value: 'Freelance',       emoji: '💻' },
];

const PAYMENT_METHODS = [
  { label: 'Cash',        value: 'cash' },
  { label: 'UPI',         value: 'upi' },
  { label: 'Credit Card', value: 'card' },
  { label: 'Debit Card',  value: 'card' },
  { label: 'Net Banking', value: 'netbanking' },
  { label: 'Wallet',      value: 'wallet' },
  { label: 'Other',       value: 'other' },
];

const TYPE_CONFIG = {
  expense:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Expense',  sign: '-' },
  income:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Income',   sign: '+' },
  transfer: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Transfer', sign: ''  },
};

const catEmoji = v => CATEGORIES.find(c => c.value === v)?.emoji || '📦';
const fmt      = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const fmtDate  = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── AI Categorize Hook ───────────────────────────────────────────────────────
// NOTE: your axios.js response interceptor returns response.data directly,
// so api.post(...) resolves to the parsed body, not the full axios response.
function useAICategorize() {
  const [aiState, setAiState] = useState({ category: null, confidence: 0, loading: false });
  const timer = useRef(null);

  const categorize = useCallback((name, type) => {
    clearTimeout(timer.current);
    if (!name || name.trim().length < 2) {
      setAiState({ category: null, confidence: 0, loading: false });
      return;
    }
    setAiState(s => ({ ...s, loading: true }));
    timer.current = setTimeout(async () => {
      try {
        // api.post resolves to response.data (your interceptor unwraps it)
        const body = await api.post('/transactions/categorize', { name: name.trim(), type });
        const { category, confidence } = body.data;
        setAiState({ category, confidence, loading: false });
      } catch {
        setAiState({ category: null, confidence: 0, loading: false });
      }
    }, 600);
  }, []);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setAiState({ category: null, confidence: 0, loading: false });
  }, []);

  return { ...aiState, categorize, reset };
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 400, padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>🗑️</div>
        <h3 style={{ color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel}  style={{ ...S.btn, flex: 1, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...S.btn, flex: 1, background: '#ef4444', color: '#fff' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
function TransactionModal({ open, onClose, onSave, editData }) {
  const today = new Date().toISOString().split('T')[0];
  const EMPTY = { name: '', amount: '', type: 'expense', category: 'Uncategorized', date: today, paymentMethod: 'upi', notes: '' };

  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [applied, setApplied] = useState(false);
  const nameRef = useRef(null);
  const { category: aiCat, confidence: aiConf, loading: aiLoading, categorize, reset } = useAICategorize();

  useEffect(() => {
    if (!open) return;
    setForm(editData ? { ...EMPTY, ...editData, date: (editData.date || today).split('T')[0] } : EMPTY);
    setError('');
    setApplied(false);
    reset();
    setTimeout(() => nameRef.current?.focus(), 120);
  }, [open]);

  // Trigger AI on name/type change (new transactions only)
  useEffect(() => {
    if (!open || editData) return;
    setApplied(false);
    categorize(form.name, form.type);
  }, [form.name, form.type, open]);

  // Auto-apply AI suggestion once
  useEffect(() => {
    if (aiCat && !applied && !editData) {
      setForm(f => ({ ...f, category: aiCat }));
      setApplied(true);
    }
  }, [aiCat]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const submit = async () => {
    if (!form.name.trim())                        return setError('Transaction name is required.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter a valid amount.');
    setSaving(true); setError('');
    try {
      await onSave({ ...form, amount: Number(form.amount) });
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  const aiApplied = aiCat && form.category === aiCat;
  const aiConfPct = Math.round(aiConf * 100);

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 520 }}>

        {/* Header */}
        <div style={S.mHead}>
          <h2 style={S.mTitle}>{editData ? '✏️ Edit Transaction' : '➕ New Transaction'}</h2>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* Type Toggle */}
        <div style={S.typRow}>
          {Object.entries(TYPE_CONFIG).map(([t, cfg]) => (
            <button key={t} onClick={() => set('type', t)} style={{
              ...S.typBtn,
              background:  form.type === t ? cfg.bg    : 'transparent',
              color:       form.type === t ? cfg.color : 'var(--color-text-secondary)',
              borderColor: form.type === t ? cfg.color : 'transparent',
            }}>
              {t === 'expense' ? '↓' : t === 'income' ? '↑' : '⇄'} {cfg.label}
            </button>
          ))}
        </div>

        <div style={S.mBody}>
          {/* Name */}
          <div>
            <label style={S.label}>TRANSACTION NAME</label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Swiggy, Netflix, Salary, Amazon..."
              style={S.input}
            />
          </div>

          {/* Amount */}
          <div>
            <label style={S.label}>AMOUNT (₹)</label>
            <input
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              type="number" min="0" placeholder="0"
              style={{ ...S.input, fontSize: '1.25rem', fontWeight: 700 }}
            />
          </div>

          {/* Category with AI badge */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ ...S.label, margin: 0 }}>CATEGORY</label>
              {aiLoading && !editData && (
                <span style={S.pillLoading}><span style={S.dot} /> AI thinking...</span>
              )}
              {aiApplied && !aiLoading && (
                <span style={S.pillDone}>✦ AI: {aiCat} · {aiConfPct}%</span>
              )}
            </div>
            <div style={S.selWrap}>
              <span style={S.selEmoji}>{catEmoji(form.category)}</span>
              <select
                value={form.category}
                onChange={e => { set('category', e.target.value); setApplied(false); }}
                style={{
                  ...S.selBox,
                  borderColor: aiApplied ? '#6366f1' : 'var(--color-border)',
                  boxShadow:   aiApplied ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>
                ))}
              </select>
              <span style={S.selArrow}>▼</span>
            </div>
            {aiApplied && (
              <p style={S.aiHint}>✦ Auto-categorized by AI — you can change this anytime</p>
            )}
          </div>

          {/* Date + Payment Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={S.label}>DATE</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>PAYMENT METHOD</label>
              <div style={S.selWrap}>
                <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                  style={{ ...S.selBox, paddingLeft: '0.85rem' }}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <span style={S.selArrow}>▼</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={S.label}>NOTES (OPTIONAL)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Add a note..." rows={2}
              style={{ ...S.input, resize: 'vertical', minHeight: 60 }} />
          </div>

          {error && <div style={S.errBox}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ ...S.btn, flex: 1, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>Cancel</button>
            <button onClick={submit} disabled={saving} style={{ ...S.btn, flex: 2, background: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : editData ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Transactions() {
  const [txns,       setTxns]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editData,   setEditData]   = useState(null);
  const [delTarget,  setDelTarget]  = useState(null);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCat,  setFilterCat]  = useState('all');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary,    setSummary]    = useState({ income: 0, expenses: 0, balance: 0 });
  const LIMIT = 10;

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: LIMIT });
      if (search)               p.append('search',   search);
      if (filterType !== 'all') p.append('type',     filterType);
      if (filterCat  !== 'all') p.append('category', filterCat);
      // api interceptor returns response.data directly
      const body = await api.get(`/transactions?${p}`);
      setTxns(body.data.transactions || []);
      setTotalPages(body.data.pagination?.totalPages || 1);
    } catch { setTxns([]); }
    setLoading(false);
  }, [page, search, filterType, filterCat]);

  const fetchSummary = useCallback(async () => {
    try {
      const body = await api.get('/transactions/summary');
      const d    = body.data?.summary || {};
      setSummary({
        income:   d.totalIncome  || 0,
        expenses: d.totalExpense || 0,
        balance:  (d.totalIncome || 0) - (d.totalExpense || 0),
      });
    } catch {}
  }, []);

  useEffect(() => { fetchTxns(); },    [fetchTxns]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { setPage(1); },     [search, filterType, filterCat]);

  const handleSave = async (form) => {
    const payload = {
      type:          form.type,
      amount:        form.amount,
      merchant:      form.name,
      description:   form.name,
      categoryName:  form.category,
      date:          form.date,
      paymentMethod: form.paymentMethod,
      notes:         form.notes || null,
    };
    if (editData) await api.put(`/transactions/${editData._id}`, payload);
    else          await api.post('/transactions', payload);
    fetchTxns();
    fetchSummary();
  };

  const handleDelete = async () => {
    await api.delete(`/transactions/${delTarget._id}`);
    setDelTarget(null);
    fetchTxns();
    fetchSummary();
  };

  return (
    <div style={S.page}>

      {/* Summary Cards */}
      <div style={S.sumGrid}>
        {[
          { label: 'Total Income',   value: summary.income,   color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '↑' },
          { label: 'Total Expenses', value: summary.expenses, color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '↓' },
          { label: 'Net Balance',    value: summary.balance,  color: summary.balance >= 0 ? '#6366f1' : '#ef4444', bg: 'rgba(99,102,241,0.08)', icon: '⇄' },
        ].map(c => (
          <div key={c.label} style={{ ...S.sumCard, background: c.bg, borderColor: c.color + '33' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ color: c.color, fontSize: '1.1rem' }}>{c.icon}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}>{c.label.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{fmt(Math.abs(c.value))}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={S.searchIco}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." style={S.searchInput} />
          {search && <button onClick={() => setSearch('')} style={S.clearBtn}>✕</button>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ ...S.selWrap, width: 'auto' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ ...S.selBox, paddingLeft: '0.85rem', width: 130 }}>
              <option value="all">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
            <span style={S.selArrow}>▼</span>
          </div>
          <div style={{ ...S.selWrap, width: 'auto' }}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ ...S.selBox, paddingLeft: '0.85rem', width: 170 }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
            <span style={S.selArrow}>▼</span>
          </div>
        </div>
        <button onClick={() => { setEditData(null); setModalOpen(true); }} style={S.addBtn}>
          + Add Transaction
        </button>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={S.empty}>
            <div style={S.spinner} />
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem' }}>Loading...</p>
          </div>
        ) : txns.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>💳</div>
            <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>No transactions found</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Add your first transaction to get started</p>
            <button onClick={() => { setEditData(null); setModalOpen(true); }} style={{ ...S.addBtn, marginTop: '1.25rem' }}>+ Add Transaction</button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>{['Transaction', 'Category', 'Amount', 'Date', 'Method', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {txns.map(t => {
                    const cfg  = TYPE_CONFIG[t.type] || TYPE_CONFIG.expense;
                    const name = t.merchant || t.description || '—';
                    const cat  = t.categoryName || 'Uncategorized';
                    return (
                      <tr key={t._id} style={S.tr} className="tx-row">
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                            <div style={{ ...S.txIco, background: cfg.bg, color: cfg.color }}>
                              {t.type === 'income' ? '↑' : t.type === 'transfer' ? '⇄' : '↓'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.88rem' }}>{name}</div>
                              {t.notes && <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>{t.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={S.td}><span style={S.catBadge}>{catEmoji(cat)} {cat}</span></td>
                        <td style={{ ...S.td, fontWeight: 700, color: cfg.color }}>{cfg.sign}{fmt(t.amount)}</td>
                        <td style={{ ...S.td, color: 'var(--color-text-secondary)', fontSize: '0.83rem' }}>{fmtDate(t.date || t.createdAt)}</td>
                        <td style={S.td}><span style={S.methBadge}>{t.paymentMethod || 'UPI'}</span></td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button onClick={() => { setEditData(t); setModalOpen(true); }} style={S.icoBtn} title="Edit">✏️</button>
                            <button onClick={() => setDelTarget(t)} style={S.icoBtn} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={S.pages}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pgBtn}>← Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)} style={{
                      ...S.pgBtn, minWidth: 36,
                      background: pg === page ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                      color:      pg === page ? '#fff'                 : 'var(--color-text-secondary)',
                    }}>{pg}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.pgBtn}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editData={editData}
      />
      <ConfirmDialog
        open={!!delTarget}
        title="Delete Transaction"
        message={`Delete "${delTarget?.merchant || delTarget?.description}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:    { padding: '1.5rem', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  sumGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' },
  sumCard: { padding: '1.25rem', borderRadius: 14, border: '1px solid', backdropFilter: 'blur(8px)' },

  toolbar:     { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  searchWrap:  { position: 'relative', flex: 1, minWidth: 200 },
  searchIco:   { position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '0.6rem 2.2rem', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' },
  clearBtn:    { position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.8rem' },
  addBtn:      { padding: '0.6rem 1.2rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' },

  selWrap:  { position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' },
  selBox:   { width: '100%', padding: '0.65rem 2rem 0.65rem 2.4rem', background: 'var(--color-bg-tertiary)', border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', transition: 'border-color 0.15s' },
  selEmoji: { position: 'absolute', left: '0.75rem', fontSize: '1rem', pointerEvents: 'none', zIndex: 1 },
  selArrow: { position: 'absolute', right: '0.75rem', fontSize: '0.65rem', color: 'var(--color-text-secondary)', pointerEvents: 'none', zIndex: 1 },

  card:      { background: 'var(--color-bg-secondary)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 640 },
  th:        { padding: '0.8rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-tertiary)', textTransform: 'uppercase' },
  tr:        { borderBottom: '1px solid var(--color-border)', transition: 'background 0.12s' },
  td:        { padding: '0.85rem 1rem', verticalAlign: 'middle' },
  txIco:     { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  catBadge:  { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.55rem', background: 'var(--color-bg-tertiary)', borderRadius: 20, fontSize: '0.76rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' },
  methBadge: { padding: '0.2rem 0.5rem', background: 'rgba(99,102,241,0.12)', borderRadius: 6, fontSize: '0.74rem', color: '#6366f1', fontWeight: 600 },
  icoBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem 0.35rem', borderRadius: 6 },
  empty:     { padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  spinner:   { width: 34, height: 34, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'txSpin 0.8s linear infinite' },
  pages:     { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', padding: '0.85rem', borderTop: '1px solid var(--color-border)' },
  pgBtn:     { padding: '0.4rem 0.75rem', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.83rem' },

  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal:    { background: 'var(--color-bg-secondary)', borderRadius: 20, border: '1px solid var(--color-border)', width: '100%', maxHeight: '90vh', overflowY: 'auto', animation: 'txModalIn 0.2s ease-out' },
  mHead:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--color-border)' },
  mTitle:   { color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '1.05rem', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem 0.4rem', borderRadius: 6 },
  typRow:   { display: 'flex', padding: '0.75rem 1.5rem', gap: '0.5rem', borderBottom: '1px solid var(--color-border)' },
  typBtn:   { flex: 1, padding: '0.55rem', borderRadius: 10, border: '1.5px solid', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', transition: 'all 0.15s' },
  mBody:    { padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  label:    { display: 'block', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' },
  input:    { width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-tertiary)', border: '1.5px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  errBox:   { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#ef4444', fontSize: '0.83rem' },
  btn:      { padding: '0.75rem 1.25rem', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.93rem', transition: 'all 0.15s' },

  pillLoading: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.18rem 0.6rem', background: 'rgba(99,102,241,0.1)', borderRadius: 20, fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, border: '1px solid rgba(99,102,241,0.25)' },
  pillDone:    { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.6rem', background: 'rgba(34,197,94,0.1)',  borderRadius: 20, fontSize: '0.7rem', color: '#22c55e', fontWeight: 600, border: '1px solid rgba(34,197,94,0.25)', animation: 'txFadeIn 0.3s ease-out' },
  dot:         { width: 6, height: 6, borderRadius: '50%', background: '#6366f1', animation: 'txPulse 1s ease-in-out infinite' },
  aiHint:      { margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#6366f1' },
};

if (!document.getElementById('tx-keyframes')) {
  const s = document.createElement('style');
  s.id = 'tx-keyframes';
  s.textContent = `
    @keyframes txSpin    { to { transform: rotate(360deg); } }
    @keyframes txModalIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes txFadeIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
    @keyframes txPulse   { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
    .tx-row:hover { background: var(--color-bg-tertiary) !important; }
    input:focus, select:focus, textarea:focus { border-color: var(--color-primary) !important; }
  `;
  document.head.appendChild(s);
}