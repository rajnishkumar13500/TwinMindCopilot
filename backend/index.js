const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Multer: store in tmp with a unique prefix
const upload = multer({ dest: os.tmpdir() });

// ─────────────────── HELPERS ───────────────────
const getGroqClient = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header. Provide your Groq API key.');
  }
  return new Groq({ apiKey: authHeader.split(' ')[1] });
};

const cleanupFile = (...paths) => {
  paths.forEach((p) => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  });
};

// ─────────────────── 1. TRANSCRIBE ───────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const originalPath = req.file?.path;
  const renamedPath = originalPath ? originalPath + '.webm' : null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided.' });
    }

    const groq = getGroqClient(req);

    // Rename so Groq SDK infers the correct format
    fs.renameSync(originalPath, renamedPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: 'whisper-large-v3',
      response_format: 'json',
      language: 'en',
    });

    cleanupFile(renamedPath);
    res.json({ text: transcription.text || '' });
  } catch (error) {
    console.error('Transcription error:', error.message);
    cleanupFile(originalPath, renamedPath);
    res.status(500).json({ error: error.message || 'Transcription failed.' });
  }
});

// ─────────────────── 2. SUGGESTIONS ───────────────────

const DEFAULT_SUGGESTION_PROMPT = `You are a real-time AI meeting copilot. Analyze the meeting transcript and generate exactly 3 context-aware suggestions.

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


app.post('/api/suggestions', async (req, res) => {
  try {
    const groq = getGroqClient(req);
    const { context, suggestionPrompt } = req.body;

    if (!context || context.trim().length === 0) {
      return res.status(400).json({ error: 'Transcript context is empty.' });
    }

    const systemMessage = suggestionPrompt || DEFAULT_SUGGESTION_PROMPT;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `Here is the latest meeting transcript to analyze:\n\n---\n${context}\n---\n\nGenerate exactly 3 suggestions now.`,
        },
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.6,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let output;
    try {
      output = JSON.parse(raw);
    } catch {
      console.error('Failed to parse suggestion JSON:', raw);
      output = { suggestions: [] };
    }

    // Ensure exactly 3 suggestions with required fields
    if (!output.suggestions || !Array.isArray(output.suggestions)) {
      output = { suggestions: [] };
    }

    output.suggestions = output.suggestions.slice(0, 3).map((s) => ({
      type: s.type || 'talking_point',
      preview: s.preview || 'Suggestion',
      action: s.action || '',
    }));

    res.json(output);
  } catch (error) {
    console.error('Suggestions error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to generate suggestions.' });
  }
});

// ─────────────────── 3. CHAT ───────────────────

const DEFAULT_CHAT_PROMPT = `You are an expert meeting copilot providing live, in-context assistance during an active conversation.
You have access to the full running transcript of the meeting below.

Your responsibilities:
- Answer questions by referencing specific parts of the transcript.
- When the user clicks a live suggestion, provide a comprehensive, ready-to-use response.
- Be concise but thorough. Prioritize facts from the transcript over general knowledge.
- If the transcript doesn't contain enough information, say so honestly.
- Format your response clearly with bullet points or numbered lists when appropriate.`;

const DEFAULT_DETAILED_ANSWER_PROMPT = `You are an expert meeting copilot. The user clicked a live suggestion card during an active meeting.
Your job is to provide a detailed, comprehensive, and immediately actionable response.

Guidelines:
- Reference specific statements from the transcript to ground your response.
- If the suggestion is a question to ask, provide the answer AND suggest how the user might phrase the follow-up.
- If it's a fact-check, cite sources or provide the correct information clearly.
- If it's a clarification, explain the concept thoroughly but concisely.
- Structure your response for quick scanning: use bullet points, bold key terms, and keep paragraphs short.
- Be specific to THIS conversation, not generic.`;

app.post('/api/chat', async (req, res) => {
  try {
    const groq = getGroqClient(req);
    const { transcript, chatHistory, query, chatPrompt } = req.body;

    // Use the detailed answer prompt when dealing with suggestion clicks
    const systemMessage = chatPrompt || DEFAULT_CHAT_PROMPT;

    const messages = [
      { role: 'system', content: systemMessage },
    ];

    // Inject transcript as context
    if (transcript && transcript.trim().length > 0) {
      messages.push({
        role: 'system',
        content: `--- LIVE MEETING TRANSCRIPT ---\n${transcript}\n--- END TRANSCRIPT ---`,
      });
    }

    // Append prior chat history
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((m) => {
        if (m.role && m.content) {
          messages.push({ role: m.role, content: m.content });
        }
      });
    }

    messages.push({ role: 'user', content: query });

    const completion = await groq.chat.completions.create({
      messages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.5,
      max_tokens: 1500,
    });

    res.json({ answer: completion.choices[0]?.message?.content || '' });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: error.message || 'Chat response failed.' });
  }
});

// ─────────────────── SERVER ───────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
