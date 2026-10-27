import React, { useState, useEffect } from 'react';
import { api, Account } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  currentAccountId: string | null;
  onTransferSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const TransferModal: React.FC<Props> = ({
  isOpen,
  onClose,
  accounts,
  currentAccountId,
  onTransferSuccess,
  showToast,
}) => {
  const [sourceId, setSourceId] = useState(currentAccountId || '');
  const [destId, setDestId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (currentAccountId) setSourceId(currentAccountId);
      const possibleDest = accounts.find((a) => a.id !== (currentAccountId || sourceId));
      if (possibleDest) setDestId(possibleDest.id);
      setAmount('');
      setDescription('');
      setInlineError(null);
      setReferenceId(`TRF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
    }
  }, [isOpen, currentAccountId, accounts]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    if (!sourceId || !destId) {
      setInlineError('Both source and destination accounts are required');
      showToast('Both source and destination accounts are required', 'error');
      return;
    }
    if (sourceId === destId) {
      setInlineError('Source and destination accounts must be different');
      showToast('Source and destination accounts must be different', 'error');
      return;
    }
    if (numAmount <= 0) {
      setInlineError('Transfer amount must be greater than 0');
      showToast('Transfer amount must be greater than 0', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.createTransfer({
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: numAmount,
        description: description.trim() || undefined,
        reference_id: referenceId.trim(),
      });

      showToast(
        `Atomic Transfer of $${numAmount.toFixed(2)} completed! Source new balance: $${res.source_new_balance.toFixed(2)}`,
        'success'
      );
      onTransferSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Transfer failed';
      setInlineError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Atomic Money Transfer (Bonus)</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="source-acc">Source Account (Debit from) *</label>
            <select
              id="source-acc"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (${acc.balance.toFixed(2)}) — #{acc.id.substring(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dest-acc">Destination Account (Credit to) *</label>
            <select
              id="dest-acc"
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              required
            >
              <option value="">-- Select Destination Account --</option>
              {accounts
                .filter((acc) => acc.id !== sourceId)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (${acc.balance.toFixed(2)}) — #{acc.id.substring(0, 8)}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="trf-amount">Amount ($ USD) *</label>
            <input
              id="trf-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="trf-ref">Reference ID *</label>
            <input
              id="trf-ref"
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="trf-desc">Description</label>
            <input
              id="trf-desc"
              type="text"
              placeholder="e.g. Split bills / Vendor settlement"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            padding: '0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            color: '#7dd3fc',
            lineHeight: 1.5,
          }}>
            ⚡ <strong>ACID Guarantee:</strong> Both debit and credit are executed within a single database transaction with deterministic row-level locking to prevent race conditions and deadlocks. If either account fails, the entire transfer is rolled back.
          </div>

          {inlineError && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              color: '#fecdd3',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>⚠️</span>
              <span>{inlineError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Transferring...' : 'Execute Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
