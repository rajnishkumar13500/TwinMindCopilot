import React, { useEffect, useRef } from 'react';

function TranscriptColumn({ isRecording, onStart, onStop, chunks }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  const formatTime = (isoStr) => {
    try {
      return new Date(isoStr).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="column column-transcript">
      <div className="column-header">
        <span>Transcript</span>
        <button
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          onClick={isRecording ? onStop : onStart}
        >
          {isRecording ? '⏹ Stop' : '🎙 Start Mic'}
        </button>
      </div>

      <div className="column-body">
        {chunks.length === 0 && !isRecording ? (
          <div className="empty-state">
            <div className="empty-icon">🎙</div>
            <p>No transcript yet.</p>
            <p className="text-muted">Click "Start Mic" to begin recording.</p>
          </div>
        ) : (
          chunks.map((chunk) => (
            <div key={chunk.id} className="transcript-chunk">
              <span className="chunk-time">{formatTime(chunk.timestamp)}</span>
              <span className="chunk-text">{chunk.text}</span>
            </div>
          ))
        )}

        {isRecording && (
          <div className="recording-indicator">
            <div className="dot"></div>
            <span>Listening...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default TranscriptColumn;
