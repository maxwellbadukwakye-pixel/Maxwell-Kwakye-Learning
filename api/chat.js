module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST to ask Maxwell AI.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Maxwell AI is not configured yet.' });
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Please type or speak a question.' });
  if (question.length > 4000) return res.status(400).json({ error: 'Please keep your question under 4,000 characters.' });
  const systemInstruction = 'You are Maxwell AI, a friendly, clear and helpful learning assistant for Maxwell Kwakye Learning. Explain Excel, web development, coding, Photoshop, AI, school subjects and general questions in beginner-friendly language. Answer directly, give short practical examples when helpful, and never ask for passwords, API keys or private information.';
  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 1000 }
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
