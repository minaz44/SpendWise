// frontend/src/pages/Transactions.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Trash2, Edit2, X,
  TrendingUp, TrendingDown, ArrowLeftRight,
  ChevronLeft, ChevronRight, Calendar, Tag,
} from 'lucide-react';
import transactionAPI from '../api/transaction.api';
import categoryAPI from '../api/category.api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Transactions.css';

// ── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="confirm-box" onClick={e => e.stopPropagation()}>
      <div className="confirm-box__icon">🗑️</div>
      <h3>Delete Transaction?</h3>
      <p>{message}</p>
      <div className="confirm-box__actions">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--danger" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  </div>
);

const fmt = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const PAYMENT_METHODS = ['upi', 'cash', 'card', 'netbanking', 'wallet', 'cheque', 'other'];

// ── Add/Edit Modal ───────────────────────────────────────────────────────────
const TransactionModal = ({ transaction, categories, currency, onClose, onSave }) => {
  const [form, setForm] = useState({
    type:          transaction?.type          || 'expense',
    amount:        transaction?.amount        || '',
    merchant:      transaction?.merchant      || '',
    description:   transaction?.description   || '',
    categoryId:    transaction?.categoryId?._id || transaction?.categoryId || '',
    paymentMethod: transaction?.paymentMethod || 'upi',
    date:          transaction?.date
      ? new Date(transaction.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    notes: transaction?.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await onSave({ ...form, amount: parseFloat(form.amount) });
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.type === form.type || c.type === 'both'
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{transaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {/* Type */}
          <div className="type-tabs">
            {['expense', 'income', 'transfer'].map(t => (
              <button key={t} type="button"
                className={`type-tab type-tab--${t} ${form.type === t ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: t }))}>
                {t === 'expense' ? <TrendingDown size={14} /> : t === 'income' ? <TrendingUp size={14} /> : <ArrowLeftRight size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="form-group">
            <label>Amount ({currency})</label>
            <input type="number" step="0.01" min="0.01" required
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00" className="form-input form-input--amount" />
          </div>

          <div className="form-row">
            {/* Merchant */}
            <div className="form-group">
              <label>Merchant / Name</label>
              <input type="text" value={form.merchant}
                onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))}
                placeholder="e.g. Swiggy" className="form-input" />
            </div>

            {/* Date */}
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} required
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="form-input" />
            </div>
          </div>

          <div className="form-row">
            {/* Category */}
            <div className="form-group">
              <label>Category</label>
              <select value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="form-input">
                <option value="">Uncategorized</option>
                {filteredCategories.map(c => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label>Payment Method</label>
              <select value={form.paymentMethod}
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="form-input">
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add a note..." className="form-input form-input--textarea" rows={2} />
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Saving...' : transaction ? 'Update' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const Transactions = () => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [pagination,   setPagination]   = useState({ page: 1, totalPages: 1, total: 0 });

  const [filters, setFilters] = useState({
    search: '', type: '', categoryId: '',
    startDate: '', endDate: '', paymentMethod: '',
    sortBy: 'date', sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [modal,       setModal]       = useState(null); // null | 'add' | transaction object
  const [page,        setPage]        = useState(1);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await transactionAPI.getAll(params);
      setTransactions(res.data.transactions);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    categoryAPI.getAll().then(res => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const handleSave = async (data) => {
    if (modal?._id) {
      await transactionAPI.update(modal._id, data);
      toast.success('Transaction updated!');
    } else {
      await transactionAPI.create(data);
      toast.success('Transaction added!');
    }
    fetchTransactions();
  };

  const [deleteId, setDeleteId] = useState(null);

  const handleDelete = async (id) => {
    await transactionAPI.remove(id);
    toast.success('Transaction deleted');
    setDeleteId(null);
    fetchTransactions();
  };

  const typeIcon = (type) => {
    if (type === 'income')   return <TrendingUp size={14} />;
    if (type === 'expense')  return <TrendingDown size={14} />;
    return <ArrowLeftRight size={14} />;
  };

  return (
    <div className="transactions-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{pagination.total} total transactions</p>
        </div>
        <div className="page-actions">
          <button className={`btn btn--ghost ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(f => !f)}>
            <Filter size={16} /> Filters
          </button>
          <button className="btn btn--primary" onClick={() => setModal({})}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search merchant, description..."
            value={filters.search}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
          />
          {filters.search && (
            <button onClick={() => setFilters(f => ({ ...f, search: '' }))}><X size={14} /></button>
          )}
        </div>

        {showFilters && (
          <div className="filters-expanded">
            <select value={filters.type}
              onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}
              className="filter-select">
              <option value="">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>

            <select value={filters.categoryId}
              onChange={e => { setFilters(f => ({ ...f, categoryId: e.target.value })); setPage(1); }}
              className="filter-select">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
            </select>

            <input type="date" value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              className="filter-select" placeholder="Start date" />

            <input type="date" value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              className="filter-select" />

            <select value={filters.sortBy}
              onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value }))}
              className="filter-select">
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>

            <button className="btn btn--ghost btn--sm"
              onClick={() => setFilters({ search: '', type: '', categoryId: '', startDate: '', endDate: '', paymentMethod: '', sortBy: 'date', sortOrder: 'desc' })}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="txn-table">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="txn-row skeleton-row" />
          ))
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <ArrowLeftRight size={32} />
            <h3>No transactions found</h3>
            <p>Add your first transaction or adjust filters</p>
            <button className="btn btn--primary" onClick={() => setModal({})}>
              <Plus size={16} /> Add Transaction
            </button>
          </div>
        ) : transactions.map(txn => (
          <div key={txn._id} className={`txn-row txn-row--${txn.type}`}>
            <div className="txn-row__icon" style={{
              background: txn.type === 'income' ? 'rgba(29,158,117,0.12)' : txn.type === 'expense' ? 'rgba(216,90,48,0.12)' : 'rgba(55,138,221,0.12)',
              color: txn.type === 'income' ? 'var(--color-success)' : txn.type === 'expense' ? 'var(--color-danger)' : 'var(--color-info)',
            }}>
              {typeIcon(txn.type)}
            </div>

            <div className="txn-row__info">
              <span className="txn-row__name">{txn.merchant || txn.description || 'Transaction'}</span>
              <span className="txn-row__meta">
                <Tag size={10} /> {txn.categoryName}
                &nbsp;·&nbsp;
                <Calendar size={10} /> {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                &nbsp;·&nbsp; {txn.paymentMethod?.toUpperCase()}
              </span>
            </div>

            <div className="txn-row__amount">
              <span className={`amount amount--${txn.type}`}>
                {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}{fmt(txn.amount, currency)}
              </span>
              {txn.source !== 'manual' && (
                <span className="source-badge">{txn.source}</span>
              )}
            </div>

            <div className="txn-row__actions">
              <button className="icon-btn" onClick={() => setModal(txn)} title="Edit">
                <Edit2 size={14} />
              </button>
              <button className="icon-btn icon-btn--danger" onClick={() => setDeleteId(txn._id)} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn--ghost btn--sm" disabled={page === 1}
            onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="pagination__info">
            Page {page} of {pagination.totalPages}
          </span>
          <button className="btn btn--ghost btn--sm" disabled={page === pagination.totalPages}
            onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <TransactionModal
          transaction={modal?._id ? modal : null}
          categories={categories}
          currency={currency}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <ConfirmDialog
          message="This transaction will be permanently deleted."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
};

export default Transactions;