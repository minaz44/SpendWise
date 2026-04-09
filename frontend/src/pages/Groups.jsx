// frontend/src/pages/Groups.jsx

import React, { useState, useEffect } from 'react';
import { Plus, Users, ArrowLeftRight, X, ChevronRight, TrendingUp, TrendingDown, Trash2, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Groups.css';

const fmt = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);

const GROUP_TYPES = ['trip', 'flat', 'office', 'family', 'event', 'other'];
const TYPE_ICONS  = { trip: '✈️', flat: '🏠', office: '💼', family: '👨‍👩‍👧', event: '🎉', other: '👥' };

// ── Confirm Dialog ──────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
      <div className="confirm-dialog__icon">🗑️</div>
      <h3>Are you sure?</h3>
      <p>{message}</p>
      <div className="confirm-dialog__actions">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
);

// ── Create Group Modal ──────────────────────────────────────────────────────
const CreateGroupModal = ({ onClose, onCreated }) => {
  const [form, setForm]       = useState({ name: '', type: 'other', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/groups', form);
      toast.success('Group created!');
      onCreated(res.data.group);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create group');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Create Group</h2>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal__form">
          <div className="form-group">
            <label>Group Name</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Goa Trip 2026" className="form-input" />
          </div>
          <div className="form-group">
            <label>Type</label>
            <div className="type-grid">
              {GROUP_TYPES.map(t => (
                <button key={t} type="button"
                  className={`type-chip ${form.type === t ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}>
                  {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What's this group for?" className="form-input" />
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Add Split Modal ─────────────────────────────────────────────────────────
const AddSplitModal = ({ group, onClose, onAdded }) => {
  const { user } = useAuth();
  const [form, setForm]       = useState({ title: '', totalAmount: '', splitType: 'equal', category: 'General' });
  const [shares, setShares]   = useState([]);
  const [loading, setLoading] = useState(false);

  // When splitType changes to custom/percentage, init shares from group members
  useEffect(() => {
    if (form.splitType !== 'equal' && group?.members?.length > 0) {
      const count = group.members.length;
      setShares(group.members.map((m, i) => ({
        userId: m.userId || null,
        name:   m.name,
        amount: form.splitType === 'custom' ? (parseFloat(form.totalAmount) / count || 0).toFixed(2) : '',
        percentage: form.splitType === 'percentage' ? (100 / count).toFixed(1) : '',
      })));
    }
  }, [form.splitType, form.totalAmount, group]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title:       form.title,
        totalAmount: parseFloat(form.totalAmount),
        splitType:   form.splitType,
        category:    form.category,
      };

      if (form.splitType !== 'equal') {
        payload.shares = shares.map(s => ({
          userId:     s.userId,
          name:       s.name,
          amount:     form.splitType === 'custom' ? parseFloat(s.amount) : undefined,
          percentage: form.splitType === 'percentage' ? parseFloat(s.percentage) : undefined,
        }));
      }

      const res = await api.post(`/groups/${group._id}/splits`, payload);
      toast.success('Expense added!');
      onAdded(res.data.split);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to add expense');
    } finally { setLoading(false); }
  };

  const total = parseFloat(form.totalAmount) || 0;
  const sharesTotal = shares.reduce((s, sh) => s + (parseFloat(sh.amount) || 0), 0);
  const pctTotal    = shares.reduce((s, sh) => s + (parseFloat(sh.percentage) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--lg" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Add Expense</h2>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal__form">
          <div className="form-group">
            <label>Title</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Hotel Booking" className="form-input" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Amount (₹)</label>
              <input required type="number" min="1" step="0.01" value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                placeholder="0" className="form-input" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="General" className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label>Split Type</label>
            <div className="type-grid">
              {['equal', 'custom', 'percentage'].map(t => (
                <button key={t} type="button"
                  className={`type-chip ${form.splitType === t ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, splitType: t }))}>
                  {t === 'equal' ? '⚖️ Equal' : t === 'custom' ? '✏️ Custom' : '% Percent'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom / Percentage shares */}
          {form.splitType !== 'equal' && shares.length > 0 && (
            <div className="shares-section">
              <div className="shares-header">
                <span>Member Shares</span>
                <span className={`shares-total ${
                  form.splitType === 'custom' ? (Math.abs(sharesTotal - total) < 0.5 ? 'valid' : 'invalid') :
                  (Math.abs(pctTotal - 100) < 0.1 ? 'valid' : 'invalid')
                }`}>
                  {form.splitType === 'custom' ? `₹${sharesTotal.toFixed(0)} / ₹${total.toFixed(0)}` : `${pctTotal.toFixed(1)}% / 100%`}
                </span>
              </div>
              {shares.map((s, i) => (
                <div key={i} className="share-row">
                  <span className="share-name">{s.name}</span>
                  <input type="number" min="0" step="0.01"
                    value={form.splitType === 'custom' ? s.amount : s.percentage}
                    onChange={e => {
                      const newShares = [...shares];
                      if (form.splitType === 'custom') newShares[i].amount = e.target.value;
                      else newShares[i].percentage = e.target.value;
                      setShares(newShares);
                    }}
                    placeholder={form.splitType === 'percentage' ? '%' : '₹'}
                    className="form-input share-input"
                  />
                  <span className="share-suffix">{form.splitType === 'percentage' ? '%' : '₹'}</span>
                </div>
              ))}
            </div>
          )}

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Group Detail ────────────────────────────────────────────────────────────
const GroupDetail = ({ group: initialGroup, onBack, onDelete }) => {
  const { user } = useAuth();
  const [group,    setGroup]    = useState(initialGroup);
  const [splits,   setSplits]   = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // splitId to delete

  const fetchData = async () => {
    setLoading(true);
    try {
      const [splitsRes, balancesRes] = await Promise.all([
        api.get(`/groups/${group._id}/splits`),
        api.get(`/groups/${group._id}/balances`),
      ]);
      setSplits(splitsRes.data.splits || []);
      setBalances(balancesRes.data);
    } catch { toast.error('Failed to load group data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [group._id]);

  const settleShare = async (splitId) => {
    try {
      await api.put(`/groups/${group._id}/splits/${splitId}/settle`, { userId: user._id });
      toast.success('Marked as paid! ✅');
      await fetchData();
    } catch (err) { toast.error(err.message || 'Failed to settle'); }
  };

  const deleteGroup = async () => {
    try {
      await api.delete(`/groups/${group._id}`);
      toast.success('Group deleted');
      onDelete(group._id);
      onBack();
    } catch (err) { toast.error(err.message || 'Failed to delete group'); }
  };

  const isSharePaidByUser = (split) => {
    const share = split.shares?.find(s => s.userId?.toString() === user._id?.toString());
    return share?.isPaid || split.paidBy?.toString() === user._id?.toString();
  };

  return (
    <div className="group-detail">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="page-title">{TYPE_ICONS[group.type]} {group.name}</h1>
            <p className="page-subtitle">{group.members?.length} members · {fmt(group.totalExpenses || 0)} total</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn--danger-outline btn--sm" onClick={() => setConfirmDelete('group')}>
            <Trash2 size={14} /> Delete Group
          </button>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Balances */}
      {balances && (
        <div className="balances-section">
          <div className={`my-balance ${(balances.myBalance || 0) >= 0 ? 'my-balance--positive' : 'my-balance--negative'}`}>
            <div className="my-balance__icon">
              {(balances.myBalance || 0) >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div>
              <div className="my-balance__amount">
                {(balances.myBalance || 0) >= 0 ? '+' : ''}{fmt(balances.myBalance || 0)}
              </div>
              <div className="my-balance__label">
                {(balances.myBalance || 0) >= 0 ? 'You are owed' : 'You owe'}
              </div>
            </div>
          </div>

          {balances.iOwe?.length > 0 && (
            <div className="debt-list">
              <h4 style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>You Owe</h4>
              {balances.iOwe.map((d, i) => (
                <div key={i} className="debt-item">
                  <span className="debt-item__text">To <strong>{d.to}</strong></span>
                  <span className="debt-item__amount">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {balances.owedToMe?.length > 0 && (
            <div className="debt-list">
              <h4 style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owed To You</h4>
              {balances.owedToMe.map((d, i) => (
                <div key={i} className="debt-item debt-item--positive">
                  <span className="debt-item__text">From <strong>{d.from}</strong></span>
                  <span className="debt-item__amount debt-item__amount--positive">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="members-section">
        <h3 className="section-title">Members ({group.members?.length})</h3>
        <div className="members-list">
          {group.members?.map((m, i) => (
            <div key={i} className="member-chip">
              <div className="member-chip__avatar">{m.name?.slice(0,2).toUpperCase()}</div>
              <span>{m.name}</span>
              {m.role === 'admin' && <span className="admin-badge">Admin</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Splits */}
      <div className="splits-list">
        <h3 className="section-title">Expenses ({splits.length})</h3>
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="split-row skeleton-row" />)
        ) : splits.length === 0 ? (
          <div className="empty-state">
            <ArrowLeftRight size={24} />
            <p>No expenses yet. Add the first one!</p>
          </div>
        ) : splits.map(split => {
          const paid = isSharePaidByUser(split) || split.isSettled;
          return (
            <div key={split._id} className={`split-row ${paid ? 'split-row--settled' : ''}`}>
              <div className="split-row__info">
                <span className="split-row__title">{split.title}</span>
                <span className="split-row__meta">
                  {split.category} · {new Date(split.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {split.splitType} split
                </span>
                <div className="split-shares">
                  {split.shares?.map((s, i) => (
                    <span key={i} className={`share-badge ${s.isPaid ? 'share-badge--paid' : ''}`}>
                      {s.isPaid ? '✓' : ''} {s.name}: {fmt(s.amount)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="split-row__right">
                <span className="split-row__amount">{fmt(split.totalAmount)}</span>
                {split.isSettled ? (
                  <span className="settled-badge"><CheckCircle size={12} /> Settled</span>
                ) : paid ? (
                  <span className="paid-badge">Your share paid</span>
                ) : (
                  <button className="btn btn--primary btn--sm" onClick={() => settleShare(split._id)}>
                    Settle My Share
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <AddSplitModal group={group} onClose={() => setShowModal(false)}
          onAdded={split => { setSplits(prev => [split, ...prev]); fetchData(); }} />
      )}

      {confirmDelete === 'group' && (
        <ConfirmDialog
          message={`Delete "${group.name}"? This cannot be undone.`}
          onConfirm={deleteGroup}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

// ── Main Groups Page ────────────────────────────────────────────────────────
const Groups = () => {
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    api.get('/groups')
      .then(res => setGroups(res.data.groups || []))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteGroup = (groupId) => {
    setGroups(prev => prev.filter(g => g._id !== groupId));
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/groups/${confirmDeleteId}`);
      setGroups(prev => prev.filter(g => g._id !== confirmDeleteId));
      toast.success('Group deleted');
    } catch { toast.error('Failed to delete group'); }
    finally { setConfirmDeleteId(null); }
  };

  if (activeGroup) {
    return <GroupDetail group={activeGroup} onBack={() => setActiveGroup(null)} onDelete={handleDeleteGroup} />;
  }

  return (
    <div className="groups-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">Manage shared expenses</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="groups-grid">
          {Array(4).fill(0).map((_, i) => <div key={i} className="group-card skeleton-card" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <Users size={32} />
          <h3>No groups yet</h3>
          <p>Create a group to split expenses with friends</p>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create First Group
          </button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(group => (
            <div key={group._id} className="group-card">
              <div className="group-card__body" onClick={() => setActiveGroup(group)}>
                <div className="group-card__header">
                  <span className="group-card__icon">{TYPE_ICONS[group.type]}</span>
                  <span className="group-card__type">{group.type}</span>
                </div>
                <h3 className="group-card__name">{group.name}</h3>
                {group.description && <p className="group-card__desc">{group.description}</p>}
                <div className="group-card__footer">
                  <span>{group.members?.length || 0} members</span>
                  <span>{fmt(group.totalExpenses || 0)} total</span>
                  <ChevronRight size={14} />
                </div>
              </div>
              <button className="group-card__delete" onClick={() => setConfirmDeleteId(group._id)} title="Delete group">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={g => setGroups(prev => [g, ...prev])}
        />
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          message="Delete this group? All expenses will be lost."
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
};

export default Groups;