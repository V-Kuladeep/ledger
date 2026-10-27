import React, { useState } from 'react';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (accountId: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const CreateAccountModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAccountCreated,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Account holder name is required', 'error');
      return;
    }

    try {
      setLoading(true);
      const newAcc = await api.createAccount(name.trim());
      showToast(`Account created for ${newAcc.name}! Initial balance: $0.00`, 'success');
      setName('');
      onAccountCreated(newAcc.id);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to create account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create New Account</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label htmlFor="account-name">Account Holder Name *</label>
            <input
              id="account-name"
              type="text"
              placeholder="e.g. Alice Walker, Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            padding: '0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#a5b4fc',
            lineHeight: 1.5,
          }}>
            ℹ️ <strong>System Rule:</strong> By ledger policy, initial balance is strictly set to <strong>$0.00</strong> by the backend system. Clients are not allowed to set initial balances.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
