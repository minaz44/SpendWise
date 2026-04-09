// frontend/src/components/SplashScreen.jsx

import React, { useEffect, useRef, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const canvasRef  = useRef(null);
  const [phase,    setPhase]    = useState('particles'); // particles → logo → exit
  const [progress, setProgress] = useState(0);

  // ── Particle System ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 80 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      vx:   (Math.random() - 0.5) * 0.6,
      vy:   (Math.random() - 0.5) * 0.6,
      r:    Math.random() * 2 + 0.5,
      alpha:Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6 ? '#1D9E75' : Math.random() > 0.5 ? '#4DA6FF' : '#A78BFA',
    }));

    let frame;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Connect nearby particles
        particles.forEach(q => {
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 100) * 0.08;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
      });
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  // ── Progress bar ─────────────────────────────────────
  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) { p = 100; clearInterval(interval); }
      setProgress(Math.min(p, 100));
    }, 120);

    const t1 = setTimeout(() => setPhase('logo'), 400);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(() => onComplete?.(), 2700);

    return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className={`splash ${phase === 'exit' ? 'splash--exit' : ''}`}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="splash__canvas" />

      {/* Orbs */}
      <div className="splash__orb splash__orb--1" />
      <div className="splash__orb splash__orb--2" />
      <div className="splash__orb splash__orb--3" />

      {/* Content */}
      <div className={`splash__content ${phase === 'logo' ? 'splash__content--visible' : ''}`}>
        {/* Logo */}
        <div className="splash__logo-wrap">
          <div className="splash__logo">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="url(#g1)" />
              <path d="M12 26L16 18L20 22L24 14L28 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#1D9E75"/>
                  <stop offset="1" stopColor="#0F6E56"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="splash__logo-ring" />
          <div className="splash__logo-ring splash__logo-ring--2" />
        </div>

        <h1 className="splash__title">SpendWise</h1>
        <p className="splash__subtitle">AI-Powered Financial Intelligence</p>

        {/* Progress */}
        <div className="splash__progress">
          <div className="splash__progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <span className="splash__progress-text">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export default SplashScreen;