import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import TranscriptColumn from './components/TranscriptColumn';
import SuggestionsColumn from './components/SuggestionsColumn';
import ChatColumn from './components/ChatColumn';
import SettingsModal from './components/SettingsModal';

const API_URL = 'http://localhost:3001/api';

function App() {
  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('twinmind_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('twinmind_theme', theme);
  }, [theme]);

  // Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('twinmind_settings');
    return saved ? JSON.parse(saved) : {
      apiKey: '',
      suggestionPrompt: '',
      chatPrompt: '',
      detailedAnswerPrompt: '',
      contextLength: 3000,
      chatContextLength: 6000,
    };
  });
  const [showSettings, setShowSettings] = useState(false);

  // App State
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Refs for stable access inside closures
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const transcriptChunksRef = useRef([]);
  const settingsRef = useRef(settings);
  const lastContextRef = useRef('');
  const streamRef = useRef(null);
  const suggestionsLoadingRef = useRef(false);

  // Keep refs synced
  useEffect(() => {
    transcriptChunksRef.current = transcriptChunks;
  }, [transcriptChunks]);
  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('twinmind_settings', JSON.stringify(settings));
  }, [settings]);

  // ─────────────────────────── AUDIO RECORDING ───────────────────────────
  const startRecording = async () => {
    if (!settings.apiKey) {
      alert('Please set your Groq API Key in Settings first.');
      setShowSettings(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsRecording(true);
      beginChunk(stream);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Could not access microphone. Check browser permissions.');
    }
  };

  const beginChunk = (stream) => {
    if (!isRecordingRef.current) return;

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/ogg';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }
    }

    const options = mimeType ? { mimeType } : {};
    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
      audioChunksRef.current = [];

      // Restart next 30s chunk immediately if still recording
      if (isRecordingRef.current) {
        beginChunk(stream);
      } else {
        // Cleanup stream
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Process only if we have meaningful audio (>1KB)
      if (blob.size > 1000) {
        await processAudioChunk(blob);
      }
    };

    recorder.start();

    // Auto-stop after 30 seconds to create a chunk
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, 30000);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // ─────────────────────────── TRANSCRIPTION ───────────────────────────
  const processAudioChunk = async (blob) => {
    const currentSettings = settingsRef.current;
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');

      const res = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSettings.apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Transcription HTTP ${res.status}`);
      }
      const data = await res.json();

      if (data.text && data.text.trim().length > 0) {
        const chunk = {
          id: Date.now(),
          text: data.text.trim(),
          timestamp: new Date().toISOString(),
        };
        setTranscriptChunks((prev) => [...prev, chunk]);

        // Immediately fetch suggestions after new transcript arrives
        const updatedChunks = [...transcriptChunksRef.current, chunk];
        triggerSuggestions(updatedChunks, false);
      }
    } catch (error) {
      console.error('Transcription error:', error.message);
    }
  };

  // ─────────────────────────── SUGGESTIONS ───────────────────────────
  const triggerSuggestions = async (chunks, forceRefresh = false) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.apiKey || !chunks || chunks.length === 0) return;
    if (suggestionsLoadingRef.current) return; // debounce

    const fullText = chunks.map((c) => c.text).join('\n');
    const recentContext = fullText.slice(-(currentSettings.contextLength || 3000));

    // Skip if context hasn't changed (unless forced)
    if (!forceRefresh && recentContext === lastContextRef.current) return;

    suggestionsLoadingRef.current = true;
    setIsLoadingSuggestions(true);

    try {
      lastContextRef.current = recentContext;

      const res = await fetch(`${API_URL}/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentSettings.apiKey}`,
        },
        body: JSON.stringify({
          context: recentContext,
          suggestionPrompt: currentSettings.suggestionPrompt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Suggestions HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const batch = data.suggestions.slice(0, 3).map((s, i) => ({
          ...s,
          id: `${Date.now()}-${i}`,
        }));
        setSuggestions(batch);
      }
    } catch (err) {
      console.error('Suggestion error:', err.message);
    } finally {
      suggestionsLoadingRef.current = false;
      setIsLoadingSuggestions(false);
    }
  };

  const handleManualRefresh = () => {
    triggerSuggestions(transcriptChunksRef.current, true);
  };

  // ─────────────────────────── CHAT ───────────────────────────
  const handleSendToChat = useCallback(
    async (suggestion) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.apiKey) return;

      const userMsg = {
        role: 'user',
        content: suggestion.preview,
        id: Date.now(),
        isSuggestion: true,
        suggestionAction: suggestion.action,
      };
      setChatHistory((prev) => [...prev, userMsg]);
      setIsChatLoading(true);

      try {
        const fullText = transcriptChunksRef.current.map((c) => c.text).join('\n');
        const contextForChat = fullText.slice(-(currentSettings.chatContextLength || 6000));

        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSettings.apiKey}`,
          },
          body: JSON.stringify({
            transcript: contextForChat,
            chatHistory: [],
            query: `The user selected this live suggestion during a meeting:\n\nSuggestion: "${suggestion.preview}"\nBrief context: ${suggestion.action}\n\nProvide a detailed, actionable, and context-aware response based on the meeting transcript. Be specific and reference what was discussed.`,
            chatPrompt: currentSettings.detailedAnswerPrompt,
          }),
        });

        if (!res.ok) throw new Error('Chat API failed');
        const data = await res.json();

        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, id: Date.now() },
        ]);
      } catch (err) {
        console.error('Chat error:', err);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: 'Failed to get a response. Please try again.', id: Date.now(), error: true },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    []
  );

  const handleChatSubmit = useCallback(
    async (query) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.apiKey || !query.trim()) return;

      const userMsg = { role: 'user', content: query, id: Date.now() };
      setChatHistory((prev) => [...prev, userMsg]);
      setIsChatLoading(true);

      try {
        const fullText = transcriptChunksRef.current.map((c) => c.text).join('\n');
        const contextForChat = fullText.slice(-(currentSettings.chatContextLength || 6000));

        const currentHistory = chatHistory
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSettings.apiKey}`,
          },
          body: JSON.stringify({
            transcript: contextForChat,
            chatHistory: currentHistory,
            query,
            chatPrompt: currentSettings.chatPrompt,
          }),
        });

        if (!res.ok) throw new Error('Chat API failed');
        const data = await res.json();

        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer, id: Date.now() },
        ]);
      } catch (err) {
        console.error('Chat error:', err);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: 'Failed to get a response. Please try again.', id: Date.now(), error: true },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [chatHistory]
  );

  // ─────────────────────────── EXPORT ───────────────────────────
  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      transcript: transcriptChunks.map((c) => ({ text: c.text, timestamp: c.timestamp })),
      suggestions: suggestions.map((s) => ({ preview: s.preview, action: s.action })),
      chat: chatHistory.map((m) => ({ role: m.role, content: m.content })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twinmind-session-${new Date().toISOString().replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <div className="header-title">TwinMind</div>
          <span className="header-badge">Copilot</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn" onClick={handleExport}>Export</button>
          <button className="btn" onClick={() => setShowSettings(true)}>⚙ Settings</button>
        </div>
      </header>

      <main className="main-content">
        <TranscriptColumn
          isRecording={isRecording}
          onStart={startRecording}
          onStop={stopRecording}
          chunks={transcriptChunks}
        />
        <SuggestionsColumn
          suggestions={suggestions}
          isLoading={isLoadingSuggestions}
          onManualRefresh={handleManualRefresh}
          onSendToChat={handleSendToChat}
        />
        <ChatColumn
          history={chatHistory}
          onSubmit={handleChatSubmit}
          isLoading={isChatLoading}
        />
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
