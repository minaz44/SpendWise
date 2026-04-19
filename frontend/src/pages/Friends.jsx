// frontend/src/pages/Friends.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, TrendingDown, Search, UserPlus,
  X, Check, UserMinus, Clock, RefreshCw, ArrowRight,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import '../styles/Friends.css';

const fmt = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(v || 0);

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name = '', size = 38 }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = [
    ['#6366f1', '#8b5cf6'], ['#ec4899', '#f43f5e'], ['#f97316', '#fb923c'],
    ['#22c55e', '#16a34a'], ['#06b6d4', '#0891b2'], ['#a855f7', '#9333ea'],
  ];
  const [c1, c2] = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg,${c1},${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 800, color: '#fff',
    }}>{initials}</div>
  );
};

// ── Add Friend Modal ──────────────────────────────────────────────────────────
const AddFriendModal = ({ onClose, onRequestSent }) => {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);
  const [tab,     setTab]     = useState('search');

  const searchUsers = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/friends/search?q=${encodeURIComponent(q.trim())}`);
      setResults(res?.data?.users || res?.users || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 400);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  const sendByUserId = async (userId, name) => {
    setSending(userId);
    try {
      const userEmail = results.find(r => r._id === userId)?.email;
      await api.post('/friends/request', { email: userEmail });
      toast.success(`Friend request sent to ${name}!`);
      setResults(prev =>
        prev.map(r => r._id === userId ? { ...r, friendStatus: 'pending' } : r)
      );
      onRequestSent?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send request');
    } finally {
      setSending(null);
    }
  };

  const sendByEmail = async () => {
    if (!email.trim()) { toast.error('Enter an email address'); return; }
    setSending('email');
    try {
      await api.post('/friends/request', { email: email.trim() });
      toast.success('Friend request sent!');
      setEmail('');
      onRequestSent?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send request');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fr-overlay" onClick={onClose}>
      <div className="fr-modal" onClick={e => e.stopPropagation()}>
        <div className="fr-modal__hdr">
          <h2>Add Friend</h2>
          <button className="fr-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="fr-tabs">
          <button className={`fr-tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
            🔍 Search Users
          </button>
          <button className={`fr-tab ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}>
            📧 Send by Email
          </button>
        </div>

        <div className="fr-modal__body">
          {tab === 'search' ? (
            <>
              <div className="fr-search-wrap">
                <Search size={15} className="fr-search-ico" />
                <input
                  className="fr-search-input"
                  placeholder="Search by name or email..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
                {loading && <div className="fr-spin-sm" />}
              </div>
              <div className="fr-results">
                {results.length === 0 && query.length >= 2 && !loading && (
                  <div className="fr-empty-sm">No users found. Try sending by email instead.</div>
                )}
                {results.map(u => (
                  <div key={u._id} className="fr-result-row">
                    <Avatar name={u.name} size={36} />
                    <div className="fr-result-info">
                      <span className="fr-result-name">{u.name}</span>
                      <span className="fr-result-email">{u.email}</span>
                    </div>
                    {u.friendStatus === 'accepted' ? (
                      <span className="fr-badge fr-badge--friend">✓ Friends</span>
                    ) : u.friendStatus === 'pending' ? (
                      <span className="fr-badge fr-badge--pending"><Clock size={11} /> Sent</span>
                    ) : (
                      <button
                        className="fr-btn fr-btn--primary fr-btn--sm"
                        disabled={sending === u._id}
                        onClick={() => sendByUserId(u._id, u.name)}
                      >
                        {sending === u._id ? '...' : <><UserPlus size={13} /> Add</>}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="fr-field">
                <label>Email Address</label>
                <input
                  className="fr-input"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendByEmail()}
                  autoFocus
                />
              </div>
              <p className="fr-note">📧 A friend request will be sent to their email</p>
              <button
                className="fr-btn fr-btn--primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                onClick={sendByEmail}
                disabled={sending === 'email'}
              >
                {sending === 'email' ? 'Sending...' : 'Send Friend Request'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Friends Page ─────────────────────────────────────────────────────────
const Friends = () => {
  const { user }   = useAuth();
  const [tab,      setTab]      = useState('friends');
  const [friends,  setFriends]  = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [balances, setBalances] = useState([]);   // cumulative cross-group balances
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [balLoading, setBalLoading] = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [acting,   setActing]   = useState(null);
  const [errors,   setErrors]   = useState({ friends: false, requests: false, balances: false });

  // ── Fetch friends list + requests ─────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setErrors(e => ({ ...e, friends: false, requests: false }));
    try {
      const res = await api.get('/friends');
      // Shape: { success, data: { friends, pendingReceived, pendingSent } }
      const payload = res?.data?.data ?? res?.data ?? {};

      setFriends(
        (payload.friends || []).map(r => ({
          _id:   r._id,
          name:  r.friend?.name  || r.name  || '',
          email: r.friend?.email || r.email || '',
          since: r.since,
        }))
      );

      setRequests({
        received: (payload.pendingReceived || []).map(r => ({
          _id:  r._id,
          from: r.friend || { _id: r._id, name: r.name, email: r.email },
        })),
        sent: (payload.pendingSent || []).map(r => ({
          _id: r._id,
          to:  r.friend || { _id: r._id, name: r.name, email: r.email },
        })),
      });
    } catch {
      setErrors(e => ({ ...e, friends: true, requests: true }));
      toast.error('Failed to load friends list');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch cumulative balances across ALL groups ────────────────────────────
  //
  // API: GET /groups              → { success, data: { groups[] } }
  // API: GET /groups/:id/balances → { success, data: { myBalance, iOwe[], owedToMe[], allDebts[], netBalances{} } }
  //
  // iOwe[]     = [{ from: myId,      to: otherUserId, amount }]  ← I owe someone
  // owedToMe[] = [{ from: otherUserId, to: myId,      amount }]  ← someone owes me
  //
  // We aggregate by the OTHER person's userId, summing across groups, and
  // resolve their display name from the group members list.
  // ─────────────────────────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!user?._id) return;
    setBalLoading(true);
    setErrors(e => ({ ...e, balances: false }));

    try {
      // Step 1: get all groups the user belongs to
      const groupsRes = await api.get('/groups');
      const groupList =
        groupsRes?.data?.data?.groups ??   // { success, data: { groups } }
        groupsRes?.data?.groups       ??   // flat { groups }
        groupsRes?.groups             ??
        [];

      if (groupList.length === 0) {
        setBalances([]);
        setBalLoading(false);
        return;
      }

      // Step 2: fetch balances for every group in parallel
      const results = await Promise.allSettled(
        groupList.map(g => api.get(`/groups/${g._id}/balances`).then(r => ({ g, r })))
      );

      // Step 3: build a map keyed by the OTHER person's userId
      // balanceMap[otherUserId] = { name, iOweTotal, theyOweTotal, groups[] }
      const myId      = user._id?.toString();
      const balMap    = {};

      // Build a lookup: userId → name from all group members across all groups
      const nameById  = {};
      groupList.forEach(g => {
        (g.members || []).forEach(m => {
          if (m.userId) nameById[m.userId.toString()] = m.name;
        });
      });

      results.forEach(result => {
        if (result.status !== 'fulfilled') return;
        const { g, r } = result.value;

        // Response shape confirmed from split.controller.js getBalances():
        // res.data = { success, data: { myBalance, iOwe, owedToMe, allDebts, netBalances } }
        const data      = r?.data?.data ?? r?.data ?? {};
        const iOwe      = data.iOwe      || [];   // debts where I owe someone
        const owedToMe  = data.owedToMe  || [];   // debts where someone owes me

        // iOwe entries: { from: myId, to: otherId, amount }
        iOwe.forEach(debt => {
          const otherId = debt.to?.toString();
          if (!otherId || otherId === myId) return;
          const name = nameById[otherId] || debt.toName || otherId;
          if (!balMap[otherId]) balMap[otherId] = { name, iOweTotal: 0, theyOweTotal: 0, groups: [] };
          balMap[otherId].iOweTotal += debt.amount;
          if (!balMap[otherId].groups.includes(g.name)) balMap[otherId].groups.push(g.name);
        });

        // owedToMe entries: { from: otherId, to: myId, amount }
        owedToMe.forEach(debt => {
          const otherId = debt.from?.toString();
          if (!otherId || otherId === myId) return;
          const name = nameById[otherId] || debt.fromName || otherId;
          if (!balMap[otherId]) balMap[otherId] = { name, iOweTotal: 0, theyOweTotal: 0, groups: [] };
          balMap[otherId].theyOweTotal += debt.amount;
          if (!balMap[otherId].groups.includes(g.name)) balMap[otherId].groups.push(g.name);
        });
      });

      // Step 4: convert to sorted array
      // net > 0 → they owe me | net < 0 → I owe them
      const balArray = Object.entries(balMap)
        .map(([uid, b]) => ({
          userId:      uid,
          name:        b.name,
          iOweTotal:   parseFloat(b.iOweTotal.toFixed(2)),
          theyOweTotal: parseFloat(b.theyOweTotal.toFixed(2)),
          net:         parseFloat((b.theyOweTotal - b.iOweTotal).toFixed(2)),
          groups:      b.groups,
        }))
        .filter(b => Math.abs(b.net) > 0.005)          // hide fully settled
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)); // largest balance first

      setBalances(balArray);
    } catch (err) {
      console.error('[Friends] fetchBalances error:', err);
      setErrors(e => ({ ...e, balances: true }));
    } finally {
      setBalLoading(false);
    }
  }, [user?._id]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchFriends(), fetchBalances()]);
  }, [fetchFriends, fetchBalances]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Accept / Decline / Remove ─────────────────────────────────────────────
  const accept = async (friendshipId, name) => {
    setActing(friendshipId);
    try {
      await api.put(`/friends/${friendshipId}/accept`);
      toast.success(`You are now friends with ${name}! 🎉`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept request');
    } finally { setActing(null); }
  };

  const reject = async (friendshipId) => {
    setActing(friendshipId);
    try {
      await api.put(`/friends/${friendshipId}/decline`);
      toast.success('Request declined');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decline request');
    } finally { setActing(null); }
  };

  const removeFriend = async (friendshipId, name) => {
    if (!window.confirm(`Remove ${name} from friends?`)) return;
    setActing(friendshipId);
    try {
      await api.delete(`/friends/${friendshipId}`);
      toast.success(`${name} removed from friends`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove friend');
    } finally { setActing(null); }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const filteredFriends = friends.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalIOwe    = balances.reduce((s, b) => s + Math.max(0, -b.net), 0);
  const totalOwedMe  = balances.reduce((s, b) => s + Math.max(0,  b.net), 0);
  const pendingCount = requests.received?.length || 0;

  return (
    <div className="fr-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="fr-page__hdr">
        <div>
          <h1 className="fr-title">Friends</h1>
          <p className="fr-sub">Connect and split expenses with friends</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="fr-btn fr-btn--ghost fr-btn--sm" onClick={fetchAll} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className="fr-btn fr-btn--primary" onClick={() => setShowAdd(true)}>
            <UserPlus size={15} /> Add Friend
          </button>
        </div>
      </div>

      {/* ── Balance Summary Card (Splitwise-style) ──────────────────────────── */}
      <div className="fr-summary-row">
        <div className={`fr-sum-card ${totalOwedMe >= totalIOwe ? 'fr-sum-card--pos' : 'fr-sum-card--neg'}`}>
          <div className="fr-sum-card__icon">
            {totalOwedMe >= totalIOwe ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div>
            <div className="fr-sum-card__lbl">Overall Balance</div>
            <div className="fr-sum-card__val">
              {totalOwedMe >= totalIOwe
                ? totalOwedMe - totalIOwe < 0.005
                  ? 'You are all settled up'
                  : `You are owed ${fmt(totalOwedMe - totalIOwe)}`
                : `You owe ${fmt(totalIOwe - totalOwedMe)}`}
            </div>
          </div>
        </div>
        <div className="fr-sum-pills">
          <div className="fr-pill fr-pill--neg">
            <TrendingDown size={13} /> You owe {fmt(totalIOwe)}
          </div>
          <div className="fr-pill fr-pill--pos">
            <TrendingUp size={13} /> Owed to you {fmt(totalOwedMe)}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="fr-tabs fr-tabs--page">
        <button className={`fr-tab-page ${tab === 'friends'  ? 'active' : ''}`} onClick={() => setTab('friends')}>
          👥 Friends ({friends.length})
        </button>
        <button className={`fr-tab-page ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          🔔 Requests
          {pendingCount > 0 && <span className="fr-badge-count">{pendingCount}</span>}
        </button>
        <button className={`fr-tab-page ${tab === 'balances' ? 'active' : ''}`} onClick={() => setTab('balances')}>
          ⚖️ Balances
          {balances.length > 0 && <span className="fr-badge-count">{balances.length}</span>}
        </button>
      </div>

      {/* ── Friends Tab ──────────────────────────────────────────────────────── */}
      {tab === 'friends' && (
        <>
          {friends.length > 0 && (
            <div className="fr-search-wrap" style={{ marginBottom: '0.75rem' }}>
              <Search size={15} className="fr-search-ico" />
              <input
                className="fr-search-input"
                placeholder="Search friends..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <div className="fr-card">
            {loading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="fr-skeleton" />)
            ) : errors.friends ? (
              <div className="fr-empty">
                <p style={{ color: 'var(--color-error, #ef4444)' }}>Could not load friends. Check your connection.</p>
                <button className="fr-btn fr-btn--ghost fr-btn--sm" onClick={fetchFriends}><RefreshCw size={13} /> Retry</button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="fr-empty">
                <Users size={32} />
                <h3>{search ? 'No friends match your search' : 'No friends yet'}</h3>
                <p>{search ? 'Try a different name' : 'Add friends to split expenses together'}</p>
                {!search && (
                  <button className="fr-btn fr-btn--primary" onClick={() => setShowAdd(true)}>
                    <UserPlus size={15} /> Add Your First Friend
                  </button>
                )}
              </div>
            ) : (
              filteredFriends.map(f => (
                <div key={f._id} className="fr-friend-row">
                  <Avatar name={f.name} size={40} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{f.name}</span>
                    <span className="fr-friend-email">{f.email}</span>
                  </div>
                  <div className="fr-friend-actions">
                    <span className="fr-badge fr-badge--friend">✓ Friends</span>
                    <button
                      className="fr-icon-btn fr-icon-btn--danger"
                      title="Remove friend"
                      disabled={acting === f._id}
                      onClick={() => removeFriend(f._id, f.name)}
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Requests Tab ─────────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="fr-card">
            <h3 className="fr-section-title">Received ({requests.received?.length || 0})</h3>
            {errors.requests ? (
              <div className="fr-empty-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
                Could not load requests.
                <button className="fr-btn fr-btn--ghost fr-btn--sm" style={{ display: 'inline-flex', marginLeft: 8 }} onClick={fetchFriends}>Retry</button>
              </div>
            ) : !requests.received?.length ? (
              <div className="fr-empty-sm">No pending friend requests</div>
            ) : (
              requests.received.map(r => (
                <div key={r._id} className="fr-friend-row">
                  <Avatar name={r.from?.name} size={40} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{r.from?.name}</span>
                    <span className="fr-friend-email">{r.from?.email}</span>
                  </div>
                  <div className="fr-friend-actions">
                    <button className="fr-btn fr-btn--primary fr-btn--sm" disabled={acting === r._id} onClick={() => accept(r._id, r.from?.name)}>
                      <Check size={13} /> Accept
                    </button>
                    <button className="fr-btn fr-btn--ghost fr-btn--sm" disabled={acting === r._id} onClick={() => reject(r._id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="fr-card">
            <h3 className="fr-section-title">Sent ({requests.sent?.length || 0})</h3>
            {!requests.sent?.length ? (
              <div className="fr-empty-sm">No outgoing requests</div>
            ) : (
              requests.sent.map(r => (
                <div key={r._id} className="fr-friend-row">
                  <Avatar name={r.to?.name} size={40} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{r.to?.name}</span>
                    <span className="fr-friend-email">{r.to?.email}</span>
                  </div>
                  <span className="fr-badge fr-badge--pending"><Clock size={11} /> Pending</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Balances Tab (Splitwise-style cumulative view) ─────────────────── */}
      {tab === 'balances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Section header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.25rem 0',
          }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Cumulative balances across all groups
            </span>
            <button
              className="fr-btn fr-btn--ghost fr-btn--sm"
              onClick={fetchBalances}
              disabled={balLoading}
              title="Refresh balances"
            >
              <RefreshCw size={13} className={balLoading ? 'fr-spin' : ''} />
            </button>
          </div>

          <div className="fr-card">
            {balLoading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="fr-skeleton" />)
            ) : errors.balances ? (
              <div className="fr-empty">
                <p style={{ color: 'var(--color-error, #ef4444)' }}>Could not load balances.</p>
                <button className="fr-btn fr-btn--ghost fr-btn--sm" onClick={fetchBalances}><RefreshCw size={13} /> Retry</button>
              </div>
            ) : balances.length === 0 ? (
              <div className="fr-empty">
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <h3>All settled up!</h3>
                <p>No outstanding balances across any of your groups.</p>
              </div>
            ) : (
              <>
                {/* Who owes me */}
                {balances.filter(b => b.net > 0).length > 0 && (
                  <>
                    <div className="fr-section-label" style={{ color: '#22c55e', padding: '0.5rem 1rem 0.25rem' }}>
                      Owed to you
                    </div>
                    {balances.filter(b => b.net > 0).map((b, i) => (
                      <BalanceRow key={b.userId || i} b={b} direction="owes-me" />
                    ))}
                  </>
                )}

                {/* Who I owe */}
                {balances.filter(b => b.net < 0).length > 0 && (
                  <>
                    <div className="fr-section-label" style={{ color: '#f97316', padding: '0.75rem 1rem 0.25rem' }}>
                      You owe
                    </div>
                    {balances.filter(b => b.net < 0).map((b, i) => (
                      <BalanceRow key={b.userId || i} b={b} direction="i-owe" />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <AddFriendModal
          onClose={() => setShowAdd(false)}
          onRequestSent={() => fetchAll()}
        />
      )}
    </div>
  );
};

// ── Balance Row component (Splitwise-style) ───────────────────────────────────
const BalanceRow = ({ b, direction }) => {
  const [expanded, setExpanded] = useState(false);
  const net = Math.abs(b.net);

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div
        className="fr-balance-row"
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer' }}
      >
        <Avatar name={b.name} size={40} />
        <div className="fr-friend-info">
          <span className="fr-friend-name">{b.name}</span>
          <span className="fr-friend-email" style={{ fontSize: 11, opacity: 0.6 }}>
            {b.groups.join(' · ')}
          </span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {direction === 'owes-me' ? (
            <>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginBottom: 1 }}>owes you</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>{fmt(net)}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600, marginBottom: 1 }}>you owe</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f97316' }}>{fmt(net)}</div>
            </>
          )}
        </div>
      </div>

      {/* Expanded breakdown: show per-group split */}
      {expanded && (
        <div style={{
          padding: '0.5rem 1rem 0.75rem 4rem',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {b.theyOweTotal > 0.005 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <ArrowRight size={12} color="#22c55e" />
              <span>{b.name} owes you</span>
              <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: 700 }}>{fmt(b.theyOweTotal)}</span>
            </div>
          )}
          {b.iOweTotal > 0.005 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <ArrowRight size={12} color="#f97316" />
              <span>You owe {b.name}</span>
              <span style={{ marginLeft: 'auto', color: '#f97316', fontWeight: 700 }}>{fmt(b.iOweTotal)}</span>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            Across: {b.groups.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;