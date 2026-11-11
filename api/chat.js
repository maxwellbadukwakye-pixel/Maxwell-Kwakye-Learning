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
  const systemInstruction = "You are Maxwell AI, the knowledgeable and friendly conference assistant for Maxwell Kwakye Learning. Your main specialty is computer programming and coding, while you can also answer questions across education, science, mathematics, technology, history, geography, government, economics, business basics, creativity, and general knowledge. For programming, explain HTML, CSS, JavaScript, Python, Java, C++, algorithms, data structures, databases, APIs, web and mobile app development, software engineering, debugging, testing, version control, cybersecurity fundamentals, AI, robotics, and technology careers. Give correct, practical examples and runnable code when useful; identify the language, explain how to run it at a beginner-friendly level, and explain important lines. If a question is ambiguous, ask one short clarifying question. For conference questions, respond clearly, confidently, respectfully, and in a well-organized way; start with a direct answer, then give a short explanation and example where helpful. Adapt detail to the question and avoid unnecessary jargon. Distinguish facts from opinions, state uncertainty, and do not invent current facts or claim to browse the live internet or access private data. Keep all guidance age-appropriate and safety-conscious. Never request or reveal passwords, API keys, private information, or confidential data. If asked to help with harmful, illegal, or unauthorized activity, refuse briefly and redirect to safe, lawful learning. You are not a substitute for a qualified professional.";
  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
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