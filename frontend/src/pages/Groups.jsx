// frontend/src/pages/Groups.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io as socketIO } from 'socket.io-client';
import {
  Plus, Users, ArrowLeftRight, X, ChevronRight, ChevronDown, ChevronUp,
  Trash2, CheckCircle, UserPlus, Mail, Phone, BarChart2, Settings, LogOut,
  Edit2, Camera, Send, ArrowLeft, Receipt, Image as ImageIcon, Pencil,
  MessageCircle, UserMinus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import EditSplitModal from '../components/EditSplitModal';
import '../styles/Groups.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v || 0);
const fmtShort = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const TYPE_ICONS  = { trip: '✈️', flat: '🏠', office: '💼', family: '👨‍👩‍👧', event: '🎉', other: '👥' };
const GROUP_TYPES = ['trip', 'flat', 'office', 'family', 'event', 'other'];
const CATEGORIES  = ['General', 'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Accommodation', 'Medical', 'Other'];

// ─── Socket singleton ─────────────────────────────────────────────────────────
let _socket = null;
function getSocket(token) {
  if (_socket && _socket.connected) return _socket;
  if (_socket) { _socket.disconnect(); _socket = null; }
  _socket = socketIO(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
    auth:                 { token },
    transports:           ['websocket', 'polling'],
    reconnection:         true,
    reconnectionAttempts: 5,
    reconnectionDelay:    1000,
  });
  return _socket;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name = '', size = 38, you = false }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors   = [
    ['#6366f1', '#8b5cf6'], ['#ec4899', '#f43f5e'], ['#f97316', '#fb923c'],
    ['#22c55e', '#16a34a'], ['#06b6d4', '#0891b2'], ['#a855f7', '#9333ea'],
  ];
  const [c1, c2] = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg,${c1},${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#fff',
      border: you ? '2px solid #6366f1' : 'none',
      boxShadow: you ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none',
    }}>{initials}</div>
  );
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const Confirm = ({ msg, onYes, onNo, yesLabel = 'Delete', yesColor = '#ef4444', icon = '🗑️' }) => (
  <div className="g-overlay" onClick={onNo}>
    <div className="g-confirm" onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <h3>Are you sure?</h3>
      <p>{msg}</p>
      <div className="g-confirm__btns">
        <button className="g-btn g-btn--ghost" onClick={onNo}>Cancel</button>
        <button
          className="g-btn"
          style={{ background: yesColor, color: '#fff', flex: 1, justifyContent: 'center' }}
          onClick={onYes}
        >
          {yesLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Add Member Modal ─────────────────────────────────────────────────────────
const AddMemberModal = ({ groupId, onClose, onAdded }) => {
  const [method,  setMethod]  = useState('email');
  const [value,   setValue]   = useState('');
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!value.trim()) { toast.error('Enter email or phone'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/groups/${groupId}/members`, {
        email: method === 'email' ? value.trim() : undefined,
        phone: method === 'sms'   ? value.trim() : undefined,
        name:  name.trim() || value.split('@')[0],
      });
      toast.success('Member added!');
      onAdded(res.data?.data?.group ?? res.data?.group ?? res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally { setLoading(false); }
  };

  return (
    <div className="g-overlay" onClick={onClose}>
      <div className="g-modal" onClick={e => e.stopPropagation()}>
        <div className="g-modal__hdr">
          <h2>Add Member</h2>
          <button className="g-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="g-modal__body">
          <div className="g-tabs">
            <button className={`g-tab ${method === 'email' ? 'active' : ''}`} onClick={() => setMethod('email')}><Mail size={13} /> Email</button>
            <button className={`g-tab ${method === 'sms'   ? 'active' : ''}`} onClick={() => setMethod('sms')}><Phone size={13} /> SMS</button>
          </div>
          <div className="g-field">
            <label>{method === 'email' ? 'Email Address' : 'Phone Number'}</label>
            <input className="g-input" type={method === 'email' ? 'email' : 'tel'}
              value={value} onChange={e => setValue(e.target.value)}
              placeholder={method === 'email' ? 'friend@gmail.com' : '+91 9876543210'}
              autoFocus onKeyDown={e => e.key === 'Enter' && send()} />
          </div>
          <div className="g-field">
            <label>Name (optional)</label>
            <input className="g-input" value={name} onChange={e => setName(e.target.value)} placeholder="Friend's name" />
          </div>
        </div>
        <div className="g-modal__ftr">
          <button className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="g-btn g-btn--primary" onClick={send} disabled={loading}>
            {loading ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add Split Modal ──────────────────────────────────────────────────────────
const AddSplitModal = ({ group, currentUser, onClose, onAdded }) => {
  const members = group?.members || [];

  const [form, setForm] = useState({
    title:       '',
    totalAmount: '',
    category:    'General',
    splitType:   'equal',
    paidBy:      currentUser._id?.toString(),
    notes:       '',
  });

  const [selectedMembers, setSelectedMembers] = useState(
    () => members.map(m => m.userId?.toString())
  );

  const toggleMember = (uid) => {
    if (uid === form.paidBy) return;
    setSelectedMembers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  useEffect(() => {
    setSelectedMembers(prev =>
      prev.includes(form.paidBy) ? prev : [...prev, form.paidBy]
    );
  }, [form.paidBy]);

  const activeMembers = members.filter(m =>
    selectedMembers.includes(m.userId?.toString())
  );

  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.splitType === 'equal') { setShares([]); return; }
    const count = activeMembers.length || 1;
    const total = parseFloat(form.totalAmount) || 0;
    setShares(prev => activeMembers.map(m => {
      const existing = prev.find(p => p.userId?.toString() === m.userId?.toString());
      return {
        userId:     m.userId,
        name:       m.name,
        amount:     existing?.amount     ?? (form.splitType === 'custom'     ? (total / count).toFixed(2) : ''),
        percentage: existing?.percentage ?? (form.splitType === 'percentage' ? (100  / count).toFixed(1)  : ''),
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.splitType, form.totalAmount, selectedMembers.join(',')]);

  const sharesTotal = shares.reduce((s, sh) => s + (parseFloat(sh.amount)     || 0), 0);
  const pctTotal    = shares.reduce((s, sh) => s + (parseFloat(sh.percentage) || 0), 0);
  const total       = parseFloat(form.totalAmount) || 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())        { toast.error('Enter a title');                           return; }
    if (!form.totalAmount || total <= 0) { toast.error('Enter a valid amount');              return; }
    if (activeMembers.length === 0) { toast.error('Select at least one member');             return; }
    if (form.splitType === 'custom'     && Math.abs(sharesTotal - total) > 0.5)
      { toast.error(`Shares total ₹${sharesTotal.toFixed(0)} ≠ total ₹${total.toFixed(0)}`); return; }
    if (form.splitType === 'percentage' && Math.abs(pctTotal - 100) > 0.1)
      { toast.error(`Percentages total ${pctTotal.toFixed(1)}% ≠ 100%`);                     return; }

    setLoading(true);
    try {
      const payload = {
        title:       form.title.trim(),
        totalAmount: total,
        category:    form.category,
        splitType:   form.splitType,
        paidBy:      form.paidBy,
        notes:       form.notes,
      };
      if (form.splitType === 'equal') {
        payload.shares = activeMembers.map(m => ({ userId: m.userId, name: m.name }));
      } else {
        payload.shares = shares.map(s => ({
          userId:     s.userId,
          name:       s.name,
          amount:     form.splitType === 'custom'     ? parseFloat(s.amount)     : undefined,
          percentage: form.splitType === 'percentage' ? parseFloat(s.percentage) : undefined,
        }));
      }
      const res = await api.post(`/groups/${group._id}/splits`, payload);
      toast.success('Expense added!');
      onAdded(res.data?.split ?? res.data?.data?.split ?? res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    } finally { setLoading(false); }
  };

  return (
    <div className="g-overlay" onClick={onClose}>
      <div className="g-modal g-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="g-modal__hdr">
          <h2>Add Expense</h2>
          <button className="g-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="g-modal__body">

          <div className="g-field">
            <label>Title</label>
            <input required className="g-input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Zomato, Hotel Booking, Petrol" autoFocus />
          </div>

          <div className="g-row">
            <div className="g-field">
              <label>Total Amount (₹)</label>
              <input required type="number" min="1" step="0.01" className="g-input"
                value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div className="g-field">
              <label>Category</label>
              <select className="g-input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="g-splitwise-row">
            <span className="g-splitwise-row__label">Paid by</span>
            <div className="g-splitwise-select-wrap">
              <select className="g-splitwise-select" value={form.paidBy}
                onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))}>
                {members.map(m => (
                  <option key={m.userId} value={m.userId?.toString()}>
                    {m.userId?.toString() === currentUser._id?.toString() ? 'you' : m.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="g-splitwise-row__label">and split</span>
            <div className="g-splitwise-select-wrap">
              <select className="g-splitwise-select" value={form.splitType}
                onChange={e => setForm(f => ({ ...f, splitType: e.target.value }))}>
                <option value="equal">equally</option>
                <option value="custom">by exact amounts</option>
                <option value="percentage">by percentages</option>
              </select>
            </div>
          </div>

          {/* ── Member selector ──────────────────────────────────────────────── */}
          <div className="g-field">
            <label style={{ marginBottom: '8px', display: 'block' }}>
              Split with
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 500,
                color: 'rgba(255,255,255,0.4)', textTransform: 'none', letterSpacing: 0,
              }}>
                {activeMembers.length} of {members.length} selected
              </span>
            </label>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {members.map((m, i) => {
                const uid     = m.userId?.toString();
                const isYou   = uid === currentUser._id?.toString();
                const isPayer = uid === form.paidBy;
                const checked = selectedMembers.includes(uid);
                return (
                  <div
                    key={uid}
                    onClick={() => toggleMember(uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      cursor: isPayer ? 'default' : 'pointer',
                      borderBottom: i < members.length - 1
                        ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: checked ? 'rgba(99,102,241,0.08)' : 'transparent',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <Avatar name={m.name} size={30} you={isYou} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        color: checked ? '#fff' : 'rgba(255,255,255,0.5)',
                        transition: 'color 0.15s',
                      }}>
                        {isYou ? 'You' : m.name}
                      </div>
                      {isPayer && (
                        <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500, marginTop: 1 }}>
                          Paying · always included
                        </div>
                      )}
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: checked ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.2)',
                      background: checked ? '#6366f1' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      opacity: isPayer ? 0.5 : 1,
                    }}>
                      {checked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Equal split preview */}
          {form.splitType === 'equal' && activeMembers.length > 0 && total > 0 && (
            <div className="g-equal-preview">
              {activeMembers.map((m, i) => (
                <div key={i} className="g-equal-preview__row">
                  <Avatar name={m.name} size={24}
                    you={m.userId?.toString() === currentUser._id?.toString()} />
                  <span>{m.userId?.toString() === currentUser._id?.toString() ? 'You' : m.name}</span>
                  <span className="g-equal-preview__amt">{fmt(total / activeMembers.length)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Custom / Percentage shares */}
          {form.splitType !== 'equal' && shares.length > 0 && (
            <div className="g-shares">
              <div className="g-shares__hdr">
                <span>Member Shares</span>
                <span className={`g-shares__total ${
                  (form.splitType === 'custom'
                    ? Math.abs(sharesTotal - total) < 0.5
                    : Math.abs(pctTotal - 100) < 0.1) ? 'valid' : 'invalid'}`}>
                  {form.splitType === 'custom'
                    ? `₹${sharesTotal.toFixed(0)} / ₹${total.toFixed(0)}`
                    : `${pctTotal.toFixed(1)}% / 100%`}
                </span>
              </div>
              {shares.map((s, i) => (
                <div key={i} className="g-share-row">
                  <Avatar name={s.name} size={28}
                    you={s.userId?.toString() === currentUser._id?.toString()} />
                  <span className="g-share-name">
                    {s.userId?.toString() === currentUser._id?.toString() ? 'You' : s.name}
                  </span>
                  <input type="number" min="0" step="0.01" className="g-input g-input--sm"
                    value={form.splitType === 'custom' ? s.amount : s.percentage}
                    onChange={e => {
                      const ns = [...shares];
                      if (form.splitType === 'custom') ns[i] = { ...ns[i], amount: e.target.value };
                      else                             ns[i] = { ...ns[i], percentage: e.target.value };
                      setShares(ns);
                    }}
                    placeholder={form.splitType === 'percentage' ? '%' : '₹'} />
                  <span className="g-share-suffix">{form.splitType === 'percentage' ? '%' : '₹'}</span>
                </div>
              ))}
            </div>
          )}

          <div className="g-field">
            <label>Notes (optional)</label>
            <input className="g-input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add a note…" />
          </div>

          <div className="g-modal__ftr">
            <button type="button" className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="g-btn g-btn--primary"
              disabled={loading || activeMembers.length === 0}>
              {loading ? 'Adding…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Split Detail ─────────────────────────────────────────────────────────────
const SplitDetail = ({ split: initSplit, group, onBack, onSplitUpdated }) => {
  const { user } = useAuth();

  const [split, setSplit] = useState(() => ({
    ...initSplit,
    comments: Array.isArray(initSplit.comments) ? initSplit.comments : [],
    shares:   Array.isArray(initSplit.shares)   ? initSplit.shares   : [],
  }));
  const [trends,               setTrends]               = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [fetchError,           setFetchError]           = useState(null);
  const [showEdit,             setShowEdit]             = useState(false);
  const [commentText,          setCommentText]          = useState('');
  const [sendingComment,       setSendingComment]       = useState(false);
  const [uploadingBill,        setUploadingBill]        = useState(false);
  const [showBillFull,         setShowBillFull]         = useState(false);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const [socketConnected,      setSocketConnected]      = useState(false);
  const [confirmDeleteSplit,   setConfirmDeleteSplit]   = useState(false);

  const fileInputRef   = useRef(null);
  const commentsEndRef = useRef(null);
  const splitIdRef     = useRef(initSplit._id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res  = await api.get(`/groups/${group._id}/splits/${initSplit._id}/detail`);
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? {};
        const sv   = data.split ?? {};
        setSplit(prev => ({
          ...prev, ...sv,
          comments: Array.isArray(sv.comments) ? sv.comments : prev.comments,
          shares:   Array.isArray(sv.shares)   ? sv.shares   : prev.shares,
        }));
        setTrends(Array.isArray(data.trends) ? data.trends : []);
      } catch {
        if (cancelled) return;
        setFetchError('Could not load full details — showing available data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [group._id, initSplit._id]);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('join_split', { splitId: splitIdRef.current });

    const onConnect    = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    const onNewComment = ({ splitId, comment }) => {
      if (splitId !== splitIdRef.current || !comment?._id) return;
      setSplit(prev => {
        const comments = prev.comments ?? [];
        const hasOptimistic = comments.some(
          c => c.optimistic && c.text === comment.text && String(c.userId) === String(comment.userId)
        );
        if (hasOptimistic) return { ...prev, comments: comments.map(c => (c.optimistic && c.text === comment.text) ? comment : c) };
        if (comments.some(c => c._id === comment._id)) return prev;
        return { ...prev, comments: [...comments, comment] };
      });
    };
    const onDeleteComment = ({ splitId, commentId }) => {
      if (splitId !== splitIdRef.current || !commentId) return;
      setSplit(prev => ({ ...prev, comments: (prev.comments ?? []).filter(c => c._id !== commentId) }));
    };

    socket.on('connect',        onConnect);
    socket.on('disconnect',     onDisconnect);
    socket.on('new_comment',    onNewComment);
    socket.on('delete_comment', onDeleteComment);
    if (socket.connected) setSocketConnected(true);

    return () => {
      socket.emit('leave_split', { splitId: splitIdRef.current });
      socket.off('connect',        onConnect);
      socket.off('disconnect',     onDisconnect);
      socket.off('new_comment',    onNewComment);
      socket.off('delete_comment', onDeleteComment);
    };
  }, []);

  const commentCount = split.comments?.length ?? 0;
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commentCount]);

  const paidByName = split.paidByName
    || group.members?.find(m => m.userId?.toString() === split.paidBy?.toString())?.name
    || 'Someone';
  const iPaid = split.paidBy?.toString() === user._id?.toString();

  const handleBillUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingBill(true);
    try {
      const fd = new FormData();
      fd.append('bill', file);
      const res = await api.post(
        `/groups/${group._id}/splits/${split._id}/bill`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const billImage = res?.data?.data?.billImage ?? res?.data?.billImage;
      setSplit(prev => ({ ...prev, billImage }));
      toast.success('Bill uploaded!');
    } catch {
      toast.error('Failed to upload bill');
    } finally {
      setUploadingBill(false);
    }
  };

  const handleDeleteBill = async () => {
    try {
      await api.delete(`/groups/${group._id}/splits/${split._id}/bill`);
      setSplit(prev => ({ ...prev, billImage: null }));
      toast.success('Bill removed');
    } catch {
      toast.error('Failed to remove bill');
    }
  };

  const sendComment = async () => {
    const text = commentText.trim();
    if (!text || sendingComment) return;
    const optId      = `opt-${Date.now()}`;
    const optimistic = {
      _id: optId, userId: user._id, userName: user.name,
      text, createdAt: new Date().toISOString(), optimistic: true,
    };
    setSplit(prev => ({ ...prev, comments: [...(prev.comments ?? []), optimistic] }));
    setCommentText('');
    setSendingComment(true);
    try {
      const res   = await api.post(`/groups/${group._id}/splits/${split._id}/comments`, { text });
      const saved = res?.data?.data?.comment ?? res?.data?.comment;
      if (saved?._id) {
        setSplit(prev => ({
          ...prev,
          comments: prev.comments.map(c => c._id === optId ? saved : c),
        }));
      }
    } catch (err) {
      setSplit(prev => ({ ...prev, comments: prev.comments.filter(c => c._id !== optId) }));
      setCommentText(text);
      toast.error(err.response?.data?.message || 'Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  const deleteComment = async (commentId) => {
    setSplit(prev => ({ ...prev, comments: prev.comments.filter(c => c._id !== commentId) }));
    setConfirmDeleteComment(null);
    try {
      await api.delete(`/groups/${group._id}/splits/${split._id}/comments/${commentId}`);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
      try {
        const res  = await api.get(`/groups/${group._id}/splits/${split._id}/detail`);
        const data = res?.data?.data ?? res?.data ?? {};
        if (Array.isArray(data.split?.comments)) {
          setSplit(prev => ({ ...prev, comments: data.split.comments }));
        }
      } catch { /* ignore */ }
    }
  };

  const handleDeleteSplit = async () => {
    try {
      await api.delete(`/groups/${group._id}/splits/${split._id}`);
      toast.success('Expense deleted');
      onBack();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const maxTrend = Math.max(...trends.map(t => t.amount), 1);

  const handleSplitSaved = (updated) => {
    setSplit(prev => ({ ...prev, ...updated }));
    onSplitUpdated?.(updated);
  };

  return (
    <div className="sd-page">
      <div className="sd-topbar">
        <button className="sd-topbar__back" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className="sd-topbar__live" title={socketConnected ? 'Live' : 'Connecting…'}>
          <span className={`sd-live-dot ${socketConnected ? 'sd-live-dot--on' : ''}`} />
          <span className="sd-live-label">{socketConnected ? 'Live' : '…'}</span>
        </div>
        <div className="sd-topbar__icon-btn-wrap">
          <button
            className="sd-topbar__icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload bill"
            disabled={uploadingBill}
          >
            {uploadingBill ? <div className="sd-spinner-sm" /> : <Camera size={20} />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
            style={{ display: 'none' }} onChange={handleBillUpload} />
          <button
            className="sd-topbar__icon-btn"
            onClick={() => setShowEdit(true)}
            title="Edit expense"
          >
            <Pencil size={20} />
          </button>
          <button
            className="sd-topbar__icon-btn sd-topbar__icon-btn--danger"
            onClick={() => setConfirmDeleteSplit(true)}
            title="Delete expense"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{
          margin: '8px 16px', padding: '8px 12px',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 8, color: '#fbbf24', fontSize: 13,
        }}>
          ⚠️ {fetchError}
        </div>
      )}

      {loading ? (
        <div className="sd-loading"><div className="sd-spinner" /></div>
      ) : (
        <div className="sd-content">
          <div className="sd-header">
            <div className="sd-header__icon"><Receipt size={28} color="#6366f1" /></div>
            <div className="sd-header__info">
              <h1 className="sd-header__title">{split.title}</h1>
              <div className="sd-header__amount">{fmt(split.totalAmount)}</div>
              <div className="sd-header__meta">
                Added by <span>{paidByName}</span> on {fmtDate(split.date || split.createdAt)}
              </div>
            </div>
          </div>

          <div className="sd-section">
            <div className="sd-paid-row">
              <Avatar name={paidByName} size={44} you={iPaid} />
              <div className="sd-paid-row__info">
                <span className="sd-paid-row__label">{iPaid ? 'You paid' : `${paidByName} paid`}</span>
                <span className="sd-paid-row__amount">{fmt(split.totalAmount)}</span>
              </div>
            </div>
            <div className="sd-shares">
              {split.shares?.length > 0 ? split.shares.map((share, i) => {
                const isMe = share.userId?.toString() === user._id?.toString();
                return (
                  <div key={i} className="sd-share-row">
                    <Avatar name={share.name} size={30} you={isMe} />
                    <span className="sd-share-row__name">
                      {isMe ? 'You' : share.name}
                      {share.isPaid && <span className="sd-settled-chip">✓ paid</span>}
                    </span>
                    <span className={`sd-share-row__amount ${isMe && !iPaid ? 'sd-share-row__amount--you' : ''}`}>
                      {isMe && !iPaid ? `you owe ${fmt(share.amount)}` : `owes ${fmt(share.amount)}`}
                    </span>
                  </div>
                );
              }) : (
                <div className="sd-share-row sd-share-row--equal">
                  <span>Split equally among {group.members?.length} members</span>
                  <span>{fmt(split.totalAmount / (group.members?.length || 1))} each</span>
                </div>
              )}
            </div>
          </div>

          {split.billImage ? (
            <div className="sd-section">
              <div className="sd-section-title"><ImageIcon size={15} /> Bill / Receipt</div>
              <div className="sd-bill-preview" onClick={() => setShowBillFull(true)}>
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}${split.billImage}`}
                  alt="Bill"
                  className="sd-bill-img"
                />
                <div className="sd-bill-overlay"><span>Tap to view full</span></div>
              </div>
              <button className="sd-remove-bill" onClick={handleDeleteBill}>
                <Trash2 size={13} /> Remove bill
              </button>
            </div>
          ) : (
            <div className="sd-section">
              <button
                className="sd-upload-bill-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBill}
              >
                <Camera size={18} />
                <span>{uploadingBill ? 'Uploading…' : 'Upload bill / receipt'}</span>
              </button>
            </div>
          )}

          {trends.length > 0 && (
            <div className="sd-section">
              <div className="sd-section-title">
                <BarChart2 size={15} /> Spending trends — {split.category || 'General'}
              </div>
              <div className="sd-trends">
                {trends.map((t, i) => (
                  <div key={i} className="sd-trend-row">
                    <span className="sd-trend-row__month">{t.month}</span>
                    <div className="sd-trend-row__bar-wrap">
                      <div
                        className="sd-trend-row__bar"
                        style={{ width: `${Math.round((t.amount / maxTrend) * 100)}%` }}
                      />
                    </div>
                    <span className="sd-trend-row__amount">{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {split.notes && (
            <div className="sd-section">
              <div className="sd-section-title">📝 Notes</div>
              <p className="sd-notes">{split.notes}</p>
            </div>
          )}

          <div className="sd-section sd-section--comments">
            <div className="sd-section-title">
              <MessageCircle size={15} />
              Comments ({split.comments?.length ?? 0})
              {socketConnected && <span className="sd-live-chip">● live</span>}
            </div>
            <div className="sd-comments-list">
              {!split.comments?.length ? (
                <div className="sd-comments-empty">No comments yet. Be the first!</div>
              ) : split.comments.map((c, i) => {
                const isMe = c.userId?.toString() === user._id?.toString();
                return (
                  <div
                    key={c._id || i}
                    className={`sd-comment ${isMe ? 'sd-comment--me' : ''} ${c.optimistic ? 'sd-comment--optimistic' : ''}`}
                  >
                    {!isMe && <Avatar name={c.userName || '?'} size={30} />}
                    <div className="sd-comment__bubble">
                      {!isMe && <div className="sd-comment__author">{c.userName}</div>}
                      <div className="sd-comment__text">{c.text}</div>
                      <div className="sd-comment__time">
                        {c.createdAt ? `${fmtDateShort(c.createdAt)} · ${fmtTime(c.createdAt)}` : ''}
                        {c.optimistic && (
                          <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 11 }}>sending…</span>
                        )}
                        {isMe && !c.optimistic && (
                          <button
                            className="sd-comment__del"
                            onClick={() => setConfirmDeleteComment(c._id)}
                            title="Delete comment"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    {isMe && <Avatar name={c.userName || user.name || '?'} size={30} you />}
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
            <div className="sd-comment-input">
              <input
                className="sd-comment-input__field"
                placeholder="Add a comment…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                maxLength={500}
                disabled={sendingComment}
              />
              <button
                className="sd-comment-input__send"
                onClick={sendComment}
                disabled={sendingComment || !commentText.trim()}
              >
                {sendingComment ? <div className="sd-spinner-sm" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          <div className="sd-section">
            <button
              className="sd-delete-split-btn"
              onClick={() => setConfirmDeleteSplit(true)}
            >
              <Trash2 size={15} /> Delete Transaction
            </button>
          </div>

        </div>
      )}

      {showBillFull && split.billImage && (
        <div className="g-overlay" onClick={() => setShowBillFull(false)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setShowBillFull(false)}
              style={{
                position: 'absolute', top: -16, right: -16,
                background: '#1a1a2e', border: '1px solid var(--color-border)',
                borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--color-text-primary)', zIndex: 10,
              }}
            >
              <X size={16} />
            </button>
            <img
              src={`${import.meta.env.VITE_API_URL || ''}${split.billImage}`}
              alt="Bill full"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {showEdit && (
        <EditSplitModal
          split={split}
          group={group}
          currentUser={user}
          onClose={() => setShowEdit(false)}
          onSaved={handleSplitSaved}
        />
      )}

      {confirmDeleteComment && (
        <Confirm
          icon="💬"
          msg="Delete this comment? This cannot be undone."
          yesLabel="Delete Comment"
          yesColor="#ef4444"
          onYes={() => deleteComment(confirmDeleteComment)}
          onNo={() => setConfirmDeleteComment(null)}
        />
      )}

      {confirmDeleteSplit && (
        <Confirm
          icon="🗑️"
          msg={`Delete "${split.title}"? This will remove all associated balances and cannot be undone.`}
          yesLabel="Delete Transaction"
          yesColor="#ef4444"
          onYes={handleDeleteSplit}
          onNo={() => setConfirmDeleteSplit(false)}
        />
      )}
    </div>
  );
};

// ─── Invite Link Row ──────────────────────────────────────────────────────────
const InviteLinkRow = ({ group, isAdmin }) => {
  const [copying,      setCopying]      = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied,       setCopied]       = useState(false);

  const inviteLink = group.inviteToken
    ? `${window.location.origin}/join/${group.inviteToken}`
    : null;

  const copyLink = async () => {
    if (!inviteLink) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally { setCopying(false); }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await api.post(`/groups/${group._id}/invite/regenerate`);
      toast.success('New invite link generated!');
    } catch {
      toast.error('Failed to regenerate link');
    } finally { setRegenerating(false); }
  };

  return (
    <div style={{ padding: '0.5rem 1.25rem 0.85rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: '0.6rem' }}>
        Invite via link
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div style={{ flex: 1, padding: '0.55rem 0.75rem', background: 'var(--color-bg-tertiary, #1e1e2e)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: '0.72rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {inviteLink ? inviteLink.replace(/https?:\/\//, '') : 'No invite link — save group first'}
        </div>
        <button
          onClick={copyLink}
          disabled={!inviteLink || copying}
          style={{ padding: '0.55rem 0.85rem', background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.12)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.25)'}`, borderRadius: 10, color: copied ? '#22c55e' : 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}
        >
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
      </div>
      {isAdmin && (
        <button
          onClick={regenerate}
          disabled={regenerating}
          style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '0.72rem', cursor: 'pointer', padding: '0.2rem 0', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {regenerating ? 'Regenerating…' : '↻ Reset link (invalidates current)'}
        </button>
      )}
    </div>
  );
};

// ─── Group Settings Panel ─────────────────────────────────────────────────────
const GroupSettings = ({ group, currentUser, onClose, onGroupUpdated, onLeave, onDelete }) => {
  const [editing,      setEditing]      = useState(false);
  const [editName,     setEditName]     = useState(group.name);
  const [editDesc,     setEditDesc]     = useState(group.description || '');
  const [saving,       setSaving]       = useState(false);
  const [confirmLeave,  setConfirmLeave]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingId,    setRemovingId]    = useState(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);

  const amAdmin = group.members?.some(
    m => m.userId?.toString() === currentUser._id?.toString() && m.role === 'admin'
  );

  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/groups/${group._id}`, { name: editName, description: editDesc });
      toast.success('Group updated!');
      onGroupUpdated(res.data?.data?.group ?? res.data?.group ?? res.data);
      setEditing(false);
    } catch {
      toast.error('Failed to update group');
    } finally { setSaving(false); }
  };

  const removeMember = async (memberId, memberName) => {
    setRemovingId(memberId);
    setConfirmRemoveMember(null);
    try {
      const res = await api.delete(`/groups/${group._id}/members/${memberId}`);
      toast.success(`${memberName} removed from group`);
      onGroupUpdated(res.data?.data?.group ?? res.data?.group ?? res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally { setRemovingId(null); }
  };

  return (
    <>
      <div className="g-overlay" onClick={onClose}>
        <div className="gs-panel" onClick={e => e.stopPropagation()}>
          <div className="gs-header">
            <button className="g-icon-btn" onClick={onClose} style={{ marginRight: 8 }}><X size={18} /></button>
            <h2 className="gs-title">Group settings</h2>
          </div>

          <div className="gs-identity">
            <div className="gs-group-icon">{TYPE_ICONS[group.type] || '👥'}</div>
            <div className="gs-identity__info">
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <input className="g-input" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                  <input className="g-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" style={{ fontSize: '0.8rem' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="g-btn g-btn--ghost g-btn--sm" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="g-btn g-btn--primary g-btn--sm" onClick={saveEdits} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="gs-group-name">{group.name}</span>
                  <span className="gs-group-type">{group.type?.charAt(0).toUpperCase() + group.type?.slice(1)}</span>
                </>
              )}
            </div>
            {amAdmin && !editing && (
              <button className="g-icon-btn" onClick={() => setEditing(true)}><Edit2 size={16} /></button>
            )}
          </div>

          <div className="gs-divider" />
          <div className="gs-section-label">Group members</div>

          {amAdmin && (
            <button className="gs-action-row" onClick={() => setShowAddMember(true)}>
              <div className="gs-action-row__icon gs-action-row__icon--add"><UserPlus size={18} /></div>
              <span className="gs-action-row__label">Add people to group</span>
            </button>
          )}

          <InviteLinkRow group={group} isAdmin={amAdmin} />

          <div className="gs-members-list">
            {group.members?.map((member, i) => {
              const isYou = member.userId?.toString() === currentUser._id?.toString();
              return (
                <div key={i} className="gs-member-row">
                  <Avatar name={member.name} size={44} you={isYou} />
                  <div className="gs-member-row__info">
                    <div className="gs-member-row__name">
                      {member.name}{isYou ? ' (you)' : ''}
                      {member.role === 'admin' && <span className="gs-admin-tag">admin</span>}
                    </div>
                    <div className="gs-member-row__email">{member.email || ''}</div>
                  </div>
                  {amAdmin && !isYou && (
                    <button
                      className="gs-remove-btn"
                      title={`Remove ${member.name}`}
                      disabled={removingId === member._id}
                      onClick={() => setConfirmRemoveMember({ memberId: member._id, name: member.name })}
                    >
                      {removingId === member._id ? '…' : <UserMinus size={15} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="gs-divider" />
          <div className="gs-danger-zone">
            <button className="gs-danger-btn gs-danger-btn--leave" onClick={() => setConfirmLeave(true)}>
              <LogOut size={15} /> Leave Group
            </button>
            {amAdmin && (
              <button className="gs-danger-btn gs-danger-btn--delete" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete Group
              </button>
            )}
          </div>
        </div>
      </div>

      {showAddMember && (
        <AddMemberModal
          groupId={group._id}
          onClose={() => setShowAddMember(false)}
          onAdded={g => { onGroupUpdated(g); setShowAddMember(false); }}
        />
      )}

      {confirmRemoveMember && (
        <Confirm
          icon="👤"
          msg={`Remove ${confirmRemoveMember.name} from "${group.name}"? They will lose access to this group.`}
          yesLabel="Remove Member"
          yesColor="#f97316"
          onYes={() => removeMember(confirmRemoveMember.memberId, confirmRemoveMember.name)}
          onNo={() => setConfirmRemoveMember(null)}
        />
      )}

      {confirmLeave && (
        <Confirm icon="🚪" msg={`Leave "${group.name}"?`} yesLabel="Leave Group" yesColor="#f97316"
          onYes={() => { setConfirmLeave(false); onLeave(); }}
          onNo={() => setConfirmLeave(false)} />
      )}
      {confirmDelete && (
        <Confirm icon="🗑️" msg={`Permanently delete "${group.name}"? This cannot be undone.`} yesLabel="Delete Group" yesColor="#ef4444"
          onYes={() => { setConfirmDelete(false); onDelete(); }}
          onNo={() => setConfirmDelete(false)} />
      )}
    </>
  );
};

// ─── Balances Tab ─────────────────────────────────────────────────────────────
const BalancesTab = ({ balances, group, currentUser, loading }) => {
  const [expanded, setExpanded] = useState({});
  if (loading) return (
    <div className="g-empty">
      <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'gSpin 0.7s linear infinite' }} />
    </div>
  );
  if (!balances) return <div className="g-empty"><p>No balance data.</p></div>;

  // ── Build per-member balance rows from iOwe / owedToMe / netBalances ──────
  // API shape: { data: { myBalance, iOwe, owedToMe, allDebts, netBalances } }
  const allDebts    = balances.allDebts    || [];
  const netBalances = balances.netBalances || {};

  const memberDebts = group.members?.map(member => {
    const uid = member.userId?.toString();
    const net = netBalances[uid] ?? 0;
    return { userId: uid, name: member.name, netBalance: net };
  }) || [];

  const toggle = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="gsb-wrap">
      {memberDebts.length === 0 ? (
        <div className="g-empty">
          <CheckCircle size={32} color="#22c55e" />
          <p style={{ color: '#22c55e', fontWeight: 700 }}>Everyone is settled up! 🎉</p>
        </div>
      ) : memberDebts.map((member, i) => {
        const isYou = member.userId === currentUser._id?.toString();
        const net   = member.netBalance || 0;
        const isExp = expanded[member.userId || i];
        const owes  = allDebts.filter(s => s.from === member.userId);
        const owed  = allDebts.filter(s => s.to   === member.userId);

        if (net === 0 && owes.length === 0 && owed.length === 0) return null;

        return (
          <div key={i} className="gsb-member-block">
            <button className="gsb-member-row" onClick={() => (owes.length + owed.length) > 0 && toggle(member.userId || i)}>
              <Avatar name={member.name} size={42} you={isYou} />
              <div className="gsb-member-row__text">
                {net === 0
                  ? <span className="gsb-member-row__label"><strong>{isYou ? 'You are' : member.name + ' is'}</strong> settled up</span>
                  : net > 0
                  ? <span className="gsb-member-row__label"><strong>{isYou ? 'You get back' : member.name + ' gets back'}</strong> <span className="gsb-amt gsb-amt--pos">{fmt(net)}</span> in total</span>
                  : <span className="gsb-member-row__label"><strong>{isYou ? 'You owe' : member.name + ' owes'}</strong> <span className="gsb-amt gsb-amt--neg">{fmt(Math.abs(net))}</span> in total</span>}
              </div>
              {(owes.length + owed.length) > 0 && (
                <span className="gsb-chevron">{isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              )}
            </button>
            {isExp && (
              <div className="gsb-detail">
                {owes.map((debt, j) => {
                  const toName = group.members?.find(m => m.userId?.toString() === debt.to?.toString())?.name || 'Someone';
                  return (
                    <div key={j} className="gsb-debt-row">
                      <Avatar name={toName} size={32} />
                      <span className="gsb-debt-row__text">
                        {isYou ? 'You owe' : member.name + ' owes'} <span className="gsb-amt gsb-amt--neg">{fmt(debt.amount)}</span> to <strong>{toName}</strong>
                      </span>
                    </div>
                  );
                })}
                {owed.map((debt, j) => {
                  const fromName = group.members?.find(m => m.userId?.toString() === debt.from?.toString())?.name || 'Someone';
                  return (
                    <div key={j} className="gsb-debt-row">
                      <Avatar name={fromName} size={32} />
                      <span className="gsb-debt-row__text">
                        <strong>{fromName}</strong> owes <span className="gsb-amt gsb-amt--pos">{fmt(debt.amount)}</span> to {isYou ? 'you' : member.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Group Detail ─────────────────────────────────────────────────────────────
const GroupDetail = ({ group: initGroup, onBack, onDelete }) => {
  const { user } = useAuth();

  // ── Resolve the current user's ID reliably ─────────────────────────────
  // AuthContext may store it as user._id, user.id, or user.data._id
  // depending on how the login response was parsed.
  const resolveMyId = (u) => {
    if (!u) return '';
    const raw = u._id ?? u.id ?? u.userId ?? '';
    return String(raw).trim();
  };
  const MY_ID = resolveMyId(user);

  // DEV DEBUG — remove after confirming fix
  if (process.env.NODE_ENV === 'development') {
    console.log('[GroupDetail] user object:', JSON.stringify(user));
    console.log('[GroupDetail] resolved MY_ID:', MY_ID);
  }
  const [group,    setGroup]    = useState(initGroup);
  const [splits,   setSplits]   = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('expenses');
  const [showAdd,       setShowAdd]       = useState(false);
  const [showMember,    setShowMember]    = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [totalsPeriod,  setTotalsPeriod]  = useState('all');
  const [activeSplit,   setActiveSplit]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sp, ba, gr] = await Promise.all([
        api.get(`/groups/${group._id}/splits`),
        api.get(`/groups/${group._id}/balances`),
        api.get(`/groups/${group._id}`),
      ]);
      setSplits(sp.data?.data?.splits ?? sp.data?.splits ?? []);

      // ── API returns: { success, data: { myBalance, iOwe, owedToMe, allDebts, netBalances } }
      const bal = ba.data?.data ?? ba.data ?? null;
      setBalances(bal);

      const grp = gr.data?.data?.group ?? gr.data?.group ?? initGroup;
      setGroup(prev => ({ ...prev, ...grp }));
    } catch {
      toast.error('Failed to load group data');
    } finally { setLoading(false); }
  }, [group._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const token = localStorage.getItem('spendwise_token');
    if (!token) return;
    const socket = getSocket(token);
    socket.emit('join_group', { groupId: group._id });

    const onMemberAdded = ({ groupId, member }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      setGroup(prev => {
        const already = prev.members?.some(m =>
          (m.userId && m.userId?.toString() === member.userId?.toString()) ||
          (m.email  && m.email === member.email)
        );
        if (already) return prev;
        toast(`${member.name} joined the group! 👋`, { icon: '👥' });
        return { ...prev, members: [...(prev.members || []), member] };
      });
    };
    const onMemberRemoved = ({ groupId, memberId }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      setGroup(prev => ({ ...prev, members: prev.members?.filter(m => m._id?.toString() !== memberId?.toString()) }));
    };
    const onMemberLeft = ({ groupId, userId }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      setGroup(prev => {
        const leftMember = prev.members?.find(m => m.userId?.toString() === userId?.toString());
        if (leftMember) toast(`${leftMember.name} left the group`, { icon: '🚪' });
        return { ...prev, members: prev.members?.filter(m => m.userId?.toString() !== userId?.toString()) };
      });
    };
    const onGroupUpdated = ({ group: updatedGroup }) => {
      if (updatedGroup?._id?.toString() !== group._id?.toString()) return;
      setGroup(prev => ({ ...prev, ...updatedGroup }));
    };
    const onGroupDeleted = ({ groupId }) => {
      if (groupId?.toString() !== group._id?.toString()) return;
      toast.error('This group was deleted by the admin.');
      onBack();
    };

    socket.on('member_joined',  onMemberAdded);
    socket.on('member_added',   onMemberAdded);
    socket.on('member_removed', onMemberRemoved);
    socket.on('member_left',    onMemberLeft);
    socket.on('group_updated',  onGroupUpdated);
    socket.on('group_deleted',  onGroupDeleted);

    return () => {
      socket.emit('leave_group', { groupId: group._id });
      socket.off('member_joined',  onMemberAdded);
      socket.off('member_added',   onMemberAdded);
      socket.off('member_removed', onMemberRemoved);
      socket.off('member_left',    onMemberLeft);
      socket.off('group_updated',  onGroupUpdated);
      socket.off('group_deleted',  onGroupDeleted);
    };
  }, [group._id]);

  const handleLeave = async () => {
    try {
      await api.post(`/groups/${group._id}/leave`);
      toast.success(`You left "${group.name}"`);
      onDelete(group._id);
      onBack();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave');
    }
  };
  const handleDelete = async () => {
    try {
      await api.delete(`/groups/${group._id}`);
      toast.success('Group deleted');
      onDelete(group._id);
      onBack();
    } catch {
      toast.error('Failed to delete group');
    }
  };

  if (activeSplit) return (
    <SplitDetail
      split={activeSplit}
      group={group}
      onBack={() => setActiveSplit(null)}
      onSplitUpdated={updated =>
        setSplits(prev => prev.map(s => s._id === updated._id ? { ...s, ...updated } : s))
      }
    />
  );

  const totalSpent = splits.reduce((s, sp) => s + (sp.totalAmount || 0), 0);

  const totalsData = (() => {
    const now = new Date();
    return splits
      .filter(s => {
        const d = new Date(s.date || s.createdAt);
        if (totalsPeriod === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (totalsPeriod === 'year')  return d.getFullYear() === now.getFullYear();
        return true;
      })
      .reduce((acc, s) => {
        const key = s.category || 'General';
        const ex  = acc.find(a => a.name === key);
        if (ex) ex.amount += s.totalAmount;
        else    acc.push({ name: key, amount: s.totalAmount });
        return acc;
      }, [])
      .sort((a, b) => b.amount - a.amount);
  })();

  // ─── getSplitStatus ───────────────────────────────────────────────────────
  const getSplitStatus = (sp) => {
    if (!MY_ID) return { type: 'none', amount: 0 };

    // My display name from group membership — ground truth for name fallbacks
    const myMemberName = group.members
      ?.find(m => String(m.userId ?? '').trim() === MY_ID)
      ?.name?.trim().toLowerCase() ?? '';

    // ── Am I the payer? ────────────────────────────────────────────────────
    const iPaid =
      String(sp.paidBy ?? '').trim() === MY_ID ||
      (myMemberName && sp.paidByName?.trim().toLowerCase() === myMemberName);

    // ── Find my share ──────────────────────────────────────────────────────
    const myShare = (sp.shares ?? []).find(s => {
      const sId = String(s.userId ?? '').trim();
      if (sId) return sId === MY_ID;
      return myMemberName && s.name?.trim().toLowerCase() === myMemberName;
    });

    // ── Return status ──────────────────────────────────────────────────────
    if (iPaid) {
      const unpaid = (sp.shares ?? []).filter(s => {
        if (s.isPaid) return false;
        const sId = String(s.userId ?? '').trim();
        return sId ? sId !== MY_ID : s.name?.trim().toLowerCase() !== myMemberName;
      });
      if (unpaid.length > 0) {
        const lent = unpaid.reduce((sum, s) => sum + (s.amount || 0), 0);
        if (lent > 0.005) return { type: 'lent', amount: parseFloat(lent.toFixed(2)) };
      }
      const myAmt = myShare?.amount ?? (sp.totalAmount / Math.max((sp.shares ?? []).length, 1));
      return { type: 'paid', amount: parseFloat(myAmt.toFixed(2)) };
    }

    if (myShare) {
      if (!myShare.isPaid) {
        return { type: 'borrowed', amount: parseFloat((myShare.amount || 0).toFixed(2)) };
      }
      return { type: 'settled', amount: parseFloat((myShare.amount || 0).toFixed(2)) };
    }

    return { type: 'none', amount: 0 };
  };

  return (
    <div className="g-page">
      <div className="g-page__hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="g-title">{TYPE_ICONS[group.type]} {group.name}</h1>
            <p className="g-sub">{group.members?.length} members · {fmtShort(totalSpent)} total</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={() => setShowMember(true)}>
            <UserPlus size={14} /> Add Member
          </button>
          <button className="g-btn g-btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Expense
          </button>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={() => setShowSettings(true)}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="g-tabs g-tabs--page">
        {['expenses', 'balances', 'totals'].map(t => (
          <button key={t} className={`g-tab-page ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'expenses' ? '💸 Expenses' : t === 'balances' ? '⚖️ Balances' : '📊 Totals'}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <div className="g-card">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="g-skeleton" />)
          ) : splits.length === 0 ? (
            <div className="g-empty">
              <ArrowLeftRight size={24} />
              <p>No expenses yet. Add the first one!</p>
              <button className="g-btn g-btn--primary" onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Add Expense
              </button>
            </div>
          ) : splits.map(sp => {
            const status = getSplitStatus(sp);
            // Resolve payer name: use stored paidByName, fallback to member lookup, then name-match
            const pbn = sp.paidByName
              || group.members?.find(m => m.userId?.toString() === sp.paidBy?.toString())?.name
              || 'Someone';
            const iP = String(sp.paidBy ?? '').trim() === MY_ID
              || sp.paidByName?.trim().toLowerCase() === group.members?.find(m => String(m.userId ?? '').trim() === MY_ID)?.name?.trim().toLowerCase();

            // ── Status display config ──────────────────────────────────────
            const STATUS = {
              lent:     { label: 'you lent',    color: '#22c55e' },
              paid:     { label: 'you paid',     color: '#22c55e' },
              settled:  { label: 'settled up',   color: '#22c55e' },
              borrowed: { label: 'you owe',      color: '#f97316' },
              none:     { label: 'not involved', color: 'rgba(255,255,255,0.28)' },
            };
            const s = STATUS[status.type] || STATUS.none;

            return (
              <div key={sp._id} className="sd-expense-row" onClick={() => setActiveSplit(sp)}>
                <div className="sd-expense-row__date">
                  <span className="sd-expense-row__mon">
                    {new Date(sp.date || sp.createdAt).toLocaleString('en-IN', { month: 'short' })}
                  </span>
                  <span className="sd-expense-row__day">
                    {new Date(sp.date || sp.createdAt).getDate()}
                  </span>
                </div>
                <div className="sd-expense-row__icon"><Receipt size={18} color="#888" /></div>
                <div className="sd-expense-row__info">
                  <span className="sd-expense-row__title">{sp.title}</span>
                  <span className="sd-expense-row__sub">{iP ? 'You paid' : `${pbn} paid`} {fmt(sp.totalAmount)}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginBottom: 2 }}>
                    {s.label}
                  </div>
                  {status.type !== 'none' && (
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                      {fmt(status.amount)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'balances' && (
        <BalancesTab balances={balances} group={group} currentUser={user} loading={loading} />
      )}

      {tab === 'totals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="g-tabs">
            {['month', 'year', 'all'].map(p => (
              <button key={p} className={`g-tab ${totalsPeriod === p ? 'active' : ''}`} onClick={() => setTotalsPeriod(p)}>
                {p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : 'All Time'}
              </button>
            ))}
          </div>
          <div className="g-totals-grid">
            {[
              { label: 'Total Spent',  val: fmtShort(totalsData.reduce((s, d) => s + d.amount, 0)) },
              { label: 'Transactions', val: splits.length },
              { label: 'Members',      val: group.members?.length },
              { label: 'Per Person',   val: fmtShort(totalsData.reduce((s, d) => s + d.amount, 0) / (group.members?.length || 1)) },
            ].map(c => (
              <div key={c.label} className="g-total-card">
                <span className="g-total-card__lbl">{c.label}</span>
                <span className="g-total-card__val">{c.val}</span>
              </div>
            ))}
          </div>
          {totalsData.length > 0 ? (
            <div className="g-card">
              <h3 className="g-section-title">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={totalsData} layout="vertical" margin={{ left: 60, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip formatter={v => [fmt(v), 'Amount']} contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12 }}>
                {totalsData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{d.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="g-empty"><BarChart2 size={24} /><p>No expenses in this period</p></div>
          )}
        </div>
      )}

      {showAdd && (
        <AddSplitModal
          group={group}
          currentUser={user}
          onClose={() => setShowAdd(false)}
          onAdded={() => { fetchData(); setShowAdd(false); }}
        />
      )}
      {showMember && (
        <AddMemberModal
          groupId={group._id}
          onClose={() => setShowMember(false)}
          onAdded={g => { setGroup(g); setShowMember(false); }}
        />
      )}
      {showSettings && (
        <GroupSettings
          group={group}
          currentUser={user}
          onClose={() => setShowSettings(false)}
          onGroupUpdated={g => setGroup(prev => ({ ...prev, ...g }))}
          onLeave={handleLeave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

// ─── Main Groups Page ─────────────────────────────────────────────────────────
const Groups = () => {
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newGroup,    setNewGroup]    = useState({ name: '', type: 'other', description: '' });
  const [creating,    setCreating]    = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then(r => setGroups(r.data?.data?.groups ?? r.data?.groups ?? []))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/groups', newGroup);
      setGroups(p => [res.data?.data?.group ?? res.data?.group ?? res.data, ...p]);
      setShowCreate(false);
      setNewGroup({ name: '', type: 'other', description: '' });
      toast.success('Group created!');
    } catch {
      toast.error('Failed to create group');
    } finally { setCreating(false); }
  };

  if (activeGroup) return (
    <GroupDetail
      group={activeGroup}
      onBack={() => setActiveGroup(null)}
      onDelete={id => setGroups(p => p.filter(g => g._id !== id))}
    />
  );

  return (
    <div className="g-page">
      <div className="g-page__hdr">
        <div><h1 className="g-title">Groups</h1><p className="g-sub">Manage shared expenses</p></div>
        <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="g-grid">{Array(4).fill(0).map((_, i) => <div key={i} className="g-skeleton g-skeleton--card" />)}</div>
      ) : groups.length === 0 ? (
        <div className="g-empty g-empty--page">
          <Users size={36} />
          <h3>No groups yet</h3>
          <p>Create a group to start splitting expenses with friends</p>
          <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create First Group
          </button>
        </div>
      ) : (
        <div className="g-grid">
          {groups.map(group => (
            <div key={group._id} className="g-group-card" onClick={() => setActiveGroup(group)}>
              <div className="g-group-card__body">
                <div className="g-group-card__hdr">
                  <span className="g-group-card__icon">{TYPE_ICONS[group.type]}</span>
                  <span className="g-group-card__type">{group.type}</span>
                </div>
                <h3 className="g-group-card__name">{group.name}</h3>
                {group.description && <p className="g-group-card__desc">{group.description}</p>}
                <div className="g-group-card__footer">
                  <span>{group.members?.length || 0} members</span>
                  <span>{fmtShort(group.totalExpenses || 0)}</span>
                  <ChevronRight size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="g-overlay" onClick={() => setShowCreate(false)}>
          <div className="g-modal" onClick={e => e.stopPropagation()}>
            <div className="g-modal__hdr">
              <h2>Create Group</h2>
              <button className="g-icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <form onSubmit={createGroup} className="g-modal__body">
              <div className="g-field">
                <label>Group Name</label>
                <input required className="g-input" value={newGroup.name}
                  onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Goa Trip 2026" autoFocus />
              </div>
              <div className="g-field">
                <label>Type</label>
                <div className="g-type-grid">
                  {GROUP_TYPES.map(t => (
                    <button key={t} type="button"
                      className={`g-type-chip ${newGroup.type === t ? 'active' : ''}`}
                      onClick={() => setNewGroup(p => ({ ...p, type: t }))}>
                      {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="g-field">
                <label>Description (optional)</label>
                <input className="g-input" value={newGroup.description}
                  onChange={e => setNewGroup(p => ({ ...p, description: e.target.value }))}
                  placeholder="What's this group for?" />
              </div>
              <div className="g-modal__ftr">
                <button type="button" className="g-btn g-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="g-btn g-btn--primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;