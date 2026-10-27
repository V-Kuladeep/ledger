import React, { useState, useEffect } from 'react';
import { api, Account } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  defaultType?: 'credit' | 'debit';
  onTransactionSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  lastUsedReference?: string;
}

export const TransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  account,
  defaultType = 'credit',
  onTransactionSuccess,
  showToast,
  lastUsedReference,
}) => {
  const [type, setType] = useState<'credit' | 'debit'>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setAmount('');
      setDescription('');
      setInlineError(null);
      generateNewReference();
    }
  }, [isOpen, defaultType]);

  const generateNewReference = () => {
    const randomHex = Math.random().toString(36).substring(2, 9).toUpperCase();
    setReferenceId(`REF-${type.toUpperCase()}-${randomHex}`);
  };

  if (!isOpen || !account) return null;

  const numAmount = parseFloat(amount) || 0;
  const simulatedNewBalance =
    type === 'credit'
      ? account.balance + numAmount
      : account.balance - numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    if (numAmount <= 0) {
      setInlineError('Amount must be greater than 0');
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    if (!referenceId.trim()) {
      setInlineError('Reference ID is required');
      showToast('Reference ID is required', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.addTransaction({
        account_id: account.id,
        type,
        amount: numAmount,
        description: description.trim() || undefined,
        reference_id: referenceId.trim(),
      });

      showToast(
        `Success! ${type.toUpperCase()} $${numAmount.toFixed(2)} processed. New balance: $${res.new_balance.toFixed(2)}`,
        'success'
      );
      onTransactionSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Transaction rejected';
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
          <h2 className="modal-title">New Transaction</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Type Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn ${type === 'credit' ? 'btn-success' : 'btn-secondary'}`}
            style={{ justifyContent: 'center' }}
            onClick={() => {
              setType('credit');
              setReferenceId(`REF-CREDIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
            }}
          >
            ↓ Credit / Deposit
          </button>
          <button
            type="button"
            className={`btn ${type === 'debit' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ justifyContent: 'center' }}
            onClick={() => {
              setType('debit');
              setReferenceId(`REF-DEBIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
            }}
          >
            ↑ Debit / Withdraw
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="tx-amount">Amount ($ USD) *</label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {/* Fast Presets */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
              {[25, 50, 100, 250, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => setAmount(preset.toString())}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="tx-ref">Reference ID * (Must be unique per account)</label>
              <button
                type="button"
                onClick={generateNewReference}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ↻ New Ref
              </button>
            </div>
            <input
              id="tx-ref"
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tx-desc">Description (Optional)</label>
            <input
              id="tx-desc"
              type="text"
              placeholder="e.g. Payment for invoice #42"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Balance Preview Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
          }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Current: </span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>${account.balance.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>After: </span>
              <strong
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: simulatedNewBalance < 0 ? 'var(--debit-color)' : 'var(--credit-color)',
                }}
              >
                ${numAmount > 0 ? simulatedNewBalance.toFixed(2) : account.balance.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Test Edge Cases Quick Buttons */}
          <div style={{
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px dashed rgba(244, 63, 94, 0.25)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}>
            <span style={{ fontSize: '0.72rem', color: '#fda4af', fontWeight: 600 }}>
              🧪 Interview Edge-Case Triggers:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                onClick={() => {
                  setType('debit');
                  setAmount((account.balance + 500).toFixed(2));
                }}
              >
                Trigger Insufficient Balance (422)
              </button>
              {lastUsedReference && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => {
                    setReferenceId(lastUsedReference);
                  }}
                >
                  Test Duplicate Ref (409)
                </button>
              )}
            </div>
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
            <button
              type="submit"
              className={`btn ${type === 'credit' ? 'btn-primary' : 'btn-danger'}`}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Submit ${type.toUpperCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
