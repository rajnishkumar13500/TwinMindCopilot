import Groq from 'groq-sdk';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const form = new IncomingForm({ keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let filePath = null;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing API key' });
    }
    const groq = new Groq({ apiKey: authHeader.split(' ')[1] });

    const { files } = await parseForm(req);

    const audioFile = files.audio?.[0] || files.audio;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    filePath = audioFile.filepath || audioFile.path;
    const renamedPath = filePath + '.webm';
    fs.renameSync(filePath, renamedPath);
    filePath = renamedPath;

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(renamedPath),
      model: 'whisper-large-v3',
      response_format: 'json',
      language: 'en',
    });

    try { fs.unlinkSync(renamedPath); } catch {}

    return res.status(200).json({ text: transcription.text || '' });
  } catch (error) {
    console.error('Transcription error:', error.message);
    if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
    return res.status(500).json({ error: error.message || 'Transcription failed' });
  }
}
