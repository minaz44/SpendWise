// frontend/src/pages/Groups.jsx
// Full Splitwise-style group expense management

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Users, ArrowLeftRight, X, ChevronRight,
  TrendingUp, TrendingDown, Trash2, CheckCircle,
  UserPlus, Mail, Phone, BarChart2, RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import '../styles/Groups.css';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(v||0);
const TYPE_ICONS = { trip:'✈️', flat:'🏠', office:'💼', family:'👨‍👩‍👧', event:'🎉', other:'👥' };
const GROUP_TYPES = ['trip','flat','office','family','event','other'];

// ── Confirm Dialog ────────────────────────────────────────────────────────────
const Confirm = ({ msg, onYes, onNo }) => (
  <div className="g-overlay" onClick={onNo}>
    <div className="g-confirm" onClick={e => e.stopPropagation()}>
      <div style={{ fontSize:36,marginBottom:12 }}>🗑️</div>
      <h3>Are you sure?</h3>
      <p>{msg}</p>
      <div className="g-confirm__btns">
        <button className="g-btn g-btn--ghost" onClick={onNo}>Cancel</button>
        <button className="g-btn g-btn--danger" onClick={onYes}>Delete</button>
      </div>
    </div>
  </div>
);

// ── Add Member Modal ──────────────────────────────────────────────────────────
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
      toast.success('Member added successfully!');
      onAdded(res.data.group);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally { setLoading(false); }
  };

  return (
    <div className="g-overlay" onClick={onClose}>
      <div className="g-modal" onClick={e => e.stopPropagation()}>
        <div className="g-modal__hdr"><h2>Add Member</h2><button className="g-icon-btn" onClick={onClose}><X size={16}/></button></div>
        <div className="g-modal__body">
          <div className="g-tabs">
            <button className={`g-tab ${method==='email'?'active':''}`} onClick={() => setMethod('email')}><Mail size={13}/> Email</button>
            <button className={`g-tab ${method==='sms'?'active':''}`} onClick={() => setMethod('sms')}><Phone size={13}/> SMS</button>
          </div>
          <div className="g-field">
            <label>{method==='email'?'Email Address':'Phone Number'}</label>
            <input className="g-input" type={method==='email'?'email':'tel'} value={value} onChange={e => setValue(e.target.value)}
              placeholder={method==='email'?'friend@gmail.com':'+91 9876543210'} autoFocus
              onKeyDown={e => e.key==='Enter' && send()} />
          </div>
          <div className="g-field">
            <label>Name (optional)</label>
            <input className="g-input" value={name} onChange={e => setName(e.target.value)} placeholder="Friend's name" />
          </div>
          <p className="g-note">{method==='email'?'📧 An invitation will be sent to their email':'📱 An SMS invitation will be sent to their phone'}</p>
        </div>
        <div className="g-modal__ftr">
          <button className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="g-btn g-btn--primary" onClick={send} disabled={loading}>{loading?'Sending...':'Send Invite'}</button>
        </div>
      </div>
    </div>
  );
};

// ── Add Split Modal ───────────────────────────────────────────────────────────
const AddSplitModal = ({ group, onClose, onAdded }) => {
  const [form,    setForm]    = useState({ title:'', totalAmount:'', splitType:'equal', category:'General' });
  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.splitType !== 'equal' && group?.members?.length > 0) {
      const count = group.members.length;
      setShares(group.members.map(m => ({
        userId: m.userId, name: m.name,
        amount: form.splitType==='custom' ? ((parseFloat(form.totalAmount)||0)/count).toFixed(2) : '',
        percentage: form.splitType==='percentage' ? (100/count).toFixed(1) : '',
      })));
    }
  }, [form.splitType, form.totalAmount, group]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { title: form.title, totalAmount: parseFloat(form.totalAmount), splitType: form.splitType, category: form.category };
      if (form.splitType !== 'equal') {
        payload.shares = shares.map(s => ({
          userId: s.userId, name: s.name,
          amount: form.splitType==='custom' ? parseFloat(s.amount) : undefined,
          percentage: form.splitType==='percentage' ? parseFloat(s.percentage) : undefined,
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

  const total = parseFloat(form.totalAmount)||0;
  const sharesTotal = shares.reduce((s,sh) => s+(parseFloat(sh.amount)||0), 0);
  const pctTotal    = shares.reduce((s,sh) => s+(parseFloat(sh.percentage)||0), 0);

  return (
    <div className="g-overlay" onClick={onClose}>
      <div className="g-modal g-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="g-modal__hdr"><h2>Add Expense</h2><button className="g-icon-btn" onClick={onClose}><X size={16}/></button></div>
        <form onSubmit={submit} className="g-modal__body">
          <div className="g-field">
            <label>Title</label>
            <input required className="g-input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Hotel Booking" />
          </div>
          <div className="g-row">
            <div className="g-field">
              <label>Total Amount (₹)</label>
              <input required type="number" min="1" step="0.01" className="g-input" value={form.totalAmount} onChange={e => setForm(f=>({...f,totalAmount:e.target.value}))} placeholder="0" />
            </div>
            <div className="g-field">
              <label>Category</label>
              <input className="g-input" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} placeholder="General" />
            </div>
          </div>
          <div className="g-field">
            <label>Split Type</label>
            <div className="g-tabs">
              {['equal','custom','percentage'].map(t => (
                <button key={t} type="button" className={`g-tab ${form.splitType===t?'active':''}`} onClick={() => setForm(f=>({...f,splitType:t}))}>
                  {t==='equal'?'⚖️ Equal':t==='custom'?'✏️ Custom':'% Percentage'}
                </button>
              ))}
            </div>
          </div>
          {form.splitType !== 'equal' && shares.length > 0 && (
            <div className="g-shares">
              <div className="g-shares__hdr">
                <span>Member Shares</span>
                <span className={`g-shares__total ${(form.splitType==='custom'?Math.abs(sharesTotal-total)<0.5:Math.abs(pctTotal-100)<0.1)?'valid':'invalid'}`}>
                  {form.splitType==='custom'?`₹${sharesTotal.toFixed(0)} / ₹${total.toFixed(0)}`:`${pctTotal.toFixed(1)}% / 100%`}
                </span>
              </div>
              {shares.map((s,i) => (
                <div key={i} className="g-share-row">
                  <span className="g-share-name">{s.name}</span>
                  <input type="number" min="0" step="0.01" className="g-input g-input--sm"
                    value={form.splitType==='custom'?s.amount:s.percentage}
                    onChange={e => { const ns=[...shares]; if(form.splitType==='custom')ns[i].amount=e.target.value; else ns[i].percentage=e.target.value; setShares(ns); }}
                    placeholder={form.splitType==='percentage'?'%':'₹'} />
                  <span className="g-share-suffix">{form.splitType==='percentage'?'%':'₹'}</span>
                </div>
              ))}
            </div>
          )}
          <div className="g-modal__ftr">
            <button type="button" className="g-btn g-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="g-btn g-btn--primary" disabled={loading}>{loading?'Adding...':'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Group Detail ──────────────────────────────────────────────────────────────
const GroupDetail = ({ group: initGroup, onBack, onDelete }) => {
  const { user }  = useAuth();
  const [group,   setGroup]   = useState(initGroup);
  const [splits,  setSplits]  = useState([]);
  const [balances,setBalances]= useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('expenses'); // expenses | balances | totals
  const [showAdd,     setShowAdd]     = useState(false);
  const [showMember,  setShowMember]  = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [totalsPeriod,setTotalsPeriod]= useState('all');

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
      setGroup(gr.data.group);
    } catch { toast.error('Failed to load group data'); }
    finally { setLoading(false); }
  }, [group._id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const settleShare = async (splitId) => {
    try {
      await api.put(`/groups/${group._id}/splits/${splitId}/settle`, { userId: user._id });
      toast.success('Marked as settled! ✅');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to settle'); }
  };

  const deleteGroup = async () => {
    try {
      await api.delete(`/groups/${group._id}`);
      toast.success('Group deleted');
      onDelete(group._id);
      onBack();
    } catch { toast.error('Failed to delete group'); }
  };

  // ── Totals chart data ──────────────────────────────────────────────────────
  const totalsData = (() => {
    const now = new Date();
    return splits
      .filter(s => {
        if (totalsPeriod === 'month') return new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === now.getFullYear();
        if (totalsPeriod === 'year')  return new Date(s.date).getFullYear() === now.getFullYear();
        return true; // all
      })
      .reduce((acc, s) => {
        const key = s.category || 'General';
        const ex  = acc.find(a => a.name === key);
        if (ex) ex.amount += s.totalAmount;
        else acc.push({ name: key, amount: s.totalAmount });
        return acc;
      }, [])
      .sort((a,b) => b.amount - a.amount);
  })();

  const totalSpent = splits.reduce((s, sp) => s + (sp.totalAmount||0), 0);

  return (
    <div className="g-page">
      {/* Header */}
      <div className="g-page__hdr">
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={onBack}>← Back</button>
          <div>
            <h1 className="g-title">{TYPE_ICONS[group.type]} {group.name}</h1>
            <p className="g-sub">{group.members?.length} members · {fmt(group.totalExpenses || totalSpent)} total</p>
          </div>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <button className="g-btn g-btn--ghost g-btn--sm" onClick={() => setShowMember(true)}><UserPlus size={14}/> Add Member</button>
          <button className="g-btn g-btn--primary" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Expense</button>
          <button className="g-btn g-btn--danger-ghost g-btn--sm" onClick={() => setConfirmDel(true)}><Trash2 size={14}/></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="g-tabs g-tabs--page">
        {['expenses','balances','totals'].map(t => (
          <button key={t} className={`g-tab-page ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t==='expenses'?'💸 Expenses':t==='balances'?'⚖️ Balances':'📊 Totals'}
          </button>
        ))}
      </div>

      {/* ── Expenses Tab ── */}
      {tab === 'expenses' && (
        <div className="g-card">
          {loading ? Array(3).fill(0).map((_,i) => <div key={i} className="g-skeleton"/>) :
            splits.length === 0 ? (
              <div className="g-empty"><ArrowLeftRight size={24}/><p>No expenses yet. Add the first one!</p><button className="g-btn g-btn--primary" onClick={() => setShowAdd(true)}><Plus size={14}/> Add Expense</button></div>
            ) : splits.map(split => {
              const myShare   = split.shares?.find(s => s.userId?.toString() === user._id?.toString());
              const myPaid    = myShare?.isPaid || split.paidBy?.toString() === user._id?.toString() || split.isSettled;
              return (
                <div key={split._id} className={`g-split-row ${split.isSettled?'g-split-row--settled':''}`}>
                  <div className="g-split-row__info">
                    <span className="g-split-row__title">{split.title}</span>
                    <span className="g-split-row__meta">{split.category} · {new Date(split.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {split.splitType}</span>
                    {split.shares?.length > 0 && (
                      <div className="g-shares-list">
                        {split.shares.map((s,i) => (
                          <span key={i} className={`g-share-chip ${s.isPaid?'g-share-chip--paid':''}`}>
                            {s.isPaid?'✓ ':''}{s.name}: {fmt(s.amount)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="g-split-row__right">
                    <span className="g-split-row__amt">{fmt(split.totalAmount)}</span>
                    {split.isSettled ? <span className="g-settled-badge"><CheckCircle size={11}/> Settled</span> :
                      myPaid ? <span className="g-paid-badge">Your share paid</span> :
                      <button className="g-btn g-btn--primary g-btn--sm" onClick={() => settleShare(split._id)}>Settle Up</button>
                    }
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* ── Balances Tab ── */}
      {tab === 'balances' && (
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {/* My balance summary */}
          {balances && (
            <div className={`g-balance-card ${(balances.myBalance||0)>=0?'g-balance-card--pos':'g-balance-card--neg'}`}>
              <div className="g-balance-card__icon">
                {(balances.myBalance||0)>=0?<TrendingUp size={22}/>:<TrendingDown size={22}/>}
              </div>
              <div>
                <div className="g-balance-card__amt">{(balances.myBalance||0)>=0?'+':''}{fmt(balances.myBalance)}</div>
                <div className="g-balance-card__lbl">{(balances.myBalance||0)>=0?'You are owed':'You owe'}</div>
              </div>
            </div>
          )}

          {/* Detailed per-member balances */}
          {balances?.memberBalances?.length > 0 && (
            <div className="g-card">
              <h3 className="g-section-title">All Balances</h3>
              {balances.memberBalances.map((m,i) => (
                <div key={i} className="g-member-balance">
                  <div className="g-member-balance__avatar">{m.name?.slice(0,2).toUpperCase()}</div>
                  <span className="g-member-balance__name">{m.name}</span>
                  <span className={`g-member-balance__amt ${m.netBalance>=0?'pos':'neg'}`}>
                    {m.netBalance===0?'Settled':m.netBalance>0?`gets back ${fmt(m.netBalance)}`:`owes ${fmt(Math.abs(m.netBalance))}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Who owes whom */}
          {balances?.iOwe?.length > 0 && (
            <div className="g-card">
              <h3 className="g-section-title">You Owe</h3>
              {balances.iOwe.map((d,i) => (
                <div key={i} className="g-debt-row">
                  <span>To <strong>{d.to}</strong></span>
                  <span className="g-debt-row__amt neg">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {balances?.owedToMe?.length > 0 && (
            <div className="g-card">
              <h3 className="g-section-title">Owed To You</h3>
              {balances.owedToMe.map((d,i) => (
                <div key={i} className="g-debt-row">
                  <span>From <strong>{d.from}</strong></span>
                  <span className="g-debt-row__amt pos">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Members list */}
          <div className="g-card">
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <h3 className="g-section-title" style={{ margin:0 }}>Members ({group.members?.length})</h3>
              <button className="g-btn g-btn--ghost g-btn--sm" onClick={() => setShowMember(true)}><UserPlus size={13}/> Add</button>
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
              {group.members?.map((m,i) => (
                <div key={i} className="g-member-chip">
                  <div className="g-member-chip__av">{m.name?.slice(0,2).toUpperCase()}</div>
                  <span>{m.name}</span>
                  {m.role==='admin'&&<span className="g-admin-badge">Admin</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Totals Tab ── */}
      {tab === 'totals' && (
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {/* Period selector */}
          <div className="g-tabs">
            {['month','year','all'].map(p => (
              <button key={p} className={`g-tab ${totalsPeriod===p?'active':''}`} onClick={() => setTotalsPeriod(p)}>
                {p==='month'?'This Month':p==='year'?'This Year':'All Time'}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="g-totals-grid">
            <div className="g-total-card">
              <span className="g-total-card__lbl">Total Spent</span>
              <span className="g-total-card__val">{fmt(totalsData.reduce((s,d)=>s+d.amount,0))}</span>
            </div>
            <div className="g-total-card">
              <span className="g-total-card__lbl">Transactions</span>
              <span className="g-total-card__val">{splits.filter(s => {
                const now=new Date();
                if(totalsPeriod==='month') return new Date(s.date).getMonth()===now.getMonth()&&new Date(s.date).getFullYear()===now.getFullYear();
                if(totalsPeriod==='year') return new Date(s.date).getFullYear()===now.getFullYear();
                return true;
              }).length}</span>
            </div>
            <div className="g-total-card">
              <span className="g-total-card__lbl">Members</span>
              <span className="g-total-card__val">{group.members?.length}</span>
            </div>
            <div className="g-total-card">
              <span className="g-total-card__lbl">Per Person (avg)</span>
              <span className="g-total-card__val">{fmt((totalsData.reduce((s,d)=>s+d.amount,0))/(group.members?.length||1))}</span>
            </div>
          </div>

          {/* Category breakdown chart */}
          {totalsData.length > 0 && (
            <div className="g-card">
              <h3 className="g-section-title">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={totalsData} layout="vertical" margin={{ left:60, right:20, top:5, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize:11,fill:'var(--color-text-muted)' }} axisLine={false} tickLine={false}
                    tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11,fill:'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={58}/>
                  <Tooltip formatter={v=>[fmt(v),'Amount']} contentStyle={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,fontSize:12 }}/>
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[0,4,4,0]} maxBarSize={22}/>
                </BarChart>
              </ResponsiveContainer>

              {/* Category list */}
              <div style={{ marginTop:12 }}>
                {totalsData.map((d,i) => (
                  <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--color-border)',fontSize:13 }}>
                    <span style={{ color:'var(--color-text-secondary)' }}>{d.name}</span>
                    <span style={{ fontWeight:700,color:'var(--color-text-primary)' }}>{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalsData.length === 0 && (
            <div className="g-empty"><BarChart2 size={24}/><p>No expenses in this period</p></div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAdd    && <AddSplitModal  group={group} onClose={() => setShowAdd(false)} onAdded={() => { fetchData(); setShowAdd(false); }}/>}
      {showMember && <AddMemberModal groupId={group._id} onClose={() => setShowMember(false)} onAdded={g => { setGroup(g); setShowMember(false); }}/>}
      {confirmDel && <Confirm msg={`Delete "${group.name}"? This cannot be undone.`} onYes={deleteGroup} onNo={() => setConfirmDel(false)}/>}
    </div>
  );
};

// ── Main Groups Page ──────────────────────────────────────────────────────────
const Groups = () => {
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(null);
  const [newGroup,    setNewGroup]    = useState({ name:'', type:'other', description:'' });
  const [creating,    setCreating]    = useState(false);

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
      setNewGroup({ name:'', type:'other', description:'' });
      toast.success('Group created!');
    } catch { toast.error('Failed to create group'); }
    finally { setCreating(false); }
  };

  const deleteGroup = async () => {
    try {
      await api.delete(`/groups/${confirmDel}`);
      setGroups(p => p.filter(g => g._id !== confirmDel));
      toast.success('Group deleted');
    } catch { toast.error('Failed to delete group'); }
    finally { setConfirmDel(null); }
  };

  if (activeGroup) return <GroupDetail group={activeGroup} onBack={() => setActiveGroup(null)} onDelete={id => setGroups(p => p.filter(g => g._id !== id))}/>;

  return (
    <div className="g-page">
      <div className="g-page__hdr">
        <div><h1 className="g-title">Groups</h1><p className="g-sub">Manage shared expenses</p></div>
        <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}><Plus size={15}/> New Group</button>
      </div>

      {loading ? (
        <div className="g-grid">{Array(4).fill(0).map((_,i) => <div key={i} className="g-skeleton g-skeleton--card"/>)}</div>
      ) : groups.length === 0 ? (
        <div className="g-empty g-empty--page">
          <Users size={36}/><h3>No groups yet</h3>
          <p>Create a group to start splitting expenses with friends</p>
          <button className="g-btn g-btn--primary" onClick={() => setShowCreate(true)}><Plus size={14}/> Create First Group</button>
        </div>
      ) : (
        <div className="g-grid">
          {groups.map(group => (
            <div key={group._id} className="g-group-card">
              <div className="g-group-card__body" onClick={() => setActiveGroup(group)}>
                <div className="g-group-card__hdr">
                  <span className="g-group-card__icon">{TYPE_ICONS[group.type]}</span>
                  <span className="g-group-card__type">{group.type}</span>
                </div>
                <h3 className="g-group-card__name">{group.name}</h3>
                {group.description && <p className="g-group-card__desc">{group.description}</p>}
                <div className="g-group-card__footer">
                  <span>{group.members?.length||0} members</span>
                  <span>{fmt(group.totalExpenses||0)}</span>
                  <ChevronRight size={13}/>
                </div>
              </div>
              <button className="g-group-card__del" onClick={() => setConfirmDel(group._id)} title="Delete"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="g-overlay" onClick={() => setShowCreate(false)}>
          <div className="g-modal" onClick={e => e.stopPropagation()}>
            <div className="g-modal__hdr"><h2>Create Group</h2><button className="g-icon-btn" onClick={() => setShowCreate(false)}><X size={16}/></button></div>
            <form onSubmit={createGroup} className="g-modal__body">
              <div className="g-field">
                <label>Group Name</label>
                <input required className="g-input" value={newGroup.name} onChange={e => setNewGroup(p=>({...p,name:e.target.value}))} placeholder="e.g. Goa Trip 2026" />
              </div>
              <div className="g-field">
                <label>Type</label>
                <div className="g-type-grid">
                  {GROUP_TYPES.map(t => (
                    <button key={t} type="button" className={`g-type-chip ${newGroup.type===t?'active':''}`} onClick={() => setNewGroup(p=>({...p,type:t}))}>
                      {TYPE_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="g-field">
                <label>Description (optional)</label>
                <input className="g-input" value={newGroup.description} onChange={e => setNewGroup(p=>({...p,description:e.target.value}))} placeholder="What's this group for?" />
              </div>
              <div className="g-modal__ftr">
                <button type="button" className="g-btn g-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="g-btn g-btn--primary" disabled={creating}>{creating?'Creating...':'Create Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && <Confirm msg="Delete this group? All expenses will be lost." onYes={deleteGroup} onNo={() => setConfirmDel(null)}/>}
    </div>
  );
};

export default Groups;