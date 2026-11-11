import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, ShieldAlert, RefreshCw } from 'lucide-react';
import {
  TOTAL_STAGES,
  STAGE_01,
  verifyHash,
  decryptStage,
  decryptStage1Note
} from './cryptoEngine';
import { Certificate } from './Certificate';
import './App.css';

const STORAGE_KEY = 'eschaton_user_progress_v2';

export default function App() {
  // Load progress and token chain from localStorage
  const [savedData, setSavedData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Storage read error", e);
    }
    return { stage: 0, solvedTimestamp: null, tokenChain: [] };
  });

  const [currentStage, setCurrentStage] = useState(savedData.stage || 0);
  const [tokenChain, setTokenChain] = useState(savedData.tokenChain || []);
  const [solvedTimestamp, setSolvedTimestamp] = useState(savedData.solvedTimestamp || null);

  const [activePuzzle, setActivePuzzle] = useState(STAGE_01);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(false);

  const [inputVal, setInputVal] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'verifying' | 'failed' | 'passed'
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [latestNote, setLatestNote] = useState(null);

  // Synchronize state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        stage: currentStage,
        solvedTimestamp: solvedTimestamp,
        tokenChain: tokenChain,
      }));
    } catch (e) {
      console.warn("Storage save error", e);
    }
  }, [currentStage, solvedTimestamp, tokenChain]);

  // Decrypt current stage on mount or when currentStage / tokenChain changes
  useEffect(() => {
    let isMounted = true;

    if (currentStage >= TOTAL_STAGES) {
      return;
    }

    if (currentStage === 0) {
      setActivePuzzle(STAGE_01);
      setDecryptError(false);
      return;
    }

    async function resolveStage() {
      setDecrypting(true);
      try {
        const decryptedPuzzle = await decryptStage(currentStage, tokenChain);
        if (isMounted) {
          setActivePuzzle(decryptedPuzzle);
          setDecryptError(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Tamper or missing cryptographic token:", err);
          setDecryptError(true);
          setActivePuzzle(null);
        }
      } finally {
        if (isMounted) {
          setDecrypting(false);
        }
      }
    }

    resolveStage();
    return () => { isMounted = false; };
  }, [currentStage, tokenChain]);

  const isCompleted = currentStage >= TOTAL_STAGES;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || status === 'verifying' || isCompleted || !activePuzzle) return;

    setStatus('verifying');

    const { isValid, proofToken } = await verifyHash(inputVal, activePuzzle.salt, activePuzzle.target);

    if (isValid && proofToken) {
      setStatus('passed');
      const completedIndex = currentStage;

      // Unseal solution note (Stage 1 note is AES-decrypted with proofToken; Stages 2+ already unsealed)
      let resolvedNote = activePuzzle.note;
      if (completedIndex === 0) {
        try {
          resolvedNote = await decryptStage1Note(proofToken);
        } catch (e) {
          resolvedNote = "Verification successful. Advancing to Phase 02.";
        }
      }

      setLatestNote({
        stageNum: completedIndex + 1,
        title: activePuzzle.label,
        note: resolvedNote,
      });

      // Append proof token to key chain
      const nextChain = [...tokenChain, proofToken];
      setTokenChain(nextChain);

      setTimeout(() => {
        const nextStage = completedIndex + 1;
        setCurrentStage(nextStage);
        setInputVal('');
        setStatus('idle');

        if (nextStage >= TOTAL_STAGES) {
          setSolvedTimestamp(Date.now());
        }

        setShowNoteModal(true);
      }, 700);
    } else {
      setStatus('failed');
      setTimeout(() => setStatus('idle'), 1800);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('eschaton_cert_user_name_v1');
    localStorage.removeItem('eschaton_user_progress_v1');
    setCurrentStage(0);
    setTokenChain([]);
    setSolvedTimestamp(null);
    setInputVal('');
    setStatus('idle');
    setDecryptError(false);
    setActivePuzzle(STAGE_01);
    setShowNoteModal(false);
    setLatestNote(null);
  };

  return (
    <div className="layout">
      {/* Header */}
      <header className="header no-print">
        <div className="brand-group">
          <img src="/eschaton-logo.svg" alt="Eschaton Icon" className="site-logo" />
          <span className="brand-name">eschaton</span>
        </div>
        <div className="header-right">
          <span>stage {Math.min(currentStage + 1, TOTAL_STAGES)} / {TOTAL_STAGES}</span>
          <span className="divider">/</span>
          <span className="storage-badge">● SAVED LOCALLY</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content">
        {decryptError ? (
          <div className="tamper-lockdown">
            <ShieldAlert size={48} className="tamper-icon" />
            <h2 className="tamper-title">INTEGRITY FAULT</h2>
            <p className="tamper-desc">
              State authorization failed. Sequence continuity broken.
            </p>
            <p className="tamper-sub">
              Each phase must be legitimately resolved in sequence.
            </p>
            <button onClick={handleReset} className="btn-restart-tamper">
              <RefreshCw size={13} style={{ display: 'inline', marginRight: '6px' }} />
              RESET SEQUENCE
            </button>
          </div>
        ) : !isCompleted ? (
          decrypting ? (
            <div className="puzzle-container" style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={24} className="spinner" style={{ margin: '0 auto 16px auto', display: 'block' }} />
              <p className="text-muted">Resolving phase...</p>
            </div>
          ) : activePuzzle ? (
            <div className="puzzle-container">
              <div className="stage-meta">
                <span>{activePuzzle.label}</span>
              </div>

              <h1 className="problem-statement">{activePuzzle.cipher}</h1>

              <p className="problem-clue">{activePuzzle.clue}</p>

              <form onSubmit={handleSubmit} className="input-form">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Enter solution..."
                  className={`text-input ${status === 'failed' ? 'error' : ''} ${status === 'passed' ? 'success' : ''}`}
                  autoFocus
                  disabled={status === 'verifying' || status === 'passed'}
                  spellCheck="false"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={status === 'verifying' || !inputVal.trim()}
                >
                  {status === 'verifying' ? (
                    <Loader2 size={15} className="spinner" />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                </button>
              </form>

              <div className="status-line">
                {status === 'verifying' && <span className="text-muted">verifying sequence...</span>}
                {status === 'failed' && <span className="text-error">incorrect solution</span>}
                {status === 'passed' && <span className="text-success">accepted. advancing...</span>}
                {status === 'idle' && (
                  <span className="text-faint">Progress auto-saved.</span>
                )}
              </div>

              <div className="progress-bar">
                {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
                  <div
                    key={i}
                    className={`bar-step ${i === currentStage ? 'active' : ''} ${i < currentStage ? 'done' : ''}`}
                  />
                ))}
              </div>
            </div>
          ) : null
        ) : (
          <Certificate
            solvedTimestamp={solvedTimestamp}
            tokenChain={tokenChain}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Note Modal after completing each question */}
      {showNoteModal && latestNote && (
        <div className="note-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="note-card" onClick={(e) => e.stopPropagation()}>
            <div className="note-topline">
              <span className="note-step">PHASE {latestNote.stageNum.toString().padStart(2, '0')} RESOLVED</span>
              <button className="note-close-btn" onClick={() => setShowNoteModal(false)}>✕</button>
            </div>
            <h3 className="note-title">{latestNote.title}</h3>
            <div className="note-quote">
              <p>{latestNote.note}</p>
            </div>
            <div className="note-action">
              <button className="btn-continue" onClick={() => setShowNoteModal(false)}>
                <span>{latestNote.stageNum === TOTAL_STAGES ? 'VIEW CERTIFICATE' : 'CONTINUE TO NEXT PHASE'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
