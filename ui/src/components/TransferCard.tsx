import React, { useState, useEffect, useRef } from 'react';
import { TransferClient, ConditionalTransfer, SpendingRule, NetworkConfig } from '../../sdk/src/types';

interface TransferCardProps {
  transferClient: TransferClient;
  config: NetworkConfig;
  creatorKey: string;
}

export const TransferCard: React.FC<TransferCardProps> = ({ transferClient, config, creatorKey }) => {
  const [transfers, setTransfers] = useState<ConditionalTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<ConditionalTransfer | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const openModalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [createForm, setCreateForm] = useState({
    transferId: '', beneficiaryId: '', amount: '', token: 'XLM', expiresAt: '', purpose: '',
    rules: [
      { type: 'category_limit', category: 'food', limit: '500', startTime: '', endTime: '', location: '' },
      { type: 'category_limit', category: 'medical', limit: '300', startTime: '', endTime: '', location: '' },
      { type: 'time_window', category: '', limit: '', startTime: '', endTime: '', location: '' },
      { type: 'location_based', category: '', limit: '', startTime: '', endTime: '', location: '' }
    ]
  });

  const [spendForm, setSpendForm] = useState({
    transferId: '', beneficiaryKey: '', merchantId: '', amount: '', category: 'food', location: ''
  });

  useEffect(() => { loadTransfers(); }, []);

  useEffect(() => {
    if (!selectedTransfer) return;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeModal(); }
      else if (e.key === 'Tab') {
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransfer]);

  const closeModal = () => {
    setSelectedTransfer(null);
    openModalTriggerRef.current?.focus();
  };

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const list = await transferClient.listBeneficiaryTransfers('sample_beneficiary_001');
      setTransfers(list);
    } catch (error) {
      console.error('Failed to load transfers:', error);
      setErrorMessage('Failed to load transfers.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      const spendingRules: SpendingRule[] = [];
      createForm.rules.forEach(rule => {
        if (rule.type === 'category_limit' && rule.category && rule.limit)
          spendingRules.push(transferClient.createCategoryLimitRule(rule.category, rule.limit));
        else if (rule.type === 'time_window' && rule.startTime && rule.endTime)
          spendingRules.push(transferClient.createTimeWindowRule(new Date(rule.startTime).getTime(), new Date(rule.endTime).getTime()));
        else if (rule.type === 'location_based' && rule.location)
          spendingRules.push(transferClient.createLocationRule(rule.location));
      });
      await transferClient.createTransfer(
        creatorKey, createForm.transferId, createForm.beneficiaryId, createForm.amount,
        createForm.token, new Date(createForm.expiresAt).getTime(), spendingRules, createForm.purpose
      );
      setShowCreateForm(false);
      setCreateForm({ transferId: '', beneficiaryId: '', amount: '', token: 'XLM', expiresAt: '', purpose: '',
        rules: [
          { type: 'category_limit', category: 'food', limit: '500', startTime: '', endTime: '', location: '' },
          { type: 'category_limit', category: 'medical', limit: '300', startTime: '', endTime: '', location: '' },
          { type: 'time_window', category: '', limit: '', startTime: '', endTime: '', location: '' },
          { type: 'location_based', category: '', limit: '', startTime: '', endTime: '', location: '' }
        ]
      });
      setStatusMessage('Conditional transfer created successfully.');
      loadTransfers();
    } catch (error) {
      console.error('Failed to create transfer:', error);
      setErrorMessage('Failed to create transfer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      const success = await transferClient.spend(
        spendForm.beneficiaryKey, spendForm.transferId, spendForm.merchantId,
        spendForm.amount, spendForm.category, spendForm.location
      );
      if (success) {
        setStatusMessage('Payment processed successfully.');
        setShowSpendForm(false);
        setSpendForm({ transferId: '', beneficiaryKey: '', merchantId: '', amount: '', category: 'food', location: '' });
        loadTransfers();
      } else {
        setErrorMessage('Payment rejected by spending rules.');
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      setErrorMessage('Failed to process payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecallFunds = async (transferId: string) => {
    try {
      setLoading(true);
      const result = await transferClient.recallFunds(creatorKey, transferId);
      setStatusMessage(result);
      loadTransfers();
    } catch (error) {
      console.error('Failed to recall funds:', error);
      setErrorMessage('Failed to recall funds.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendExpiry = async (transferId: string, newExpiry: string) => {
    try {
      setLoading(true);
      await transferClient.extendExpiry(creatorKey, transferId, new Date(newExpiry).getTime());
      setStatusMessage('Transfer expiry extended successfully.');
      loadTransfers();
    } catch (error) {
      console.error('Failed to extend expiry:', error);
      setErrorMessage('Failed to extend expiry.');
    } finally {
      setLoading(false);
    }
  };

  const getTransferStatus = (transfer: ConditionalTransfer): { label: string; className: string } => {
    const now = Date.now();
    if (!transfer.isActive) return { label: 'Inactive', className: 'text-gray-600' };
    if (now > transfer.expiresAt) return { label: 'Expired', className: 'text-red-600' };
    if (now > transfer.expiresAt - 7 * 24 * 60 * 60 * 1000) return { label: 'Expiring Soon', className: 'text-yellow-600' };
    return { label: 'Active', className: 'text-green-600' };
  };

  const getUtilizationRate = (transfer: ConditionalTransfer) => {
    const spent = BigInt(transfer.spentAmount);
    const total = BigInt(transfer.amount);
    return Number((spent * BigInt(100)) / total);
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-4 py-2 z-50">
        Skip to main content
      </a>

      {/* Live regions for screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusMessage}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{errorMessage}</div>

      <main id="main-content">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditional Transfer Cards</h1>
          <p className="text-gray-600 mb-6">Manage conditional cash transfers with spending rules</p>

          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800">{errorMessage}</div>
          )}
          {statusMessage && (
            <div role="status" className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-800">{statusMessage}</div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              ref={openModalTriggerRef}
              onClick={() => setShowCreateForm(v => !v)}
              aria-expanded={showCreateForm}
              aria-controls="create-transfer-form"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showCreateForm ? 'Hide Create Form' : 'Create Transfer'}
            </button>
            <button
              onClick={() => setShowSpendForm(v => !v)}
              aria-expanded={showSpendForm}
              aria-controls="spend-form"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {showSpendForm ? 'Hide Spend Form' : 'Process Payment'}
            </button>
            <button
              onClick={loadTransfers}
              disabled={loading}
              aria-disabled={loading}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {/* Create Transfer Form */}
          <section
            id="create-transfer-form"
            aria-label="Create Conditional Transfer"
            hidden={!showCreateForm}
            className="bg-blue-50 p-6 rounded-lg mb-6"
          >
            <h2 className="text-xl font-semibold mb-4">Create Conditional Transfer</h2>
            <form onSubmit={handleCreateTransfer} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ct-transfer-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Transfer ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ct-transfer-id"
                    type="text"
                    value={createForm.transferId}
                    onChange={e => setCreateForm({ ...createForm, transferId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="ct-beneficiary-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Beneficiary ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ct-beneficiary-id"
                    type="text"
                    value={createForm.beneficiaryId}
                    onChange={e => setCreateForm({ ...createForm, beneficiaryId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ct-amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ct-amount"
                    type="number"
                    value={createForm.amount}
                    onChange={e => setCreateForm({ ...createForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" min="0"
                  />
                </div>
                <div>
                  <label htmlFor="ct-token" className="block text-sm font-medium text-gray-700 mb-1">
                    Token <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ct-token"
                    value={createForm.token}
                    onChange={e => setCreateForm({ ...createForm, token: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true"
                  >
                    <option value="XLM">XLM</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ct-expires" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date &amp; Time <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ct-expires"
                    type="datetime-local"
                    value={createForm.expiresAt}
                    onChange={e => setCreateForm({ ...createForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="ct-purpose" className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ct-purpose"
                    type="text"
                    value={createForm.purpose}
                    onChange={e => setCreateForm({ ...createForm, purpose: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true"
                  />
                </div>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-2">Spending Rules</legend>
                <ul className="space-y-3">
                  {createForm.rules.map((rule, index) => (
                    <li key={index} className="bg-white p-3 rounded border">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label htmlFor={`rule-type-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Rule Type</label>
                          <select
                            id={`rule-type-${index}`}
                            value={rule.type}
                            onChange={e => {
                              const rules = [...createForm.rules];
                              rules[index] = { ...rules[index], type: e.target.value };
                              setCreateForm({ ...createForm, rules });
                            }}
                            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="category_limit">Category Limit</option>
                            <option value="time_window">Time Window</option>
                            <option value="location_based">Location Based</option>
                          </select>
                        </div>
                        {rule.type === 'category_limit' && (
                          <>
                            <div>
                              <label htmlFor={`rule-category-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                              <input
                                id={`rule-category-${index}`}
                                type="text"
                                value={rule.category}
                                onChange={e => {
                                  const rules = [...createForm.rules];
                                  rules[index] = { ...rules[index], category: e.target.value };
                                  setCreateForm({ ...createForm, rules });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label htmlFor={`rule-limit-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
                              <input
                                id={`rule-limit-${index}`}
                                type="number"
                                value={rule.limit}
                                onChange={e => {
                                  const rules = [...createForm.rules];
                                  rules[index] = { ...rules[index], limit: e.target.value };
                                  setCreateForm({ ...createForm, rules });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                              />
                            </div>
                          </>
                        )}
                        {rule.type === 'time_window' && (
                          <>
                            <div>
                              <label htmlFor={`rule-start-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                              <input
                                id={`rule-start-${index}`}
                                type="datetime-local"
                                value={rule.startTime}
                                onChange={e => {
                                  const rules = [...createForm.rules];
                                  rules[index] = { ...rules[index], startTime: e.target.value };
                                  setCreateForm({ ...createForm, rules });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label htmlFor={`rule-end-${index}`} className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                              <input
                                id={`rule-end-${index}`}
                                type="datetime-local"
                                value={rule.endTime}
                                onChange={e => {
                                  const rules = [...createForm.rules];
                                  rules[index] = { ...rules[index], endTime: e.target.value };
                                  setCreateForm({ ...createForm, rules });
                                }}
                                className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </>
                        )}
                        {rule.type === 'location_based' && (
                          <div className="col-span-2">
                            <label htmlFor={`rule-location-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                            <input
                              id={`rule-location-${index}`}
                              type="text"
                              value={rule.location}
                              onChange={e => {
                                const rules = [...createForm.rules];
                                rules[index] = { ...rules[index], location: e.target.value };
                                setCreateForm({ ...createForm, rules });
                              }}
                              className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  aria-disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create Transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* Spend Form */}
          <section
            id="spend-form"
            aria-label="Process Payment"
            hidden={!showSpendForm}
            className="bg-green-50 p-6 rounded-lg mb-6"
          >
            <h2 className="text-xl font-semibold mb-4">Process Payment</h2>
            <form onSubmit={handleSpend} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="spend-transfer-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Transfer ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="spend-transfer-id"
                    type="text"
                    value={spendForm.transferId}
                    onChange={e => setSpendForm({ ...spendForm, transferId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="spend-beneficiary-key" className="block text-sm font-medium text-gray-700 mb-1">
                    Beneficiary Key <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="spend-beneficiary-key"
                    type="password"
                    value={spendForm.beneficiaryKey}
                    onChange={e => setSpendForm({ ...spendForm, beneficiaryKey: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required aria-required="true"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="spend-merchant-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Merchant ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="spend-merchant-id"
                    type="text"
                    value={spendForm.merchantId}
                    onChange={e => setSpendForm({ ...spendForm, merchantId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="spend-amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="spend-amount"
                    type="number"
                    value={spendForm.amount}
                    onChange={e => setSpendForm({ ...spendForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required aria-required="true" min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="spend-category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="spend-category"
                    value={spendForm.category}
                    onChange={e => setSpendForm({ ...spendForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required aria-required="true"
                  >
                    <option value="food">Food</option>
                    <option value="medical">Medical</option>
                    <option value="shelter">Shelter</option>
                    <option value="transport">Transport</option>
                    <option value="water">Water</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="spend-location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    id="spend-location"
                    type="text"
                    value={spendForm.location}
                    onChange={e => setSpendForm({ ...spendForm, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  aria-disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Processing…' : 'Process Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSpendForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* Transfers List */}
          <section aria-label="Conditional Transfers">
            <h2 className="text-xl font-semibold mb-4">Conditional Transfers</h2>

            {loading && (
              <div role="status" aria-live="polite" className="text-center py-4">
                <span className="sr-only">Loading transfers, please wait.</span>
                <span aria-hidden="true">Loading…</span>
              </div>
            )}

            {!loading && transfers.length === 0 && (
              <p className="text-gray-500 text-center py-4">No transfers found.</p>
            )}

            {!loading && transfers.length > 0 && (
              <ul className="grid gap-4" aria-label="Transfers list">
                {transfers.map(transfer => {
                  const status = getTransferStatus(transfer);
                  const utilizationRate = getUtilizationRate(transfer);
                  const detailsRef = React.createRef<HTMLButtonElement>();
                  return (
                    <li key={transfer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{transfer.id}</h3>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">Beneficiary: </dt><dd className="inline">{transfer.beneficiaryId}</dd></div>
                            <div><dt className="inline font-bold">Purpose: </dt><dd className="inline">{transfer.purpose}</dd></div>
                            <div><dt className="inline font-bold">Expires: </dt><dd className="inline">{formatDate(transfer.expiresAt)}</dd></div>
                          </dl>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${status.className}`} aria-label={`Status: ${status.label}`}>
                            {status.label}
                          </p>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">Amount: </dt><dd className="inline">{transfer.amount} {transfer.token}</dd></div>
                            <div><dt className="inline font-bold">Spent: </dt><dd className="inline">{transfer.spentAmount} {transfer.token}</dd></div>
                            <div>
                              <dt className="inline font-bold">Utilization: </dt>
                              <dd className="inline">
                                <span aria-label={`${utilizationRate}% utilized`}>{utilizationRate}%</span>
                              </dd>
                            </div>
                          </dl>
                          <div
                            className="mt-2 w-full bg-gray-200 rounded-full h-2"
                            role="progressbar"
                            aria-valuenow={utilizationRate}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Transfer utilization: ${utilizationRate}%`}
                          >
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${utilizationRate}%` }}
                            />
                          </div>
                          <div className="mt-4 flex gap-2 justify-end">
                            <button
                              ref={detailsRef}
                              onClick={() => {
                                openModalTriggerRef.current = detailsRef.current;
                                setSelectedTransfer(transfer);
                              }}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              aria-label={`View details for transfer ${transfer.id}`}
                            >
                              Details
                            </button>
                            <button
                              onClick={() => handleRecallFunds(transfer.id)}
                              disabled={loading}
                              aria-disabled={loading}
                              className="bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50"
                              aria-label={`Recall funds for transfer ${transfer.id}`}
                            >
                              Recall
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-modal-title"
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto"
          >
            <h2 id="transfer-modal-title" className="text-2xl font-bold mb-4">Transfer: {selectedTransfer.id}</h2>

            <div className="space-y-4">
              <section aria-label="Transfer Details">
                <h3 className="font-semibold">Transfer Details</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">ID:</dt><dd>{selectedTransfer.id}</dd></div>
                  <div><dt className="font-bold">Status:</dt><dd>{getTransferStatus(selectedTransfer).label}</dd></div>
                  <div><dt className="font-bold">Amount:</dt><dd>{selectedTransfer.amount} {selectedTransfer.token}</dd></div>
                  <div><dt className="font-bold">Spent:</dt><dd>{selectedTransfer.spentAmount} {selectedTransfer.token}</dd></div>
                  <div><dt className="font-bold">Beneficiary:</dt><dd>{selectedTransfer.beneficiaryId}</dd></div>
                  <div><dt className="font-bold">Expires:</dt><dd>{formatDate(selectedTransfer.expiresAt)}</dd></div>
                </dl>
              </section>

              <section aria-label="Purpose">
                <h3 className="font-semibold">Purpose</h3>
                <p className="text-gray-600 mt-1">{selectedTransfer.purpose}</p>
              </section>

              <section aria-label="Spending Rules">
                <h3 className="font-semibold mb-2">Spending Rules</h3>
                {selectedTransfer.spendingRules.length === 0 ? (
                  <p className="text-gray-500 text-sm">No spending rules defined.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedTransfer.spendingRules.map((rule, index) => (
                      <li key={index} className="bg-gray-50 p-2 rounded text-sm">
                        <dl className="space-y-1">
                          <div><dt className="inline font-bold">Type: </dt><dd className="inline">{rule.ruleType}</dd></div>
                          {rule.category && <div><dt className="inline font-bold">Category: </dt><dd className="inline">{rule.category}</dd></div>}
                          {rule.maxAmount && <div><dt className="inline font-bold">Max Amount: </dt><dd className="inline">{rule.maxAmount}</dd></div>}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Extend Expiry">
                <h3 className="font-semibold mb-2">Extend Expiry</h3>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem('new-expiry') as HTMLInputElement).value;
                    if (input) handleExtendExpiry(selectedTransfer.id, input);
                  }}
                  className="flex gap-2"
                >
                  <div className="flex-1">
                    <label htmlFor="new-expiry" className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date &amp; Time</label>
                    <input
                      id="new-expiry"
                      name="new-expiry"
                      type="datetime-local"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={loading}
                      aria-disabled={loading}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Extend
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeModal}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
