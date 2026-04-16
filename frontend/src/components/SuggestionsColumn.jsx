import React, { useState } from 'react';

function SuggestionsColumn({ suggestions, isLoading, onManualRefresh, onSendToChat }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getSuggestionIcon = (suggestion) => {
    const text = (suggestion.preview + ' ' + suggestion.action).toLowerCase();
    if (text.includes('ask') || text.includes('question')) return '❓';
    if (text.includes('fact') || text.includes('check') || text.includes('verify')) return '✅';
    if (text.includes('clarif') || text.includes('explain') || text.includes('define')) return '💡';
    if (text.includes('point') || text.includes('mention') || text.includes('discuss')) return '💬';
    if (text.includes('answer') || text.includes('respond')) return '📝';
    return '⚡';
  };

  return (
    <div className="column column-suggestions">
      <div className="column-header">
        <span>Live Suggestions</span>
        <button
          className="btn btn-sm"
          onClick={onManualRefresh}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="column-body">
        {suggestions.length === 0 && !isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">💡</div>
            <p>Suggestions will appear here after you start recording.</p>
            <p className="text-muted">They refresh automatically with each transcript chunk.</p>
          </div>
        ) : null}

        {isLoading && suggestions.length === 0 && (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Analyzing transcript...</p>
          </div>
        )}

        <div className="suggestions-list">
          {suggestions.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className={`suggestion-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div
                  className="suggestion-header"
                  onClick={() => toggleExpand(item.id)}
                >
                  <span className="suggestion-icon">{getSuggestionIcon(item)}</span>
                  <span className="suggestion-preview">{item.preview}</span>
                  <span className="suggestion-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div className="suggestion-body">
                    <p className="suggestion-action">{item.action}</p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToChat(item);
                      }}
                    >
                      💬 Get Detailed Answer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SuggestionsColumn;
