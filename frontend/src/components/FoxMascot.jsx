// frontend/src/components/FoxMascot.jsx

import React, { useEffect, useRef, useState } from 'react';
import './FoxMascot.css';

const FoxMascot = () => {
  const [eyes, setEyes]     = useState({ x: 0, y: 0 });
  const [blink, setBlink]   = useState(false);
  const [mood,  setMood]    = useState('normal'); // normal | happy | surprised
  const foxRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!foxRef.current) return;
      const rect   = foxRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width  / 2;
      const centerY = rect.top  + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const angle = Math.atan2(dy, dx);
      const dist  = Math.min(Math.sqrt(dx*dx + dy*dy), 60);
      const eyeX  = Math.cos(angle) * Math.min(dist / 60 * 4, 4);
      const eyeY  = Math.sin(angle) * Math.min(dist / 60 * 3, 3);
      setEyes({ x: eyeX, y: eyeY });
    };

    // Blink randomly
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);

    // Random mood changes
    const moodInterval = setInterval(() => {
      const moods = ['normal', 'normal', 'normal', 'happy', 'surprised'];
      setMood(moods[Math.floor(Math.random() * moods.length)]);
      setTimeout(() => setMood('normal'), 1500);
    }, 5000);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(blinkInterval);
      clearInterval(moodInterval);
    };
  }, []);

  const eyeY = mood === 'surprised' ? eyes.y - 1 : mood === 'happy' ? eyes.y + 1 : eyes.y;

  return (
    <div className={`fox-mascot fox-mascot--${mood}`} ref={foxRef}>
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="fox-svg">

        {/* Outer glow */}
        <circle cx="40" cy="40" r="38" fill="url(#foxGlow)" opacity="0.3" />

        {/* Main circle background */}
        <circle cx="40" cy="40" r="36" fill="#1A1A1A" stroke="url(#foxBorder)" strokeWidth="1.5" />

        {/* Fox ears */}
        <path d="M18 28 L12 10 L26 22 Z" fill="#E8740A" />
        <path d="M62 28 L68 10 L54 22 Z" fill="#E8740A" />
        <path d="M19 26 L14 13 L24 22 Z" fill="#FFB347" />
        <path d="M61 26 L66 13 L56 22 Z" fill="#FFB347" />

        {/* Fox face - main */}
        <ellipse cx="40" cy="44" rx="22" ry="20" fill="#E8740A" />

        {/* White cheeks */}
        <ellipse cx="29" cy="50" rx="8" ry="6" fill="#FFF3E0" opacity="0.9" />
        <ellipse cx="51" cy="50" rx="8" ry="6" fill="#FFF3E0" opacity="0.9" />

        {/* Forehead */}
        <ellipse cx="40" cy="30" rx="16" ry="12" fill="#E8740A" />

        {/* Dark mask around eyes */}
        <ellipse cx="31" cy="37" rx="7" ry="6" fill="#2A1500" opacity="0.6" />
        <ellipse cx="49" cy="37" rx="7" ry="6" fill="#2A1500" opacity="0.6" />

        {/* Eyes */}
        <ellipse
          cx={31 + eyes.x}
          cy={blink ? 37.5 : (37 + eyeY)}
          rx={blink ? 4.5 : 4.5}
          ry={blink ? 0.5 : (mood === 'happy' ? 2.5 : mood === 'surprised' ? 5 : 4)}
          fill="#1A0A00"
        />
        <ellipse
          cx={49 + eyes.x}
          cy={blink ? 37.5 : (37 + eyeY)}
          rx={blink ? 4.5 : 4.5}
          ry={blink ? 0.5 : (mood === 'happy' ? 2.5 : mood === 'surprised' ? 5 : 4)}
          fill="#1A0A00"
        />

        {/* Eye shine */}
        {!blink && (
          <>
            <circle cx={32.5 + eyes.x} cy={35.5 + eyeY} r="1.2" fill="white" opacity="0.9" />
            <circle cx={50.5 + eyes.x} cy={35.5 + eyeY} r="1.2" fill="white" opacity="0.9" />
          </>
        )}

        {/* Nose */}
        <ellipse cx="40" cy="47" rx="3" ry="2" fill="#2A1500" />

        {/* Mouth */}
        {mood === 'happy' ? (
          <path d="M34 51 Q40 56 46 51" stroke="#2A1500" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        ) : mood === 'surprised' ? (
          <ellipse cx="40" cy="53" rx="3" ry="4" fill="#2A1500" />
        ) : (
          <path d="M36 52 Q40 55 44 52" stroke="#2A1500" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        )}

        {/* Green accent stripe on forehead */}
        <path d="M32 26 Q40 22 48 26" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />

        {/* Defs */}
        <defs>
          <radialGradient id="foxGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1D9E75" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="foxBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#E8740A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>

      {/* Mood bubble */}
      {mood === 'happy' && <div className="fox-bubble">💚</div>}
      {mood === 'surprised' && <div className="fox-bubble">💰</div>}
    </div>
  );
};

export default FoxMascot;