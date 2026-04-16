import Groq from 'groq-sdk';

const DEFAULT_PROMPT = `You are a real-time AI meeting copilot. Analyze the meeting transcript and generate exactly 3 context-aware suggestions.

Each suggestion MUST be one of these types:
- "question_to_ask": A follow-up question to ask right now
- "answer": Answer a question that was just asked in the conversation
- "fact_check": Verify or correct a claim or statistic mentioned
- "talking_point": A relevant point to raise next
- "clarification": Explain a vague or technical term that was used

Rules:
- Suggestions MUST directly relate to what was JUST said in the transcript
- "preview": Short title, max 8 words, immediately useful
- "action": Detailed elaboration, the exact words to say, or the factual answer
- Never be generic. Always reference specific transcript content.
- Keep action text concise (2-3 sentences max)

Return ONLY valid JSON:
{"suggestions": [{"type": "...", "preview": "...", "action": "..."}, ...]}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing API key' });
    }
    const groq = new Groq({ apiKey: authHeader.split(' ')[1] });

    const { context, suggestionPrompt } = req.body || {};

    if (!context || context.trim().length === 0) {
      return res.status(400).json({ error: 'Empty transcript context' });
    }

    const systemMessage = suggestionPrompt || DEFAULT_PROMPT;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Transcript:\n${context}\n\nGenerate 3 suggestions.` },
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let output;
    try {
      output = JSON.parse(raw);
    } catch {
      output = { suggestions: [] };
    }

    if (!output.suggestions || !Array.isArray(output.suggestions)) {
      output = { suggestions: [] };
    }

    output.suggestions = output.suggestions.slice(0, 3).map((s) => ({
      type: s.type || 'talking_point',
      preview: s.preview || 'Suggestion',
      action: s.action || '',
    }));

    return res.status(200).json(output);
  } catch (error) {
    console.error('Suggestions error:', error.message);
    return res.status(500).json({ error: error.message || 'Suggestions failed' });
  }
}
