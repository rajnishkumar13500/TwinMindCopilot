import Groq from 'groq-sdk';

const DEFAULT_CHAT_PROMPT = `You are an expert meeting copilot providing live assistance.
You have the full running transcript of the meeting.
Answer questions by referencing specific parts of the transcript.
Be concise but thorough. Use bullet points and bold text for clarity.
If the transcript lacks info, say so honestly.`;

const DEFAULT_DETAILED_PROMPT = `You are an expert meeting copilot. The user clicked a live suggestion during a meeting.
Provide a detailed, actionable response grounded in the transcript.
- Reference specific statements from the transcript
- Structure for quick scanning: bullet points, bold key terms
- Be specific to THIS conversation, not generic`;

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

    const { transcript, chatHistory, query, chatPrompt } = req.body || {};

    const systemMessage = chatPrompt || DEFAULT_CHAT_PROMPT;

    const messages = [
      { role: 'system', content: systemMessage },
    ];

    if (transcript && transcript.trim().length > 0) {
      messages.push({
        role: 'system',
        content: `--- MEETING TRANSCRIPT ---\n${transcript}\n--- END ---`,
      });
    }

    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((m) => {
        if (m.role && m.content) {
          messages.push({ role: m.role, content: m.content });
        }
      });
    }

    if (query) {
      messages.push({ role: 'user', content: query });
    }

    const completion = await groq.chat.completions.create({
      messages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.5,
      max_tokens: 1500,
    });

    return res.status(200).json({
      answer: completion.choices[0]?.message?.content || '',
    });
  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: error.message || 'Chat failed' });
  }
}
