// frontend/src/pages/Register.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const CURRENCIES = [
  { value: 'INR', label: '₹ INR — Indian Rupee' },
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'GBP', label: '£ GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

// ── OTP Input Component ───────────────────────────────────────────────────────
const OTPInput = ({ value, onChange }) => {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft'  && i > 0) { inputs.current[i - 1]?.focus(); return; }
    if (e.key === 'ArrowRight' && i < 5) { inputs.current[i + 1]?.focus(); return; }
    if (!/^\d$/.test(e.key)) return;
    const next = [...digits];
    next[i] = e.key;
    onChange(next.join(''));
    if (i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, '').slice(0, 6)); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '1.5rem 0' }}>
      {Array(6).fill(0).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ''}
          onChange={() => {}} // handled in onKeyDown
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          style={{
            width: 48, height: 56,
            textAlign: 'center',
            fontSize: '1.4rem', fontWeight: 800,
            background: digits[i] ? 'rgba(99,102,241,0.12)' : 'var(--color-surface)',
            border: `2px solid ${digits[i] ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
            borderRadius: 12,
            color: 'var(--color-text-primary)',
            outline: 'none',
            transition: 'all 0.15s',
            caretColor: 'transparent',
          }}
        />
      ))}
    </div>
  );
};

// ── OTP Verification Screen ───────────────────────────────────────────────────
const OTPScreen = ({ email, name, onSuccess }) => {
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const verify = async () => {
    if (otp.length !== 6) { toast.error('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      const { user, accessToken, refreshToken } = res.data;
      // Store tokens and log in
      localStorage.setItem('accessToken',  accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      toast.success('Email verified! Welcome to SpendWise 🎉');
      onSuccess({ user, accessToken, refreshToken });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP. Please try again.');
      setOtp('');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New OTP sent to your email!');
      setCountdown(60);
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally { setResending(false); }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={S.otpIcon}>🔐</div>
          <h2 style={S.title}>Verify your email</h2>
          <p style={S.sub}>
            We sent a 6-digit code to<br/>
            <strong style={{ color: 'var(--color-primary)' }}>{email}</strong>
          </p>
        </div>

        {/* OTP Boxes */}
        <OTPInput value={otp} onChange={setOtp} />

        {/* Verify Button */}
        <button
          onClick={verify}
          disabled={loading || otp.length !== 6}
          style={{
            ...S.btn,
            opacity: (loading || otp.length !== 6) ? 0.6 : 1,
            cursor:  (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {loading ? (
            <span style={S.btnInner}><span style={S.spinner} /> Verifying...</span>
          ) : 'Verify & Continue'}
        </button>

        {/* Resend */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          {countdown > 0 ? (
            <p style={{ ...S.sub, fontSize: 13 }}>
              Resend code in <strong style={{ color: 'var(--color-primary)' }}>{countdown}s</strong>
            </p>
          ) : (
            <button
              onClick={resend}
              disabled={resending}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}
            >
              {resending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
        </div>

        <p style={{ ...S.sub, fontSize: 12, marginTop: '1rem', textAlign: 'center' }}>
          Check your spam folder if you don't see the email.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Registration Form ─────────────────────────────────────────────────────────
const Register = () => {
  const navigate     = useNavigate();
  const { login: authLogin } = useAuth(); // use login to set user after OTP

  const [step, setStep] = useState('register'); // 'register' | 'otp'
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredName,  setRegisteredName]  = useState('');

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    confirmPassword: '', currency: 'INR', monthlyIncome: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!form.name || form.name.length < 2)     e.name = 'Name must be at least 2 characters';
    if (!form.email)                             e.email = 'Email is required';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!/\d/.test(form.password))               e.password = 'Password must contain at least one number';
    if (form.password !== form.confirmPassword)  e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name:          form.name,
        email:         form.email,
        password:      form.password,
        currency:      form.currency,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : 0,
      });
      setRegisteredEmail(form.email);
      setRegisteredName(form.name);
      toast.success('Account created! Check your email for the OTP 📧');
      setStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  // Called after OTP verified successfully
  const handleOTPSuccess = ({ user, accessToken, refreshToken }) => {
    // AuthContext login — store tokens and set user
    // We call the same flow as normal login
    navigate('/dashboard');
  };

  const inputStyle = (field) => ({
    padding: '10px 14px',
    border: `1px solid ${errors[field] ? 'var(--color-danger)' : 'var(--color-border-strong)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    width: '100%',
    outline: 'none',
  });

  // Show OTP screen if on step 2
  if (step === 'otp') {
    return (
      <OTPScreen
        email={registeredEmail}
        name={registeredName}
        onSuccess={handleOTPSuccess}
      />
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>SW</div>
          <h1 style={S.logoText}>SpendWise</h1>
        </div>

        <h2 style={S.title}>Create your account</h2>
        <p style={S.sub}>Start tracking smarter today</p>

        <form onSubmit={handleSubmit} style={S.form}>

          {/* Name */}
          <div style={S.field}>
            <label style={S.label}>Full Name</label>
            <input name="name" type="text" value={form.name}
              onChange={handleChange} placeholder="Rahul Sharma"
              style={inputStyle('name')} />
            {errors.name && <span style={S.error}>{errors.name}</span>}
          </div>

          {/* Email */}
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input name="email" type="email" value={form.email}
              onChange={handleChange} placeholder="rahul@example.com"
              style={inputStyle('email')} autoComplete="email" />
            {errors.email && <span style={S.error}>{errors.email}</span>}
          </div>

          {/* Password */}
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPass ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                placeholder="Min 6 chars, 1 number"
                style={{ ...inputStyle('password'), paddingRight: '44px' }} />
              <button type="button" onClick={() => setShowPass(p => !p)} style={S.eyeBtn}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <span style={S.error}>{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div style={S.field}>
            <label style={S.label}>Confirm Password</label>
            <input name="confirmPassword" type="password"
              value={form.confirmPassword} onChange={handleChange}
              placeholder="••••••••" style={inputStyle('confirmPassword')} />
            {errors.confirmPassword && <span style={S.error}>{errors.confirmPassword}</span>}
          </div>

          {/* Currency + Income */}
          <div style={S.twoCol}>
            <div style={S.field}>
              <label style={S.label}>Currency</label>
              <select name="currency" value={form.currency} onChange={handleChange}
                style={{ ...inputStyle('currency'), cursor: 'pointer' }}>
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Monthly Income (optional)</label>
              <input name="monthlyIncome" type="number" value={form.monthlyIncome}
                onChange={handleChange} placeholder="50000" min="0"
                style={inputStyle('monthlyIncome')} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', width: '100%' }}>
            {loading ? (
              <span style={S.btnInner}><span style={S.spinner} /> Creating account...</span>
            ) : 'Create Account →'}
          </button>
        </form>

        <p style={S.switchText}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const S = {
  page:    { minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card:    { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-md)' },
  logoWrap:{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', justifyContent: 'center' },
  logoIcon:{ width: 40, height: 40, background: 'var(--color-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '14px' },
  logoText:{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text-primary)' },
  otpIcon: { fontSize: '3rem', marginBottom: '0.75rem' },
  title:   { fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: '4px' },
  sub:     { fontSize: '14px', color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 },
  form:    { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:   { display: 'flex', flexDirection: 'column', gap: '6px' },
  twoCol:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label:   { fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' },
  eyeBtn:  { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 },
  error:   { fontSize: '12px', color: 'var(--color-danger)' },
  btn:     { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '15px', fontWeight: 600, marginTop: '0.5rem', cursor: 'pointer' },
  btnInner:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner: { display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  switchText: { textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '1.25rem' },
};

export default Register;