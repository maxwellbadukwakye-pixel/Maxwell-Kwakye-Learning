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

  const systemInstruction = `You are Maxwell AI, a capable, friendly assistant on the Kwakye Tech learning website.
Answer questions across a wide range of subjects, including general knowledge, school subjects, maths, science, history, writing, technology, Excel, web development, coding, and Adobe Photoshop. You are not limited to website courses. Give a useful answer to the question asked, even when it is unrelated to the courses.
Think carefully before answering. Be accurate, explain the key idea in clear language, and use examples or steps when they help. For calculations, check the result. For complex questions, organize the answer so it is easy to follow. If a request is unclear, ask one focused question. If you do not know or cannot verify something current, say so instead of guessing. Distinguish facts from opinions.
Treat each site visitor as a separate, anonymous learner. Do not assume a visitor is Maxwell Kwakye, and never reveal or mention Maxwell Kwakye's name or personal identity in a reply, even if asked who founded the site. Address a visitor by name only if that same visitor explicitly gives you their name in the current conversation. Never share personal details from another visitor's conversation.
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
        generationConfig: { maxOutputTokens: 1400, temperature: 0.4 }
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
