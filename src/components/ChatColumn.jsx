import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ChatColumn({ history, onSubmit, isLoading }) {
  const [inputVal, setInputVal] = useState('');
  const latestMsgRef = useRef(null);

  // Scroll to the TOP of the latest message when history updates
  useEffect(() => {
    if (history.length > 0) {
      setTimeout(() => {
        latestMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [history.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim() && !isLoading) {
      onSubmit(inputVal.trim());
      setInputVal('');
    }
  };

  const lastIndex = history.length - 1;

  return (
    <div className="column column-chat">
      <div className="column-header">
        <span>Detailed Chat</span>
        {isLoading && <span className="header-loading">Thinking...</span>}
      </div>

      <div className="column-body">
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>Click "Get Detailed Answer" on a suggestion or type a question below.</p>
            <p className="text-muted">All responses are context-aware using the live transcript.</p>
          </div>
        ) : (
          history.map((msg, idx) => (
            <div
              key={msg.id}
              ref={idx === lastIndex ? latestMsgRef : null}
              className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-assistant'}`}
            >
              <div className="message-label">
                {msg.role === 'user' ? '🧑 You' : '🤖 Copilot'}
              </div>
              <div className={`message-bubble ${msg.error ? 'message-error' : ''}`}>
                {msg.role === 'assistant' ? (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="chat-message chat-assistant" ref={latestMsgRef}>
            <div className="message-label">🤖 Copilot</div>
            <div className="message-bubble typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-container" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask anything about the meeting..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputVal.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatColumn;
