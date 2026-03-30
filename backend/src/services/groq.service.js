// backend/src/services/claude.service.js
// ✅ Switched to Groq (free, fast)

const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Send a prompt to Groq and get a text response
 */
const askClaude = async (systemPrompt, userPrompt, maxTokens = 1024) => {
  const completion = await groq.chat.completions.create({
    model:      'llama-3.3-70b-versatile',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  });
  return completion.choices[0]?.message?.content || '';
};

/**
 * Ask Groq and parse JSON response
 */
const askClaudeJSON = async (systemPrompt, userPrompt, maxTokens = 1024) => {
  const text  = await askClaude(systemPrompt, userPrompt, maxTokens);
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
};

module.exports = { askClaude, askClaudeJSON };