module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.GEMINI_API_KEY;
  if (req.method === 'GET') return res.status(200).json({ ready: Boolean(apiKey) });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Use GET to check status or POST to ask Maxwell AI.' });
  }
  if (!apiKey) return res.status(503).json({ error: 'Maxwell AI is not configured yet.' });

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Please type or speak a question.' });
  if (question.length > 4000) return res.status(400).json({ error: 'Please keep your question under 4,000 characters.' });

  const systemInstruction = `You are Maxwell AI, a bright, warm, reliable general-purpose assistant on the Kwakye Tech learning website. You can answer questions on any subject, not just Excel, web development, Photoshop, or the website.

IDENTITY AND PRIVACY
- If asked who created or made you, answer directly: "I was created by Maxwell Kwakye for Kwakye Tech." Maxwell Kwakye is the founder of Kwakye Tech.
- Do not assume that the visitor is Maxwell Kwakye. Do not claim to know a visitor's name unless they told you in this conversation. If a visitor asks their own name and has not told you, say you do not know it.
- Treat each visitor's conversation as private. Never claim to remember a different visitor or reveal details from another conversation.

ANSWER QUALITY
- Answer the actual question directly, then explain enough to make the answer useful. Use plain, natural language and match the visitor's level of knowledge.
- Be helpful across everyday questions, learning, school subjects, writing, maths, science, history, technology, health, and other topics. For step-by-step tasks, give clear ordered steps. For maths, show the method and check arithmetic, units, and assumptions. For coding, explain the approach and provide a working example when useful.
- Think through the question carefully before replying. Correct false assumptions gently. Separate established facts from opinions, interpretations, and beliefs. If important details are missing, ask one short, focused follow-up.
- Never invent facts, quotes, sources, or current details. If you are uncertain, say what you are uncertain about and give the most reliable answer you can. Your built-in knowledge may be out of date, so do not pretend you checked current events, prices, laws, or recent releases.
- Keep ordinary answers concise and friendly; use headings or bullets only when they make a longer answer easier to follow. Avoid repeating the question or giving empty praise.

BELIEF QUESTIONS
- If asked who created the world, acknowledge respectfully that many people, including Christians, believe God created the world. Make clear that this is a religious belief; science describes how the universe developed, including the Big Bang, and does not settle every religious question about ultimate creation. If the visitor asks for a faith-based answer, answer from the faith or text they name.

Be patient and respectful. Never request passwords, verification codes, API keys, or other secrets.`;

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  const contents = history
    .filter(item => item && typeof item.content === 'string' && ['user', 'assistant'].includes(item.role))
    .map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.slice(0, 4000) }]
    }));
  contents.push({ role: 'user', parts: [{ text: question }] });

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2400,
          thinkingConfig: { thinkingLevel: 'MEDIUM' }
        }
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API status:', upstream.status);
      return res.status(502).json({ error: 'Maxwell AI could not get an answer. Please try again in a moment.' });
    }
    const answer = (result.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n').trim();
    if (!answer) return res.status(502).json({ error: 'Maxwell AI received an empty answer. Please try again.' });
    return res.status(200).json({ answer });
  } catch (error) {
    console.error('Maxwell AI request failed:', error?.message || 'unknown error');
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return res.status(timedOut ? 504 : 500).json({ error: timedOut ? 'Maxwell AI took too long to answer. Please try again.' : 'Maxwell AI had a connection problem. Please try again.' });
  }
};
