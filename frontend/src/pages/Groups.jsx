// frontend/src/pages/Groups.jsx
// ── COMPLETE REPLACEMENT — includes SplitDetail with all new features ─────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Users, ArrowLeftRight, X, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Trash2, CheckCircle,
  UserPlus, Mail, Phone, BarChart2, Settings, LogOut,
  Edit2, Bell, Camera, Send, ArrowLeft, Receipt,
  Image as ImageIcon, Pencil, MessageCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
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

const TYPE_ICONS = { trip: '✈️', flat: '🏠', office: '💼', family: '👨‍👩‍👧', event: '🎉', other: '👥' };
const GROUP_TYPES = ['trip', 'flat', 'office', 'family', 'event', 'other'];

// Avatar
const Avatar = ({ name = '', size = 38, you = false }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = [
    ['#6366f1', '#8b5cf6'], ['#ec4899', '#f43f5e'], ['#f97316', '#fb923c'],
    ['#22c55e', '#16a34a'], ['#06b6d4', '#0891b2'], ['#a855f7', '#9333ea'],
  ];
  const idx = name.charCodeAt(0) % colors.length;
  const [c1, c2] = colors[idx];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#fff',
      border: you ? '2px solid #6366f1' : 'none',
      boxShadow: you ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none',
    }}>
      {initials}
    </div>
  );
};

// Confirm Dialog
const Confirm = ({ msg, onYes, onNo, yesLabel = 'Delete', yesColor = '#ef4444', icon = '🗑️' }) => (
  <div className="g-overlay" onClick={onNo}>
    <div className="g-confirm" onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <h3>Are you sure?</h3>
      <p>{msg}</p>
      <div className="g-confirm__btns">
        <button className="g-btn g-btn--ghost" onClick={onNo}>Cancel</button>
        <button className="g-btn" style={{ background: yesColor, color: '#fff', flex: 1, justifyContent: 'center' }} onClick={onYes}>{yesLabel}</button>
      </div>
    </div>
  </div>
);

// ── Add Member Modal ───────────────────────────────────────────────────────────
const AddMemberModal = ({ groupId, onClose, onAdded }) => {
  const [method, setMethod] = useState('email');
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!value.trim()) { toast.error('Enter email or phone'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/groups/${groupId}/members`, {
        email: method === 'email' ? value.trim() : undefined,
        phone: method === 'sms' ? value.trim() : undefined,
        name: name.trim() || value.split('@')[0],
      });
      toast.success('Member added!');
      onAdded(res.data.group);
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
            <button className={`g-tab ${method === 'sms' ? 'active' : ''}`} onClick={() => setMethod('sms')}><Phone size={13} /> SMS</button>
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
          <button className="g-btn g-btn--primary" onClick={send} disabled={loading}>{loading ? 'Sending...' : 'Send Invite'}</button>
        </div>
      </div>
    </div>
  );
};

// ── Add Split Modal ────────────────────────────────────────────────────────────
const AddSplitModal = ({ group, onClose, onAdded }) => {
  const [form, setForm] = useState({ title: '', totalAmount: '', splitType: 'equal', category: 'General' });
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.splitType !== 'equal' && group?.members?.length > 0) {
      const count = group.members.length;
      setShares(group.members.map(m => ({
        userId: m.userId, name: m.name,
        amount: form.splitType === 'custom' ? ((parseFloat(form.totalAmount) || 0) / count).toFixed(2) : '',
        percentage: form.splitType === 'percentage' ? (100 / count).toFixed(1) : '',
      })));
    }
  }, [form.splitType, form.totalAmount, group]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        totalAmount: parseFloat(form.totalAmount),
        splitType: form.splitType,
        category: form.category,
      };
      if (form.splitType !== 'equal') {
        payload.shares = shares.map(s => ({
          userId: s.userId, name: s.name,
          amount: form.splitType === 'custom' ? parseFloat(s.amount) : undefined,
          percentage: form.splitType === 'percentage' ? parseFloat(s.percentage) : undefined,
        }));
      }
      const res = await api.post(`/groups/${group._id}/splits`, payload);
      toast.success('Expense added!');
      onAdded(res.data.split);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    } finally { setLoading(false); }
  };

  const total = parseFloat(form.totalAmount) || 0;
  const sharesTotal = shares.reduce((s, sh) => s + (parseFloat(sh.amount) || 0), 0);
  const pctTotal = shares.reduce((s, sh) => s + (parseFloat(sh.percentage) || 0), 0);

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
              placeholder="e.g. Zepto, Hotel Booking" autoFocus />
          </div>
          <div className="g-row">
            <div className="g-field">
              <label>Total Amount (₹)</label>
              <input required type="number" min="1" step="0.01" className="g-input"
                value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                placeholder="0" />
            </div>
            <div className="g-field">
              <label>Category</label>
              <input className="g-input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="General" />
            </div>
          </div>
          <div className="g-field">
            <label>Split Type</label>
            <div className="g-tabs">
              {['equal', 'custom', 'percentage'].map(t => (
                <button key={t} type="button"
                  className={`g-tab ${form.splitType === t ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, splitType: t }))}>
                  {t === 'equal' ? '⚖️ Equal' : t === 'custom' ? '✏️ Custom' : '% Percentage'}
                </button>
              ))}
            </div>
          </div>
          {form.splitType !== 'equal' && shares.length > 0 && (
            <div className="g-shares">
              <div className="g-shares__hdr">
                <span>Member Shares</span>
                <span className={`g-shares__total ${(form.splitType === 'custom' ? Math.abs(sharesTotal - total) < 0.5 : Math.abs(pctTotal - 100) < 0.1) ? 'valid' : 'invalid'}`}>
                  {form.splitType === 'custom' ? `₹${sharesTotal.toFixed(0)} / ₹${total.toFixed(0)}` : `${pctTotal.toFixed(1)}% / 100%`}
                </span>
              </div>
              {shares.map((s, i) => (
                <div key={i} className="g-share-row">
                  <span className="g-share-name">{s.name}</span>
                  <input type="number" min="0" step="0.01" className="g-input g-input--sm"
                    value={form.splitType === 'custom' ? s.amount : s.percentage}
                    onChange={e => {
                      const ns = [...shares];
                      if (form.splitType === 'custom') ns[i].amount = e.target.value;
                      else ns[i].percentage = e.target.value;
                      setShares(ns);
                    }}
                    placeholder={form.splitType === 'percentage' ? '%' : '₹'} />
                  <span className="g-share-suffix">{form.splitType === 'percentage' ? '%' : '₹'}</span>
                </div>
              ))}
            </div>
          )}
          <div className="g-modal__ftr">
            <button type="button" className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="g-btn g-btn--primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Split Modal ───────────────────────────────────────────────────────────
const EditSplitModal = ({ split, groupId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title:       split.title || '',
    totalAmount: split.totalAmount || '',
    category:    split.category || 'General',
    notes:       split.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/groups/${groupId}/splits/${split._id}`, {
        title:       form.title.trim(),
        totalAmount: parseFloat(form.totalAmount),
        category:    form.category.trim(),
        notes:       form.notes,
      });
      toast.success('Expense updated!');
      onSaved(res.data.split);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <div className="g-overlay" onClick={onClose}>
      <div className="g-modal" onClick={e => e.stopPropagation()}>
        <div className="g-modal__hdr">
          <h2>✏️ Edit Expense</h2>
          <button className="g-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="g-modal__body">
          <div className="g-field">
            <label>Title</label>
            <input required className="g-input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div className="g-row">
            <div className="g-field">
              <label>Total Amount (₹)</label>
              <input required type="number" min="0.01" step="0.01" className="g-input"
                value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div className="g-field">
              <label>Category</label>
              <input className="g-input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
          </div>
          <div className="g-field">
            <label>Notes</label>
            <textarea className="g-input" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add a note..." style={{ resize: 'vertical' }} />
          </div>
          <div className="g-modal__ftr">
            <button type="button" className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="g-btn g-btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Split Detail View ─────────────────────────────────────────────────────────
const SplitDetail = ({ split: initSplit, group, onBack, onSplitUpdated }) => {
  const { user } = useAuth();
  const [split, setSplit] = useState(initSplit);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [showBillFull, setShowBillFull] = useState(false);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const fileInputRef = useRef(null);
  const commentsEndRef = useRef(null);

  // Fetch full detail
  const fetchDetail = useCallback(async () => {
    try {
      const res = await api.get(`/groups/${group._id}/splits/${initSplit._id}/detail`);
      setSplit(res.data.split);
      setTrends(res.data.trends || []);
    } catch {
      toast.error('Failed to load expense details');
    } finally { setLoading(false); }
  }, [group._id, initSplit._id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Scroll comments to bottom when new comment added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [split.comments?.length]);

  // Who paid label
  const paidByName = split.paidByName ||
    group.members?.find(m => m.userId?.toString() === split.paidBy?.toString())?.name ||
    'Someone';

  // Determine current user's relationship to this split
  const myShare = split.shares?.find(s => s.userId?.toString() === user._id?.toString());
  const iPaid = split.paidBy?.toString() === user._id?.toString();

  const getShareLabel = (share) => {
    const isMe = share.userId?.toString() === user._id?.toString();
    if (isMe && iPaid) return 'You owe';
    if (isMe) return 'You owe';
    return `${share.name} owes`;
  };

  // Bill upload
  const handleBillUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBill(true);
    try {
      const formData = new FormData();
      formData.append('bill', file);
      const res = await api.post(
        `/groups/${group._id}/splits/${split._id}/bill`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setSplit(s => ({ ...s, billImage: res.data.billImage }));
      toast.success('Bill uploaded!');
    } catch {
      toast.error('Failed to upload bill');
    } finally { setUploadingBill(false); }
  };

  const handleDeleteBill = async () => {
    try {
      await api.delete(`/groups/${group._id}/splits/${split._id}/bill`);
      setSplit(s => ({ ...s, billImage: null }));
      toast.success('Bill removed');
    } catch {
      toast.error('Failed to remove bill');
    }
  };

  // Comments
  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/groups/${group._id}/splits/${split._id}/comments`, {
        text: commentText.trim(),
      });
      setSplit(s => ({ ...s, comments: [...(s.comments || []), res.data.comment] }));
      setCommentText('');
    } catch {
      toast.error('Failed to send comment');
    } finally { setSendingComment(false); }
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/groups/${group._id}/splits/${split._id}/comments/${commentId}`);
      setSplit(s => ({ ...s, comments: s.comments.filter(c => c._id !== commentId) }));
      setConfirmDeleteComment(null);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  // Max bar for trend chart
  const maxTrend = Math.max(...trends.map(t => t.amount), 1);

  return (
    <div className="sd-page">

      {/* ── Top Bar ── */}
      <div className="sd-topbar">
        <button className="sd-topbar__back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="sd-topbar__icon-btn-wrap">
          <button
            className="sd-topbar__icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload bill"
            disabled={uploadingBill}
          >
            {uploadingBill ? <div className="sd-spinner-sm" /> : <Camera size={20} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={handleBillUpload}
          />
          <button
            className="sd-topbar__icon-btn"
            onClick={() => setShowEdit(true)}
            title="Edit expense"
          >
            <Pencil size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="sd-loading"><div className="sd-spinner" /></div>
      ) : (
        <div className="sd-content">

          {/* ── Expense Header ── */}
          <div className="sd-header">
            <div className="sd-header__icon">
              <Receipt size={28} color="#6366f1" />
            </div>
            <div className="sd-header__info">
              <h1 className="sd-header__title">{split.title}</h1>
              <div className="sd-header__amount">{fmt(split.totalAmount)}</div>
              <div className="sd-header__meta">
                Added by <span>{paidByName}</span> on {fmtDate(split.date || split.createdAt)}
              </div>
            </div>
          </div>

          {/* ── Who Paid ── */}
          <div className="sd-section">
            <div className="sd-paid-row">
              <Avatar name={paidByName} size={44} you={iPaid} />
              <div className="sd-paid-row__info">
                <span className="sd-paid-row__label">
                  {iPaid ? 'You paid' : `${paidByName} paid`}
                </span>
                <span className="sd-paid-row__amount">{fmt(split.totalAmount)}</span>
              </div>
            </div>

            {/* Per-person breakdown */}
            <div className="sd-shares">
              {split.shares?.length > 0 ? (
                split.shares.map((share, i) => {
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
                })
              ) : (
                <div className="sd-share-row sd-share-row--equal">
                  <span>Split equally among {group.members?.length} members</span>
                  <span>{fmt(split.totalAmount / (group.members?.length || 1))} each</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Bill Image ── */}
          {split.billImage ? (
            <div className="sd-section">
              <div className="sd-section-title">
                <ImageIcon size={15} /> Bill / Receipt
              </div>
              <div className="sd-bill-preview" onClick={() => setShowBillFull(true)}>
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}${split.billImage}`}
                  alt="Bill"
                  className="sd-bill-img"
                />
                <div className="sd-bill-overlay">
                  <span>Tap to view full</span>
                </div>
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
                <span>{uploadingBill ? 'Uploading...' : 'Upload bill / receipt'}</span>
              </button>
            </div>
          )}

          {/* ── Spending Trends ── */}
          {trends.length > 0 && (
            <div className="sd-section">
              <div className="sd-section-title">
                <BarChart2 size={15} />
                Spending trends for {split.title} :: {split.category || 'General'}
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

          {/* ── Notes ── */}
          {split.notes && (
            <div className="sd-section">
              <div className="sd-section-title">📝 Notes</div>
              <p className="sd-notes">{split.notes}</p>
            </div>
          )}

          {/* ── Comments ── */}
          <div className="sd-section sd-section--comments">
            <div className="sd-section-title">
              <MessageCircle size={15} /> Comments ({split.comments?.length || 0})
            </div>

            <div className="sd-comments-list">
              {(!split.comments || split.comments.length === 0) ? (
                <div className="sd-comments-empty">No comments yet. Be the first!</div>
              ) : (
                split.comments.map((c, i) => {
                  const isMe = c.userId?.toString() === user._id?.toString();
                  return (
                    <div key={c._id || i} className={`sd-comment ${isMe ? 'sd-comment--me' : ''}`}>
                      {!isMe && <Avatar name={c.userName} size={30} />}
                      <div className="sd-comment__bubble">
                        {!isMe && <div className="sd-comment__author">{c.userName}</div>}
                        <div className="sd-comment__text">{c.text}</div>
                        <div className="sd-comment__time">
                          {fmtDateShort(c.createdAt)} · {fmtTime(c.createdAt)}
                          {isMe && (
                            <button
                              className="sd-comment__del"
                              onClick={() => setConfirmDeleteComment(c._id)}
                              title="Delete"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                      {isMe && <Avatar name={c.userName} size={30} you />}
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment Input */}
            <div className="sd-comment-input">
              <input
                className="sd-comment-input__field"
                placeholder="Add a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                maxLength={500}
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

        </div>
      )}

      {/* Full Bill Modal */}
      {showBillFull && split.billImage && (
        <div className="g-overlay" onClick={() => setShowBillFull(false)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setShowBillFull(false)}
              style={{ position: 'absolute', top: -16, right: -16, background: '#1a1a2e', border: '1px solid var(--color-border)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)', zIndex: 10 }}
            >
              <X size={16} />
            </button>
            <img
              src={`${import.meta.env.VITE_API_URL || ''}${split.billImage}`}
              alt="Bill full view"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <EditSplitModal
          split={split}
          groupId={group._id}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setSplit(s => ({ ...s, ...updated }));
            onSplitUpdated && onSplitUpdated(updated);
          }}
        />
      )}

      {/* Confirm Delete Comment */}
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
    </div>
  );
};

// ── Group Settings Panel ───────────────────────────────────────────────────────
const GroupSettings = ({ group, currentUser, onClose, onGroupUpdated, onLeave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const amAdmin = group.members?.some(
    m => m.userId?.toString() === currentUser._id?.toString() && m.role === 'admin'
  );

  const saveEdits = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/groups/${group._id}`, { name: editName, description: editDesc });
      toast.success('Group updated!');
      onGroupUpdated(res.data.group);
      setEditing(false);
    } catch { toast.error('Failed to update group'); }
    finally { setSaving(false); }
  };

  const removeMember = async (memberId, memberName) => {
    setRemovingId(memberId);
    try {
      const res = await api.delete(`/groups/${group._id}/members/${memberId}`);
      toast.success(`${memberName} removed`);
      onGroupUpdated(res.data.group);
    } catch { toast.error('Failed to remove member'); }
    finally { setRemovingId(null); }
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
                    <button className="g-btn g-btn--primary g-btn--sm" onClick={saveEdits} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
                    <button className="gs-remove-btn" onClick={() => removeMember(member._id, member.name)}
                      disabled={removingId === member._id}>
                      {removingId === member._id ? '...' : <X size={14} />}
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
        <AddMemberModal groupId={group._id} onClose={() => setShowAddMember(false)}
          onAdded={g => { onGroupUpdated(g); setShowAddMember(false); }} />
      )}
      {confirmLeave && (
        <Confirm icon="🚪" msg={`Leave "${group.name}"?`} yesLabel="Leave Group" yesColor="#f97316"
          onYes={() => { setConfirmLeave(false); onLeave(); }} onNo={() => setConfirmLeave(false)} />
      )}
      {confirmDelete && (
        <Confirm icon="🗑️" msg={`Permanently delete "${group.name}"? This cannot be undone.`} yesLabel="Delete Group" yesColor="#ef4444"
          onYes={() => { setConfirmDelete(false); onDelete(); }} onNo={() => setConfirmDelete(false)} />
      )}
    </>
  );
};

// ── Balances Tab ───────────────────────────────────────────────────────────────
const BalancesTab = ({ balances, group, currentUser, loading }) => {
  const [expanded, setExpanded] = useState({});

  if (loading) return <div className="g-empty"><div style={S.spinner} /></div>;
  if (!balances) return <div className="g-empty"><p>No balance data.</p></div>;

  const memberDebts = balances.memberBalances || [];
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="gsb-wrap">
      {memberDebts.length === 0 ? (
        <div className="g-empty">
          <CheckCircle size={32} color="#22c55e" />
          <p style={{ color: '#22c55e', fontWeight: 700 }}>Everyone is settled up! 🎉</p>
        </div>
      ) : memberDebts.map((member, i) => {
        const isYou = member.userId?.toString() === currentUser._id?.toString();
        const net = member.netBalance || 0;
        const isExpanded = expanded[member.userId || i];
        const memberOwes = (balances.settlements || []).filter(s => s.from?.toString() === member.userId?.toString());
        const memberOwed = (balances.settlements || []).filter(s => s.to?.toString() === member.userId?.toString());
        const allDebts = [...memberOwes, ...memberOwed];

        return (
          <div key={i} className="gsb-member-block">
            <button className="gsb-member-row" onClick={() => allDebts.length > 0 && toggle(member.userId || i)}>
              <Avatar name={member.name} size={42} you={isYou} />
              <div className="gsb-member-row__text">
                {net === 0 ? (
                  <span className="gsb-member-row__label"><strong>{isYou ? 'You are' : member.name + ' is'}</strong> settled up</span>
                ) : net > 0 ? (
                  <span className="gsb-member-row__label">
                    <strong>{isYou ? 'You get back' : member.name + ' gets back'}</strong>{' '}
                    <span className="gsb-amt gsb-amt--pos">{fmt(net)}</span> in total
                  </span>
                ) : (
                  <span className="gsb-member-row__label">
                    <strong>{isYou ? 'You owe' : member.name + ' owes'}</strong>{' '}
                    <span className="gsb-amt gsb-amt--neg">{fmt(Math.abs(net))}</span> in total
                  </span>
                )}
              </div>
              {allDebts.length > 0 && (
                <span className="gsb-chevron">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              )}
            </button>
            {isExpanded && (
              <div className="gsb-detail">
                {memberOwes.map((debt, j) => {
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
                {memberOwed.map((debt, j) => {
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

// ── Group Detail ───────────────────────────────────────────────────────────────
const GroupDetail = ({ group: initGroup, onBack, onDelete }) => {
  const { user } = useAuth();
  const [group, setGroup] = useState(initGroup);
  const [splits, setSplits] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expenses');
  const [showAdd, setShowAdd] = useState(false);
  const [showMember, setShowMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [totalsPeriod, setTotalsPeriod] = useState('all');
  const [activeSplit, setActiveSplit] = useState(null); // ← NEW: for SplitDetail

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sp, ba, gr] = await Promise.all([
        api.get(`/groups/${group._id}/splits`),
        api.get(`/groups/${group._id}/balances`),
        api.get(`/groups/${group._id}`),
      ]);
      setSplits(sp.data.splits || []);
      setBalances(ba.data);
      setGroup({ ...gr.data.group, _balances: ba.data });
    } catch { toast.error('Failed to load group data'); }
    finally { setLoading(false); }
  }, [group._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLeave = async () => {
    try {
      await api.post(`/groups/${group._id}/leave`);
      toast.success(`You left "${group.name}"`);
      onDelete(group._id);
      onBack();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to leave'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/groups/${group._id}`);
      toast.success('Group deleted');
      onDelete(group._id);
      onBack();
    } catch { toast.error('Failed to delete group'); }
  };

  // ── If a split is selected, show SplitDetail ─────────────────────────────
  if (activeSplit) {
    return (
      <SplitDetail
        split={activeSplit}
        group={group}
        onBack={() => setActiveSplit(null)}
        onSplitUpdated={(updated) => {
          setSplits(prev => prev.map(s => s._id === updated._id ? { ...s, ...updated } : s));
        }}
      />
    );
  }

  const totalSpent = splits.reduce((s, sp) => s + (sp.totalAmount || 0), 0);

  const totalsData = (() => {
    const now = new Date();
    return splits
      .filter(s => {
        if (totalsPeriod === 'month') return new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === now.getFullYear();
        if (totalsPeriod === 'year') return new Date(s.date).getFullYear() === now.getFullYear();
        return true;
      })
      .reduce((acc, s) => {
        const key = s.category || 'General';
        const ex = acc.find(a => a.name === key);
        if (ex) ex.amount += s.totalAmount;
        else acc.push({ name: key, amount: s.totalAmount });
        return acc;
      }, [])
      .sort((a, b) => b.amount - a.amount);
  })();

  // Helper: determine lent/borrowed status for current user per split
  const getSplitStatus = (split) => {
    const iPaid = split.paidBy?.toString() === user._id?.toString();
    const myShare = split.shares?.find(s => s.userId?.toString() === user._id?.toString());

    if (iPaid) {
      // I paid — I lent to others
      const myOwn = myShare?.amount || 0;
      const lentAmount = (split.totalAmount || 0) - myOwn;
      if (lentAmount > 0) return { type: 'lent', amount: lentAmount };
      return { type: 'paid', amount: split.totalAmount };
    }

    if (myShare) {
      // I owe someone
      return { type: 'borrowed', amount: myShare.amount };
    }

    // Not involved
    return { type: 'none', amount: 0 };
  };

  return (
    <div className="g-page">
      {/* Header */}
      <div className="g-page__hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="g-title">{TYPE_ICONS[group.type]} {group.name}</h1>
            <p className="g-sub">{group.members?.length} members · {fmtShort(group.totalExpenses || totalSpent)} total</p>
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

      {/* Tabs */}
      <div className="g-tabs g-tabs--page">
        {['expenses', 'balances', 'totals'].map(t => (
          <button key={t} className={`g-tab-page ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'expenses' ? '💸 Expenses' : t === 'balances' ? '⚖️ Balances' : '📊 Totals'}
          </button>
        ))}
      </div>

      {/* ── Expenses Tab ── */}
      {tab === 'expenses' && (
        <div className="g-card">
          {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="g-skeleton" />) :
            splits.length === 0 ? (
              <div className="g-empty">
                <ArrowLeftRight size={24} />
                <p>No expenses yet. Add the first one!</p>
                <button className="g-btn g-btn--primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Expense</button>
              </div>
            ) : splits.map(split => {
              const status = getSplitStatus(split);
              const paidByName = split.paidByName ||
                group.members?.find(m => m.userId?.toString() === split.paidBy?.toString())?.name ||
                'Someone';
              const iPaid = split.paidBy?.toString() === user._id?.toString();

              return (
                <div
                  key={split._id}
                  className="sd-expense-row"
                  onClick={() => setActiveSplit(split)}
                >
                  {/* Date column */}
                  <div className="sd-expense-row__date">
                    <span className="sd-expense-row__mon">
                      {new Date(split.date || split.createdAt).toLocaleString('en-IN', { month: 'short' })}
                    </span>
                    <span className="sd-expense-row__day">
                      {new Date(split.date || split.createdAt).getDate()}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="sd-expense-row__icon">
                    <Receipt size={18} color="#888" />
                  </div>

                  {/* Main info */}
                  <div className="sd-expense-row__info">
                    <span className="sd-expense-row__title">{split.title}</span>
                    <span className="sd-expense-row__sub">
                      {iPaid ? 'You paid' : `${paidByName} paid`} {fmt(split.totalAmount)}
                    </span>
                  </div>

                  {/* Lent / Borrowed / Not involved */}
                  <div className="sd-expense-row__status">
                    {status.type === 'lent' && (
                      <>
                        <span className="sd-status-label sd-status-label--lent">you lent</span>
                        <span className="sd-status-amt sd-status-amt--lent">{fmt(status.amount)}</span>
                      </>
                    )}
                    {status.type === 'borrowed' && (
                      <>
                        <span className="sd-status-label sd-status-label--borrowed">you borrowed</span>
                        <span className="sd-status-amt sd-status-amt--borrowed">{fmt(status.amount)}</span>
                      </>
                    )}
                    {status.type === 'paid' && (
                      <>
                        <span className="sd-status-label sd-status-label--lent">you paid</span>
                        <span className="sd-status-amt sd-status-amt--lent">{fmt(status.amount)}</span>
                      </>
                    )}
                    {status.type === 'none' && (
                      <span className="sd-status-label sd-status-label--none">not involved</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Balances Tab ── */}
      {tab === 'balances' && (
        <BalancesTab balances={balances} group={group} currentUser={user} loading={loading} />
      )}

      {/* ── Totals Tab ── */}
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
                  <Tooltip formatter={v => [fmt(v), 'Amount']}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
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

      {/* Modals */}
      {showAdd && <AddSplitModal group={group} onClose={() => setShowAdd(false)} onAdded={() => { fetchData(); setShowAdd(false); }} />}
      {showMember && <AddMemberModal groupId={group._id} onClose={() => setShowMember(false)} onAdded={g => { setGroup(g); setShowMember(false); }} />}
      {showSettings && (
        <GroupSettings group={group} currentUser={user}
          onClose={() => setShowSettings(false)}
          onGroupUpdated={g => setGroup({ ...g, _balances: balances })}
          onLeave={handleLeave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

// ── Main Groups Page ───────────────────────────────────────────────────────────
const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', type: 'other', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then(r => setGroups(r.data.groups || []))
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setLoading(false));
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/groups', newGroup);
      setGroups(p => [res.data.group, ...p]);
      setShowCreate(false);
      setNewGroup({ name: '', type: 'other', description: '' });
      toast.success('Group created!');
    } catch { toast.error('Failed to create group'); }
    finally { setCreating(false); }
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
        <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Group</button>
      </div>

      {loading ? (
        <div className="g-grid">{Array(4).fill(0).map((_, i) => <div key={i} className="g-skeleton g-skeleton--card" />)}</div>
      ) : groups.length === 0 ? (
        <div className="g-empty g-empty--page">
          <Users size={36} /><h3>No groups yet</h3>
          <p>Create a group to start splitting expenses with friends</p>
          <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Create First Group</button>
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
                <button type="submit" className="g-btn g-btn--primary" disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const S = {
  spinner: { width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'gSpin 0.7s linear infinite' },
};

export default Groups;