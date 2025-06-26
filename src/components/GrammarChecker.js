import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Debounce hook for live checking
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

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
  const [isLiveChecking, setIsLiveChecking] = useState(false);
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    errors: 0
  });
  
  const { user, logout, token } = useAuth();
  const textareaRef = useRef(null);
  const tooltipRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounced text for live checking
  const debouncedText = useDebounce(text, 100); // 1 second delay

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

  // Live grammar checking with more detailed logging
  useEffect(() => {
    console.log('Live check effect triggered:', {
      debouncedTextLength: debouncedText.length,
      lastCheckedTextLength: lastCheckedText.length,
      textsEqual: debouncedText === lastCheckedText
    });

    if (!debouncedText.trim()) {
      console.log('No text to check');
      return;
    }


    // Only trigger live check if text is substantial (more than 10 characters)
    if (debouncedText.trim().length < 10) {
      console.log('Text too short for live check:', debouncedText.trim().length);
      return;
    }

    console.log('Triggering live check for:', debouncedText.substring(0, 50) + '...');
    performLiveCheck(debouncedText);
  }, [debouncedText]);

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

  // Helper function to find word boundaries more reliably
  const findWordBoundaries = (text, targetWord, approximateStart) => {
    // Try exact match first
    const exactIndex = text.indexOf(targetWord, Math.max(0, approximateStart - 10));
    if (exactIndex !== -1) {
      return { start: exactIndex, end: exactIndex + targetWord.length };
    }

    // Try case-insensitive match
    const lowerText = text.toLowerCase();
    const lowerTarget = targetWord.toLowerCase();
    const caseInsensitiveIndex = lowerText.indexOf(lowerTarget, Math.max(0, approximateStart - 10));
    if (caseInsensitiveIndex !== -1) {
      return { start: caseInsensitiveIndex, end: caseInsensitiveIndex + targetWord.length };
    }

    // Try fuzzy matching within a reasonable range
    const searchStart = Math.max(0, approximateStart - 20);
    const searchEnd = Math.min(text.length, approximateStart + targetWord.length + 20);
    const searchText = text.substring(searchStart, searchEnd);
    
    // Look for partial matches
    for (let i = 0; i < searchText.length - targetWord.length + 1; i++) {
      const candidate = searchText.substring(i, i + targetWord.length);
      if (candidate.toLowerCase() === lowerTarget) {
        return { 
          start: searchStart + i, 
          end: searchStart + i + targetWord.length 
        };
      }
    }

    return null;
  };

  const performLiveCheck = async (textToCheck) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLiveChecking(true);
    setError('');

    try {
      console.log('Performing live check for text:', textToCheck);
      
      const response = await axios.post(
        `${API_BASE_URL}/check-grammar`,
        { text: textToCheck },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: abortControllerRef.current.signal
        }
      );

      console.log('Live check response:', response.data);

      // Handle both cases: corrections array or empty response
      if (response.data.corrections && Array.isArray(response.data.corrections)) {
        console.log('Found corrections:', response.data.corrections.length);
        
        // Process corrections with improved position finding
        const correctionsWithIds = response.data.corrections.map((correction, index) => ({
          ...correction,
          id: `correction_${index}_${Date.now()}`
        }));
        
        // Validate and fix corrections
        const validCorrections = correctionsWithIds.map(correction => {
          // First try to use the provided positions
          let start = correction.start;
          let end = correction.end;
          let word = correction.word;
          
          // Validate the positions
          if (start !== undefined && end !== undefined && start >= 0 && end <= textToCheck.length) {
            const textSlice = textToCheck.substring(start, end);
            
            if (textSlice === word || textSlice.toLowerCase() === word.toLowerCase()) {
              // Positions are correct
              return {
                ...correction,
                start,
                end,
                word: textSlice // Use the actual text slice
              };
            }
          }
          
          // If positions are incorrect, try to find the word
          console.log('Attempting to find word:', word, 'near position:', start);
          
          const boundaries = findWordBoundaries(textToCheck, word, start || 0);
          if (boundaries) {
            console.log('Found word at:', boundaries);
            return {
              ...correction,
              start: boundaries.start,
              end: boundaries.end,
              word: textToCheck.substring(boundaries.start, boundaries.end)
            };
          }
          
          console.warn('Could not locate word in text:', word);
          return null;
        }).filter(Boolean); // Remove null entries

        console.log('Valid corrections after processing:', validCorrections.length);
        
        setCorrections(validCorrections);
        setLastCheckedText(textToCheck);
        setAppliedCorrections(new Set()); // Reset applied corrections for new check
      } else {
        console.log('No corrections found or invalid response format');
        setCorrections([]);
        setLastCheckedText(textToCheck);
        setAppliedCorrections(new Set());
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log('Live check request was cancelled');
        return; // Request was cancelled, ignore
      }

      console.error('Live grammar check error:', err);
      console.error('Error response:', err.response?.data);
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        return;
      }
      
      // For debugging, temporarily show errors
      if (process.env.NODE_ENV === 'development') {
        setError(`Live check error: ${err.response?.data?.error || err.message}`);
      }
    } finally {
      setIsLiveChecking(false);
    }
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    setError('');
    setActiveTooltip(null);
    
    // If text changed significantly, clear old corrections
    if (Math.abs(newText.length - text.length) > 5) {
      // Don't clear corrections immediately to avoid flickering
      // Let the live check handle it
    }
  };

  const checkGrammar = async () => {
    if (!text.trim()) {
      setError('Please enter some text to check');
      return;
    }

    setIsChecking(true);
    setError('');
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
        // Use the same processing logic as live check
        const correctionsWithIds = response.data.corrections.map((correction, index) => ({
          ...correction,
          id: `correction_${index}_${Date.now()}`
        }));
        
        const validCorrections = correctionsWithIds.map(correction => {
          let start = correction.start;
          let end = correction.end;
          let word = correction.word;
          
          if (start !== undefined && end !== undefined && start >= 0 && end <= text.length) {
            const textSlice = text.substring(start, end);
            
            if (textSlice === word || textSlice.toLowerCase() === word.toLowerCase()) {
              return {
                ...correction,
                start,
                end,
                word: textSlice
              };
            }
          }
          
          const boundaries = findWordBoundaries(text, word, start || 0);
          if (boundaries) {
            return {
              ...correction,
              start: boundaries.start,
              end: boundaries.end,
              word: text.substring(boundaries.start, boundaries.end)
            };
          }
          
          return null;
        }).filter(Boolean);

        setCorrections(validCorrections);
        setLastCheckedText(text);
        setAppliedCorrections(new Set());
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

    // Update lastCheckedText to reflect the change
    setLastCheckedText(newText);
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
    console.log('Rendering highlighted text:', {
      textLength: text.length,
      correctionsCount: corrections.length,
      appliedCorrectionsCount: appliedCorrections.size,
      activeCorrections: corrections.filter(c => !appliedCorrections.has(c.id)).length,
      lastCheckedText: lastCheckedText === text,
      isLiveChecking
    });

    if (!text.trim()) {
      return (
        <div className="preview-placeholder">
          <p>Start typing to see your text with live grammar corrections...</p>
        </div>
      );
    }

    const activeCorrections = corrections.filter(c => !appliedCorrections.has(c.id));
    console.log('Active corrections:', activeCorrections);

    if (activeCorrections.length === 0) {
      if (lastCheckedText === text && !isLiveChecking) {
        return (
          <div className="no-errors">
            <CheckCircle className="success-icon" size={20} />
            <span>Excellent! No grammar or spelling errors found.</span>
            <div className="clean-text">{text}</div>
          </div>
        );
      }
      return (
        <div className="preview-text">
          {text}
        </div>
      );
    }

    // Sort corrections by position and filter out overlapping ones
    const sortedCorrections = [...activeCorrections]
      .sort((a, b) => a.start - b.start)
      .filter((correction, index, arr) => {
        // Remove overlapping corrections - keep the first one
        if (index === 0) return true;
        const prevCorrection = arr[index - 1];
        return correction.start >= prevCorrection.end;
      });
    
    console.log('Sorted corrections for rendering:', sortedCorrections);
    
    const result = [];
    let currentIndex = 0;
    let keyCounter = 0;
    
    sortedCorrections.forEach((correction) => {
      // Add text before this correction
      if (correction.start > currentIndex) {
        const textBefore = text.substring(currentIndex, correction.start);
        if (textBefore) {
          result.push(
            <span key={`text-${keyCounter++}`} className="regular-text">
              {textBefore}
            </span>
          );
        }
      }
      
      // Add the highlighted error
      const errorClass = correction.type === 'spelling' ? 'spelling-error' : 'grammar-error';
      const isActive = activeTooltip === correction.id;
      
      result.push(
        <span
          key={correction.id}
          className={`error-highlight ${errorClass} ${isActive ? 'active' : ''}`}
          onClick={(e) => handleErrorClick(correction, e)}
          style={{ position: 'relative', display: 'inline-block' }}
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
      
      // Update current index to end of this correction
      currentIndex = correction.end;
    });
    
    // Add remaining text after all corrections
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      if (remainingText) {
        result.push(
          <span key={`text-${keyCounter++}`} className="regular-text">
            {remainingText}
          </span>
        );
      }
    }
    
    return (
      <div className="highlighted-text" style={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        lineHeight: '1.6'
      }}>
        {result}
      </div>
    );
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
                placeholder="Type or paste your text here. Live grammar checking is enabled - errors will be highlighted automatically as you type..."
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
                      Force Check
                    </>
                  )}
                </button>
              </div>
            </div>
            
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
    </div>
  );
};

export default GrammarChecker;