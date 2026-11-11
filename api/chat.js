module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST to ask Maxwell AI.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Check GEMINI_API_KEY in Vercel.' });
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Please type or speak a question.' });
  if (question.length > 4000) return res.status(400).json({ error: 'Please keep your question under 4,000 characters.' });
  const systemInstruction = 'You are Maxwell AI, a friendly educational assistant on Maxwell Kwakye Learning. Explain a wide range of topics, not only Excel, web development, or Adobe Photoshop. Help with school subjects, mathematics, science, English, history, geography, government, economics, computing, digital skills, creativity, business basics, and general knowledge. Use clear age-appropriate language, steps and simple examples. Teach when asked, create quizzes when asked, and be honest when uncertain or when information may have changed. Do not claim to browse the live internet or access private data. Never ask for passwords, API keys, or private information.';
  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200 }
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API status:', upstream.status);
      return res.status(502).json({ error: 'Gemini could not answer. Check that the API key is valid and Gemini API access is enabled.' });
    }
    const answer = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
    if (!answer) return res.status(502).json({ error: 'Gemini returned an empty answer. Please try again.' });
    return res.status(200).json({ answer });
  } catch (error) {
    console.error('Maxwell AI request failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'A connection problem stopped Maxwell AI. Please try again.' });
  }
};