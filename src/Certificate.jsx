import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, Edit3, Loader2, ShieldAlert } from 'lucide-react';
import { toPng } from 'html-to-image';
import { decryptCertificateVault } from './cryptoEngine';

const USER_NAME_KEY = 'eschaton_cert_user_name_v1';

async function deriveUniqueKey(name, timestamp, masterToken) {
  try {
    const enc = new TextEncoder();
    const payload = `921:${name}:${timestamp}:${masterToken}`;
    const digestBuffer = await window.crypto.subtle.digest("SHA-256", enc.encode(payload));
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    return '0x921' + hashArray.slice(0, 14).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (e) {
    return '0x921F1A990B01DDE29F440188A21C00';
  }
}

export function Certificate({ solvedTimestamp, tokenChain, onReset }) {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem(USER_NAME_KEY) || 'Anonymous Pilgrim';
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [isDownloading, setIsDownloading] = useState(false);

  // Vault decryption state
  const [vaultData, setVaultData] = useState(null);
  const [decryptError, setDecryptError] = useState(false);
  const [uniqueHash, setUniqueHash] = useState('');

  const certRef = useRef(null);

  const dateStr = new Date(solvedTimestamp || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Attempt to cryptographically decrypt the certificate payload using the 12 proof tokens
  useEffect(() => {
    let isMounted = true;

    async function attemptDecryption() {
      try {
        const payload = await decryptCertificateVault(tokenChain);
        if (isMounted) {
          setVaultData(payload);
          setDecryptError(false);
          const key = await deriveUniqueKey(userName, solvedTimestamp || Date.now(), payload.masterToken);
          setUniqueHash(key);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Cryptographic tamper detected:", err);
          setDecryptError(true);
        }
      }
    }

    attemptDecryption();
    return () => { isMounted = false; };
  }, [tokenChain, userName, solvedTimestamp]);

  const handleSaveName = (e) => {
    e.preventDefault();
    const finalName = tempName.trim() || 'Anonymous Pilgrim';
    setUserName(finalName);
    localStorage.setItem(USER_NAME_KEY, finalName);
    setIsEditing(false);
  };

  const handleDownload = async () => {
    if (!certRef.current || isDownloading || decryptError) return;

    try {
      setIsDownloading(true);

      const dataUrl = await toPng(certRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        filter: (node) => {
          return !node.classList?.contains('no-download');
        }
      });

      const cleanFilename = `ESCHATON_Certificate_${userName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      const link = document.createElement('a');
      link.download = cleanFilename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate certificate download', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // If someone manipulated state to skip questions, render tamper lockdown
  if (decryptError) {
    return (
      <div className="tamper-lockdown">
        <ShieldAlert size={48} className="tamper-icon" />
        <h2 className="tamper-title">INTEGRITY FAULT</h2>
        <p className="tamper-desc">
          State authorization failed. Sequence continuity broken.
        </p>
        <p className="tamper-sub">
          The credential can only be issued upon complete, sequential resolution.
        </p>
        <button onClick={onReset} className="btn-restart-tamper">
          RESET SEQUENCE
        </button>
      </div>
    );
  }

  if (!vaultData) {
    return (
      <div className="vault-loading">
        <Loader2 size={24} className="spinner" />
        <span>Authenticating sequence...</span>
      </div>
    );
  }

  return (
    <div className="certificate-wrapper">
      <div className="certificate-frame" id="eschaton-certificate" ref={certRef}>
        <div className="cert-inner-border" />

        <div className="cert-header">
          <div className="cert-header-icon">
            <img src="/eschaton-logo.svg" alt="Eschaton Seal" className="cert-logo" />
          </div>
          <span className="cert-kicker">CERTIFICATE OF DEMONSTRATED PROFICIENCY</span>
          <h1 className="cert-title">ESCHATON</h1>
          <span className="cert-subtitle">DEEP INVESTIGATIVE RESEARCH & FORENSICS REGISTER</span>
        </div>

        <div className="cert-body">
          <p className="cert-intro">THIS OFFICIAL CREDENTIAL CONFIRMS THAT</p>

          <div className="recipient-row">
            {!isEditing ? (
              <div className="recipient-display" onClick={() => setIsEditing(true)}>
                <span className="recipient-name">{userName}</span>
                <button
                  className="edit-name-btn no-download"
                  title="Click to edit name on certificate"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  <Edit3 size={12} />
                  <span>Edit Name</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveName} className="name-edit-form no-download">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Enter recipient name..."
                  className="name-input"
                  autoFocus
                  maxLength={40}
                />
                <button type="submit" className="name-save-btn">Save</button>
                <button
                  type="button"
                  className="name-cancel-btn"
                  onClick={() => {
                    setTempName(userName);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            )}
            <div className="recipient-underline" />
          </div>

          <p className="cert-proclamation">
            {vaultData.proclamation}
          </p>

          <div className="cert-specs">
            <div className="cert-spec-item">
              <span className="spec-label">VERIFICATION SCHEME</span>
              <span className="spec-value">CRYPTOGRAPHIC CONSENSUS PROTOCOL</span>
            </div>
            <div className="cert-spec-item">
              <span className="spec-label">CURRICULUM RESOLVED</span>
              <span className="spec-value">12 / 12 PHASES (HISTORICAL & FORENSIC INQUIRIES)</span>
            </div>
            <div className="cert-spec-item">
              <span className="spec-label">ISSUANCE DATE</span>
              <span className="spec-value">{dateStr}</span>
            </div>
            <div className="cert-spec-item">
              <span className="spec-label">DYNAMIC CRYPTOGRAPHIC KEY</span>
              <span className="spec-value font-mono">{uniqueHash}</span>
            </div>
          </div>
        </div>

        <div className="cert-footer">
          <div className="signature-block">
            <span className="sig-handwriting">Eschaton Enclave</span>
            <div className="sig-line" />
            <span className="sig-caption">ARCHITECTURAL REGISTER</span>
          </div>

          <div className="cert-seal-stamp">
            <div className="stamp-inner">
              <span className="stamp-title">AUTHENTICATED</span>
              <span className="stamp-sub">{vaultData.sealText}</span>
            </div>
          </div>

          <div className="signature-block">
            <span className="sig-handwriting">Order of Primes</span>
            <div className="sig-line" />
            <span className="sig-caption">CRYPTOGRAPHIC PROTOCOL</span>
          </div>
        </div>
      </div>

      <div className="cert-actions">
        <button
          onClick={handleDownload}
          className="btn-print"
          disabled={isDownloading}
        >
          {isDownloading ? (
            <>
              <Loader2 size={14} className="spinner" />
              <span>Generating Image...</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Download Certificate (PNG)</span>
            </>
          )}
        </button>
        <button onClick={onReset} className="btn-subtle" disabled={isDownloading}>
          <RefreshCw size={13} />
          <span>Reset Session</span>
        </button>
      </div>
    </div>
  );
}
