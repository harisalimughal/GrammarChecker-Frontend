import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LogOut, 
  User, 
  Check, 
  AlertTriangle, 
  FileText, 
  Sparkles,
  Copy,
  Eye,
  RotateCcw,
  X,
  CheckCircle
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GrammarChecker = () => {
  const [text, setText] = useState('');
  const [corrections, setCorrections] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [lastCheckedText, setLastCheckedText] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [appliedCorrections, setAppliedCorrections] = useState(new Set());
  const [copyStatus, setCopyStatus] = useState('');
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    errors: 0
  });
  
  const { user, logout, token } = useAuth();
  const textareaRef = useRef(null);
  const tooltipRef = useRef(null);

  // Update stats when text changes
  useEffect(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    
    setStats({
      words,
      characters,
      errors: corrections.filter(c => !appliedCorrections.has(c.id)).length
    });
  }, [text, corrections, appliedCorrections]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    setError('');
    setActiveTooltip(null);
    
    // Clear corrections if text changed significantly
    if (lastCheckedText && Math.abs(e.target.value.length - lastCheckedText.length) > 10) {
      setCorrections([]);
      setLastCheckedText('');
      setAppliedCorrections(new Set());
    }
  };

  const checkGrammar = async () => {
    if (!text.trim()) {
      setError('Please enter some text to check');
      return;
    }

    if (text === lastCheckedText) {
      setError('Text has not changed since last check');
      return;
    }

    setIsChecking(true);
    setError('');
    setCorrections([]);
    setAppliedCorrections(new Set());
    setActiveTooltip(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/check-grammar`,
        { text },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.corrections) {
        // Add unique IDs to corrections for tracking
        const correctionsWithIds = response.data.corrections.map((correction, index) => ({
          ...correction,
          id: `correction_${index}_${Date.now()}`
        }));
        setCorrections(correctionsWithIds);
        setLastCheckedText(text);
      }
    } catch (err) {
      console.error('Grammar check error:', err);
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        return;
      }
      
      setError(
        err.response?.data?.error || 
        'Failed to check grammar. Please try again.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  const applyCorrection = (correction) => {
    const before = text.substring(0, correction.start);
    const after = text.substring(correction.end);
    const newText = before + correction.suggestion + after;
    
    setText(newText);
    setAppliedCorrections(prev => new Set([...prev, correction.id]));
    setActiveTooltip(null);
    
    // Update positions of remaining corrections
    const lengthDiff = correction.suggestion.length - correction.word.length;
    setCorrections(prev => prev.map(c => {
      if (c.id === correction.id) return c;
      if (c.start > correction.start) {
        return {
          ...c,
          start: c.start + lengthDiff,
          end: c.end + lengthDiff
        };
      }
      return c;
    }));
  };

  const dismissCorrection = (correctionId) => {
    setAppliedCorrections(prev => new Set([...prev, correctionId]));
    setActiveTooltip(null);
  };

  const clearText = () => {
    setText('');
    setCorrections([]);
    setLastCheckedText('');
    setError('');
    setAppliedCorrections(new Set());
    setActiveTooltip(null);
    setCopyStatus('');
    textareaRef.current?.focus();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setCopyStatus('Failed');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const handleErrorClick = (correction, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (activeTooltip === correction.id) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip(correction.id);
    }
  };

  const renderHighlightedText = () => {
    if (!text.trim()) {
      return <div className="preview-placeholder">Start typing to see your text with grammar corrections highlighted...</div>;
    }

    const activeCorrections = corrections.filter(c => !appliedCorrections.has(c.id));

    if (activeCorrections.length === 0) {
      if (lastCheckedText === text) {
        return (
          <div className="no-errors">
            <CheckCircle className="success-icon" size={20} />
            <span>Excellent! No grammar or spelling errors found.</span>
            <div className="clean-text">{text}</div>
          </div>
        );
      }
      return <div className="preview-text">{text}</div>;
    }

    // Sort corrections by position (start to end to maintain correct positioning)
    const sortedCorrections = [...activeCorrections].sort((a, b) => a.start - b.start);
    
    let result = [];
    let lastIndex = 0;
    
    sortedCorrections.forEach((correction) => {
      // Add text before this correction
      if (correction.start > lastIndex) {
        result.push(text.substring(lastIndex, correction.start));
      }
      
      // Add the highlighted error with click handler
      const errorClass = correction.type === 'spelling' ? 'spelling-error' : 'grammar-error';
      const isActive = activeTooltip === correction.id;
      
      result.push(
        <span
          key={correction.id}
          className={`error-highlight ${errorClass} ${isActive ? 'active' : ''}`}
          onClick={(e) => handleErrorClick(correction, e)}
          style={{ position: 'relative' }}
        >
          {correction.word}
          {isActive && (
            <div ref={tooltipRef} className="correction-tooltip">
              <div className="tooltip-header">
                <span className="error-type">
                  {correction.type === 'spelling' ? 'Spelling' : 'Grammar'} Error
                </span>
                <button 
                  className="tooltip-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltip(null);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              
              <div className="tooltip-content">
                <div className="suggestion-section">
                  <div className="original-word">"{correction.word}"</div>
                  <div className="arrow">→</div>
                  <div className="suggested-word">"{correction.suggestion}"</div>
                </div>
                
                {correction.explanation && (
                  <div className="explanation">
                    <p>{correction.explanation}</p>
                  </div>
                )}
                
                <div className="tooltip-actions">
                  <button
                    className="apply-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyCorrection(correction);
                    }}
                  >
                    <Check size={14} />
                    Apply Fix
                  </button>
                  <button
                    className="dismiss-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissCorrection(correction.id);
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </span>
      );
      
      lastIndex = correction.end;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }
    
    return <div className="highlighted-text">{result}</div>;
  };

  const sampleTexts = [
    "This is a test sentense to chek gramer and speling erors.",
    "I have went to the store yesterday and buyed some groceries.",
    "She don't know nothing about the meeting that was suppose to happen."
  ];

  const loadSampleText = (sample) => {
    setText(sample);
    setCorrections([]);
    setLastCheckedText('');
    setError('');
    setAppliedCorrections(new Set());
    setActiveTooltip(null);
  };

  return (
    <div className="grammar-checker">
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <Sparkles className="logo-icon" size={32} />
            <h1>Grammar Checker Pro</h1>
          </div>
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <User className="user-icon" size={20} />
            <span className="username">{user?.username}</span>
          </div>
          <button onClick={logout} className="logout-button">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="content-grid">
          {/* Input Section */}
          <div className="input-section">
            <div className="section-header">
              <FileText size={20} />
              <h2>Enter Your Text</h2>
              <div className="text-stats">
                <span>{stats.words} words</span>
                <span>{stats.characters} characters</span>
                {stats.errors > 0 && (
                  <span className="error-count">
                    <AlertTriangle size={14} />
                    {stats.errors} {stats.errors === 1 ? 'error' : 'errors'}
                  </span>
                )}
              </div>
            </div>

            <div className="textarea-container">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                placeholder="Type or paste your text here to check for grammar and spelling errors..."
                className="text-input"
                rows={8}
                maxLength={5000}
              />
              
              <div className="textarea-actions">
                <button
                  onClick={clearText}
                  className="action-button secondary"
                  disabled={!text.trim()}
                >
                  <RotateCcw size={16} />
                  Clear
                </button>
                
                <button
                  onClick={copyToClipboard}
                  className="action-button secondary"
                  disabled={!text.trim()}
                >
                  <Copy size={16} />
                  {copyStatus || 'Copy'}
                </button>
                
                <button
                  onClick={checkGrammar}
                  className="action-button primary"
                  disabled={isChecking || !text.trim()}
                >
                  {isChecking ? (
                    <>
                      <div className="spinner small"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Check Grammar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sample Texts */}
            <div className="sample-section">
              <h3>Try Sample Texts</h3>
              <div className="sample-buttons">
                {sampleTexts.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => loadSampleText(sample)}
                    className="sample-button"
                    disabled={isChecking}
                  >
                    Sample {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="preview-section">
            <div className="section-header">
              <Eye size={20} />
              <h2>Live Preview</h2>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="toggle-preview"
              >
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>

            {showPreview && (
              <div className="preview-container">
                <div className="preview-content" onClick={() => setActiveTooltip(null)}>
                  {renderHighlightedText()}
                </div>

                {/* Instructions */}
                {corrections.filter(c => !appliedCorrections.has(c.id)).length > 0 && (
                  <div className="instructions">
                    <p>💡 Click on highlighted errors to see suggestions and apply fixes</p>
                  </div>
                )}

                {/* Legend */}
                {corrections.filter(c => !appliedCorrections.has(c.id)).length > 0 && (
                  <div className="error-legend">
                    <div className="legend-item">
                      <span className="legend-color spelling"></span>
                      <span>Spelling Error</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color grammar"></span>
                      <span>Grammar Error</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-banner">
            <AlertTriangle size={20} />
            <span>{error}</span>
            <button onClick={() => setError('')} className="error-close">
              ×
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isChecking && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="spinner large"></div>
              <h3>Analyzing your text...</h3>
              <p>Please wait while we check for grammar and spelling errors</p>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .error-highlight {
          cursor: pointer;
          border-radius: 2px;
          padding: 1px 2px;
          margin: -1px -2px;
          transition: all 0.2s ease;
          position: relative;
          z-index: 1;
        }

        .error-highlight:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .error-highlight.active {
          z-index: 10;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        }

        .spelling-error {
          background-color: #fef2f2;
          border-bottom: 2px wavy #ef4444;
          color: #dc2626;
        }

        .grammar-error {
          background-color: #fefbf2;
          border-bottom: 2px wavy #f59e0b;
          color: #d97706;
        }

        .correction-tooltip {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          width: 280px;
          z-index: 1000;
          margin-top: 5px;
        }

        .correction-tooltip::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-bottom: none;
          border-right: none;
          transform: translateX(-50%) rotate(45deg);
        }

        .tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          background: #f9fafb;
          border-radius: 8px 8px 0 0;
        }

        .error-type {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }

        .tooltip-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .tooltip-close:hover {
          background-color: #e5e7eb;
        }

        .tooltip-content {
          padding: 16px;
        }

        .suggestion-section {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .original-word {
          color: #dc2626;
          font-weight: 500;
          background: #fef2f2;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .arrow {
          color: #6b7280;
          font-weight: bold;
        }

        .suggested-word {
          color: #059669;
          font-weight: 500;
          background: #f0fdf4;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .explanation {
          margin-bottom: 16px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }

        .explanation p {
          margin: 0;
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
        }

        .tooltip-actions {
          display: flex;
          gap: 8px;
        }

        .apply-btn {
          flex: 1;
          background: #059669;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background-color 0.2s;
        }

        .apply-btn:hover {
          background: #047857;
        }

        .dismiss-btn {
          background: #f3f4f6;
          color: #6b7280;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .dismiss-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .highlighted-text {
          line-height: 1.6;
          font-size: 16px;
        }

        .instructions {
          margin-top: 12px;
          padding: 12px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          border-radius: 6px;
        }

        .instructions p {
          margin: 0;
          font-size: 14px;
          color: #1e40af;
        }

        .no-errors {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
        }

        .success-icon {
          color: #059669;
        }

        .no-errors > span {
          color: #059669;
          font-weight: 500;
          font-size: 16px;
        }

        .clean-text {
          margin-top: 16px;
          padding: 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          line-height: 1.6;
          color: #374151;
          width: 100%;
          text-align: left;
        }
      `}</style>
    </div>
  );
};

export default GrammarChecker;