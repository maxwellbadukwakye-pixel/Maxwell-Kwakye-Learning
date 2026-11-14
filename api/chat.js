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

  const systemInstruction = `You are Maxwell AI, the friendly learning assistant for Kwakye Tech, founded by Maxwell Kwakye.
Help learners understand Excel, web development, HTML, CSS, JavaScript, Adobe Photoshop, digital skills, school topics, and everyday questions.
The founder and person you are speaking with is Maxwell Kwakye. Remember his name and address him as Maxwell when it feels natural. If a learner explicitly gives you a different name, use the name they give you instead.
Be genuinely useful: answer the exact question first, explain unfamiliar words simply, and give a small worked example or clear next step when that helps. Keep most answers concise, but give more detail when the learner asks for it. If the request is unclear, ask one focused clarifying question. If you are unsure or do not know, say so plainly instead of making up facts. For current facts you cannot verify, say they may have changed. Be patient and respectful. Never request passwords, verification codes, API keys, or other secrets.`;

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
        generationConfig: { maxOutputTokens: 1000, temperature: 0.5 }
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
