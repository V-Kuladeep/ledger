import React, { useState, useEffect, useCallback } from 'react';
import { api, Account, Transaction } from './services/api';
import { CreateAccountModal } from './components/CreateAccountModal';
import { TransactionModal } from './components/TransactionModal';
import { TransferModal } from './components/TransferModal';
import { ApiDocsModal } from './components/ApiDocsModal';

export const App: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 10,
    total_records: 0,
    total_pages: 1,
  });
  const [filterType, setFilterType] = useState<'credit' | 'debit' | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<{
    checked: boolean;
    consistent?: boolean;
    stored?: number;
    calculated?: number;
  }>({ checked: false });

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalDefaultType, setTxModalDefaultType] = useState<'credit' | 'debit'>('credit');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Load all accounts
  const loadAccounts = useCallback(async (preferSelectedId?: string) => {
    try {
      setLoadingAccounts(true);
      const res = await api.getAccounts(1, 100);
      setAccounts(res.items);

      if (res.items.length > 0) {
        const idToSelect = preferSelectedId || selectedAccountId || res.items[0].id;
        const exists = res.items.find((a) => a.id === idToSelect);
        const targetId = exists ? exists.id : res.items[0].id;
        setSelectedAccountId(targetId);
      } else {
        setSelectedAccountId(null);
        setSelectedAccount(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load accounts', 'error');
    } finally {
      setLoadingAccounts(false);
    }
  }, [selectedAccountId]);

  // Load selected account balance and details
  const loadAccountDetails = useCallback(async (accountId: string) => {
    try {
      const acc = await api.getAccountById(accountId);
      setSelectedAccount(acc);
      setIntegrityStatus({ checked: false });
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch account', 'error');
    }
  }, []);

  // Load transactions for selected account
  const loadTransactions = useCallback(async (accountId: string, page = 1, type?: 'credit' | 'debit') => {
    try {
      setLoadingTx(true);
      const res = await api.getTransactions(accountId, { page, limit: 8, type });
      setTransactions(res.items);
      setPagination(res.pagination);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch transactions', 'error');
    } finally {
      setLoadingTx(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // When selected account or filter or page changes
  useEffect(() => {
    if (selectedAccountId) {
      loadAccountDetails(selectedAccountId);
      loadTransactions(selectedAccountId, currentPage, filterType);
    } else {
      setTransactions([]);
    }
  }, [selectedAccountId, currentPage, filterType, loadAccountDetails, loadTransactions]);

  const handleVerifyIntegrity = async () => {
    if (!selectedAccountId) return;
    try {
      const res = await api.verifyIntegrity(selectedAccountId);
      setIntegrityStatus({
        checked: true,
        consistent: res.consistent,
        stored: res.stored_balance,
        calculated: res.calculated_balance,
      });
      if (res.consistent) {
        showToast(
          `Audit Passed: Stored balance ($${res.stored_balance.toFixed(2)}) perfectly matches sum of immutable ledger transactions!`,
          'success'
        );
      } else {
        showToast('Ledger discrepancy detected!', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to verify integrity', 'error');
    }
  };

  const handleSeedData = async () => {
    try {
      const res = await api.seedData();
      showToast('Demo data seeded with 3 accounts and realistic transactions!', 'success');
      if (res.accounts_created && res.accounts_created.length > 0) {
        await loadAccounts(res.accounts_created[0].id);
      } else {
        await loadAccounts();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to seed data', 'error');
    }
  };

  const openTxModal = (type: 'credit' | 'debit') => {
    setTxModalDefaultType(type);
    setIsTxModalOpen(true);
  };

  const lastReference = transactions.length > 0 ? transactions[0].reference_id : undefined;

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-title">Confluencer Ledger</span>
              <span className="brand-badge">ACID Ledger v1.0</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Transaction Ledger & Real-Time Balance System
            </p>
          </div>
        </div>

        <div className="nav-actions">
          <button className="btn btn-secondary" onClick={() => setIsDocsModalOpen(true)}>
            📖 API Docs
          </button>
          <button className="btn btn-secondary" onClick={handleSeedData}>
            ✨ Seed Demo Data
          </button>
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            + New Account
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="workspace">
        {/* Left Column: Account Directory */}
        <aside className="sidebar">
          <div className="panel-header">
            <span className="panel-title">Accounts ({accounts.length})</span>
            <button
              onClick={() => loadAccounts()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="account-cards">
            {loadingAccounts && accounts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
                Loading ledger accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}>
                No accounts yet.<br />
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create Account
                </button>
              </div>
            ) : (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`account-card ${selectedAccountId === acc.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setCurrentPage(1);
                  }}
                >
                  <div className="account-card-header">
                    <span className="account-name">{acc.name}</span>
                    <span className="account-balance-preview">${acc.balance.toFixed(2)}</span>
                  </div>
                  <div className="account-id" title={acc.id}>
                    ID: {acc.id.substring(0, 8)}...{acc.id.substring(acc.id.length - 4)}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right Column: Account Workspace & Transaction History */}
        <section className="main-content">
          {selectedAccount ? (
            <>
              {/* Hero Account & Balance Card */}
              <div className="hero-card">
                <div className="hero-top">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedAccount.name}</h1>
                      <span className="account-id" style={{ background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        {selectedAccount.id}
                      </span>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                      <span className="hero-balance-label">Current Ledger Balance</span>
                      <div className="hero-balance-val">
                        ${selectedAccount.balance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Integrity Audit Tool */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={handleVerifyIntegrity}
                      style={{ fontSize: '0.8rem' }}
                    >
                      🛡️ Audit Balance Consistency
                    </button>
                    {integrityStatus.checked && (
                      <div className="integrity-badge">
                        ✓ Verified: Ledger Σ = ${integrityStatus.calculated?.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="hero-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => openTxModal('credit')}
                  >
                    ↓ Credit / Deposit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => openTxModal('debit')}
                  >
                    ↑ Debit / Withdraw
                  </button>
                  {accounts.length > 1 && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsTransferModalOpen(true)}
                    >
                      ⇄ Transfer Money (Bonus)
                    </button>
                  )}
                </div>
              </div>

              {/* Transaction Ledger Table Card */}
              <div className="history-card">
                <div className="filter-bar">
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Transaction History</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Immutable ledger entries sorted in latest-first order
                    </p>
                  </div>

                  <div className="filter-tabs">
                    <button
                      className={`filter-tab ${filterType === undefined ? 'active' : ''}`}
                      onClick={() => {
                        setFilterType(undefined);
                        setCurrentPage(1);
                      }}
                    >
                      All Transactions
                    </button>
                    <button
                      className={`filter-tab ${filterType === 'credit' ? 'active' : ''}`}
                      onClick={() => {
                        setFilterType('credit');
                        setCurrentPage(1);
                      }}
                    >
                      Credits
                    </button>
                    <button
                      className={`filter-tab ${filterType === 'debit' ? 'active' : ''}`}
                      onClick={() => {
                        setFilterType('debit');
                        setCurrentPage(1);
                      }}
                    >
                      Debits
                    </button>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Reference ID</th>
                        <th>Description</th>
                        <th>Timestamp (Latest First)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTx ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            Loading transactions...
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            No transactions recorded for this account yet.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <span className={`type-chip ${tx.type}`}>
                                {tx.type === 'credit' ? '↓ Credit' : '↑ Debit'}
                              </span>
                            </td>
                            <td>
                              <span className={`amount-text ${tx.type}`}>
                                {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                              </span>
                            </td>
                            <td>
                              <span className="ref-badge">{tx.reference_id}</span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {tx.description || '—'}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                              {new Date(tx.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination.total_pages > 1 && (
                  <div className="pagination">
                    <span>
                      Showing {transactions.length} of {pagination.total_records} records (Page {pagination.current_page} of {pagination.total_pages})
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={currentPage >= pagination.total_pages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '4rem 2rem',
              textAlign: 'center',
            }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Account Selected</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Create a new account or seed demo data to inspect transactions and balances.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                  + Create Account
                </button>
                <button className="btn btn-secondary" onClick={handleSeedData}>
                  ✨ Seed Demo Data
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAccountCreated={(id) => loadAccounts(id)}
        showToast={showToast}
      />

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        account={selectedAccount}
        defaultType={txModalDefaultType}
        lastUsedReference={lastReference}
        onTransactionSuccess={() => {
          if (selectedAccountId) {
            loadAccountDetails(selectedAccountId);
            loadTransactions(selectedAccountId, 1, filterType);
            loadAccounts(selectedAccountId);
          }
        }}
        showToast={showToast}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        currentAccountId={selectedAccountId}
        onTransferSuccess={() => {
          if (selectedAccountId) {
            loadAccountDetails(selectedAccountId);
            loadTransactions(selectedAccountId, 1, filterType);
            loadAccounts(selectedAccountId);
          }
        }}
        showToast={showToast}
      />

      <ApiDocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
