import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/accounts',
      title: '1. Create Account',
      desc: 'Creates a new account. Initial balance is strictly 0.00 and cannot be set by client.',
      body: '{\n  "name": "Alice Walker"\n}',
      response: '{\n  "success": true,\n  "data": {\n    "id": "c85d562f-...",\n    "name": "Alice Walker",\n    "balance": 0.00,\n    "created_at": "..."\n  }\n}',
    },
    {
      method: 'POST',
      path: '/api/v1/accounts/:id/transactions',
      title: '2. Add Transaction',
      desc: 'Adds a credit or debit transaction. Debit is rejected if insufficient funds. Duplicate reference_id for same account returns 409.',
      body: '{\n  "type": "credit", // or "debit"\n  "amount": 100.50,\n  "reference_id": "REF-001",\n  "description": "Deposit"\n}',
      response: '{\n  "success": true,\n  "data": {\n    "transaction": { ... },\n    "new_balance": 100.50\n  }\n}',
    },
    {
      method: 'GET',
      path: '/api/v1/accounts/:id/balance',
      title: '3. Get Account Balance',
      desc: 'Fetches the current real-time balance of the account. Returns 404 if not found.',
      body: null,
      response: '{\n  "success": true,\n  "data": {\n    "account_id": "c85d562f-...",\n    "balance": 100.50,\n    "name": "Alice Walker"\n  }\n}',
    },
    {
      method: 'GET',
      path: '/api/v1/accounts/:id/transactions?page=1&limit=10&type=credit',
      title: '4. Get Transaction History',
      desc: 'Fetches paginated transactions sorted in latest-first order (created_at DESC). Supports filtering by type.',
      body: null,
      response: '{\n  "success": true,\n  "data": {\n    "items": [ ... ],\n    "pagination": {\n      "current_page": 1,\n      "page_size": 10,\n      "total_records": 1,\n      "total_pages": 1\n    }\n  }\n}',
    },
    {
      method: 'GET',
      path: '/api/v1/accounts/:id/verify-integrity',
      title: '5. Verify Balance Integrity',
      desc: 'Audit endpoint: Computes sum(credits) - sum(debits) across all immutable ledger entries and verifies that it exactly equals stored balance.',
      body: null,
      response: '{\n  "success": true,\n  "data": {\n    "account_id": "...",\n    "stored_balance": 100.50,\n    "calculated_balance": 100.50,\n    "consistent": true\n  }\n}',
    },
    {
      method: 'POST',
      path: '/api/v1/transfers',
      title: '6. Atomic Money Transfer (Bonus)',
      desc: 'Transfers money from Account A to Account B atomically. Complete rollback on failure. Partial transfer impossible.',
      body: '{\n  "source_account_id": "acc-a-id",\n  "destination_account_id": "acc-b-id",\n  "amount": 50.00,\n  "reference_id": "TRF-999"\n}',
      response: '{\n  "success": true,\n  "data": {\n    "source_new_balance": 50.50,\n    "destination_new_balance": 50.00\n  }\n}',
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">API Reference & Documentation</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Fully RESTful, validated, and ACID transaction compliant ledger APIs
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {endpoints.map((ep, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: ep.method === 'POST' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: ep.method === 'POST' ? '#818cf8' : '#34d399',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {ep.method}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#f1f5f9' }}>
                  {ep.path}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  — {ep.title}
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {ep.desc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: ep.body ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                {ep.body && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Request Payload
                    </span>
                    <pre
                      style={{
                        background: '#040711',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#93c5fd',
                        overflowX: 'auto',
                      }}
                    >
                      {ep.body}
                    </pre>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Success Response
                  </span>
                  <pre
                    style={{
                      background: '#040711',
                      padding: '0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: '#86efac',
                      overflowX: 'auto',
                    }}
                  >
                    {ep.response}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
