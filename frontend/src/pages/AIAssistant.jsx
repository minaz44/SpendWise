// frontend/src/pages/AIAssistant.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, RefreshCw, Lightbulb, TrendingUp, Target, Brain } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './AIAssistant.css';

const QUICK_PROMPTS = [
  { icon: '💰', text: 'Where am I spending the most?' },
  { icon: '📊', text: 'How can I improve my savings?' },
  { icon: '🎯', text: 'Create a budget plan for me' },
  { icon: '⚠️', text: 'Any unusual spending patterns?' },
  { icon: '📈', text: 'What is my financial score?' },
  { icon: '🔄', text: 'Detect my subscriptions' },
];

const AIAssistant = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your SpendWise AI assistant. I can help you analyze your spending, create budgets, detect patterns, and give personalized financial advice. What would you like to know?`,
      timestamp: new Date(),
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const message = text || input.trim();
    if (!message || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message, timestamp: new Date() }]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        timestamp: new Date(res.data.timestamp),
      }]);
    } catch (err) {
      toast.error('AI is unavailable right now');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date(),
        isError: true,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: `Chat cleared! How can I help you with your finances today?`,
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="ai-page">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header__left">
          <div className="ai-avatar">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="ai-title">AI Assistant</h1>
            <p className="ai-subtitle">Powered by Llama 3.3 · Your personal finance advisor</p>
          </div>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={clearChat}>
          <RefreshCw size={14} /> Clear
        </button>
      </div>

      {/* Chat Area */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message message--${msg.role} ${msg.isError ? 'message--error' : ''}`}>
              <div className="message__avatar">
                {msg.role === 'assistant'
                  ? <Sparkles size={14} />
                  : <User size={14} />
                }
              </div>
              <div className="message__bubble">
                <p className="message__text">{msg.content}</p>
                <span className="message__time">
                  {msg.timestamp?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message message--assistant">
              <div className="message__avatar"><Sparkles size={14} /></div>
              <div className="message__bubble">
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} className="quick-prompt" onClick={() => sendMessage(p.text)} disabled={loading}>
              <span>{p.icon}</span>
              <span>{p.text}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your finances..."
            className="chat-input"
            rows={1}
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            {loading ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;