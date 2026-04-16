import React, { useState } from 'react';

function SettingsModal({ settings, onChange, onClose }) {
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('general');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onChange(localSettings);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙ Settings</h2>
          <button className="btn btn-icon modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'general' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`tab ${activeTab === 'prompts' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            Prompts
          </button>
          <button
            className={`tab ${activeTab === 'context' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('context')}
          >
            Context Windows
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'general' && (
            <>
              <div className="form-group">
                <label className="form-label">Groq API Key <span className="required">*</span></label>
                <input
                  type="password"
                  name="apiKey"
                  className="form-input"
                  placeholder="gsk_..."
                  value={localSettings.apiKey || ''}
                  onChange={handleChange}
                />
                <span className="form-hint">Get your key at console.groq.com</span>
              </div>
            </>
          )}

          {activeTab === 'prompts' && (
            <>
              <div className="form-group">
                <label className="form-label">Live Suggestion Prompt</label>
                <textarea
                  name="suggestionPrompt"
                  className="form-textarea"
                  placeholder="Leave empty to use optimized default..."
                  value={localSettings.suggestionPrompt || ''}
                  onChange={handleChange}
                  rows={5}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Answer Prompt (on suggestion click)</label>
                <textarea
                  name="detailedAnswerPrompt"
                  className="form-textarea"
                  placeholder="Leave empty to use optimized default..."
                  value={localSettings.detailedAnswerPrompt || ''}
                  onChange={handleChange}
                  rows={5}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Chat Prompt (for free-text questions)</label>
                <textarea
                  name="chatPrompt"
                  className="form-textarea"
                  placeholder="Leave empty to use optimized default..."
                  value={localSettings.chatPrompt || ''}
                  onChange={handleChange}
                  rows={5}
                />
              </div>
            </>
          )}

          {activeTab === 'context' && (
            <>
              <div className="form-group">
                <label className="form-label">Live Suggestion Context Window (characters)</label>
                <input
                  type="number"
                  name="contextLength"
                  className="form-input"
                  value={localSettings.contextLength || 3000}
                  onChange={handleChange}
                  min={500}
                  max={10000}
                />
                <span className="form-hint">How much transcript text to send for generating suggestions (default: 3000)</span>
              </div>

              <div className="form-group">
                <label className="form-label">Chat Context Window (characters)</label>
                <input
                  type="number"
                  name="chatContextLength"
                  className="form-input"
                  value={localSettings.chatContextLength || 6000}
                  onChange={handleChange}
                  min={1000}
                  max={20000}
                />
                <span className="form-hint">How much transcript to send for detailed chat answers (default: 6000)</span>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
