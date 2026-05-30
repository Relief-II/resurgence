import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AidClient, EmergencyFund, NetworkConfig } from '../../sdk/src/types';

interface EmergencyDeployerProps {
  aidClient: AidClient;
  config: NetworkConfig;
  adminKey: string;
}

export const EmergencyDeployer: React.FC<EmergencyDeployerProps> = ({
  aidClient,
  config,
  adminKey
}) => {
  const [funds, setFunds] = useState<EmergencyFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRapidForm, setShowRapidForm] = useState(false);
  const [selectedFund, setSelectedFund] = useState<EmergencyFund | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const openModalTriggerRef = useRef<HTMLButtonElement>(null);

  const [fundForm, setFundForm] = useState({
    fundId: '',
    name: '',
    description: '',
    totalAmount: '',
    disasterType: '',
    geographicScope: '',
    expiresAt: '',
    requiredSignatures: '1'
  });

  const [rapidForm, setRapidForm] = useState({
    disasterId: '',
    disasterType: '',
    affectedArea: '',
    totalBudget: '',
    categories: [
      { name: 'Food', percentage: 40, description: 'Emergency food supplies' },
      { name: 'Medical', percentage: 30, description: 'Medical supplies and care' },
      { name: 'Shelter', percentage: 20, description: 'Emergency shelter materials' },
      { name: 'Water', percentage: 10, description: 'Clean water and sanitation' }
    ]
  });

  useEffect(() => {
    loadActiveFunds();
  }, []);

  // Focus trap for modal
  useEffect(() => {
    if (!selectedFund) return;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFund]);

  const closeModal = () => {
    setSelectedFund(null);
    openModalTriggerRef.current?.focus();
  };

  const loadActiveFunds = async () => {
    try {
      setLoading(true);
      const activeFunds = await aidClient.listActiveFunds();
      setFunds(activeFunds);
    } catch (error) {
      console.error('Failed to load funds:', error);
      setErrorMessage('Failed to load active funds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      await aidClient.deployEmergencyFund(
        adminKey,
        fundForm.fundId,
        fundForm.name,
        fundForm.description,
        fundForm.totalAmount,
        fundForm.disasterType,
        fundForm.geographicScope,
        new Date(fundForm.expiresAt).getTime(),
        [adminKey],
        parseInt(fundForm.requiredSignatures)
      );
      setShowCreateForm(false);
      setFundForm({ fundId: '', name: '', description: '', totalAmount: '', disasterType: '', geographicScope: '', expiresAt: '', requiredSignatures: '1' });
      setStatusMessage('Emergency fund created successfully.');
      loadActiveFunds();
    } catch (error) {
      console.error('Failed to create fund:', error);
      setErrorMessage('Failed to create emergency fund. Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRapidDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      const fundIds = await aidClient.deployRapidResponse(
        adminKey,
        rapidForm.disasterId,
        rapidForm.disasterType,
        rapidForm.affectedArea,
        rapidForm.totalBudget,
        rapidForm.categories
      );
      setShowRapidForm(false);
      setRapidForm({ disasterId: '', disasterType: '', affectedArea: '', totalBudget: '', categories: rapidForm.categories });
      setStatusMessage(`Created ${fundIds.length} emergency funds for rapid response.`);
      loadActiveFunds();
    } catch (error) {
      console.error('Failed to deploy rapid response:', error);
      setErrorMessage('Failed to deploy rapid response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMonitorFund = async (fundId: string, triggerRef: React.RefObject<HTMLButtonElement>) => {
    try {
      const fund = await aidClient.getFund(fundId);
      if (fund) {
        openModalTriggerRef.current = triggerRef.current;
        setSelectedFund(fund);
      }
    } catch (error) {
      console.error('Failed to monitor fund:', error);
      setErrorMessage('Failed to load fund details.');
    }
  };

  const handleCleanupExpired = async () => {
    setErrorMessage('');
    try {
      setLoading(true);
      await aidClient.cleanupExpiredFunds(adminKey);
      setStatusMessage('Expired funds cleaned up successfully.');
      loadActiveFunds();
    } catch (error) {
      console.error('Failed to cleanup expired funds:', error);
      setErrorMessage('Failed to cleanup expired funds.');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string) => new Intl.NumberFormat().format(parseInt(amount) || 0);
  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString();

  const getFundStatus = (fund: EmergencyFund): { label: string; className: string } => {
    const now = Date.now();
    if (now > fund.expiresAt) return { label: 'Expired', className: 'text-red-600' };
    if (now > fund.expiresAt - 7 * 24 * 60 * 60 * 1000) return { label: 'Expiring Soon', className: 'text-yellow-600' };
    return { label: 'Active', className: 'text-green-600' };
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-4 py-2 z-50">
        Skip to main content
      </a>

      {/* Live region for status announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {errorMessage}
      </div>

      <main id="main-content">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Fund Deployer</h1>
          <p className="text-gray-600 mb-6">Rapid deployment and monitoring of emergency relief funds</p>

          {/* Visible error/status banners */}
          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800">
              {errorMessage}
            </div>
          )}
          {statusMessage && (
            <div role="status" className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-800">
              {statusMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowCreateForm(v => !v)}
              aria-expanded={showCreateForm}
              aria-controls="create-fund-form"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showCreateForm ? 'Hide Create Form' : 'Create Emergency Fund'}
            </button>
            <button
              onClick={() => setShowRapidForm(v => !v)}
              aria-expanded={showRapidForm}
              aria-controls="rapid-response-form"
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {showRapidForm ? 'Hide Rapid Form' : 'Rapid Disaster Response'}
            </button>
            <button
              onClick={handleCleanupExpired}
              disabled={loading}
              aria-disabled={loading}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cleanup Expired
            </button>
          </div>

          {/* Create Fund Form */}
          <section
            id="create-fund-form"
            aria-label="Create Emergency Fund"
            hidden={!showCreateForm}
            className="bg-gray-50 p-6 rounded-lg mb-6"
          >
            <h2 className="text-xl font-semibold mb-4">Create Emergency Fund</h2>
            <form onSubmit={handleCreateFund} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fund-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Fund ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fund-id"
                    type="text"
                    value={fundForm.fundId}
                    onChange={e => setFundForm({ ...fundForm, fundId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="fund-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Fund Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fund-name"
                    type="text"
                    value={fundForm.name}
                    onChange={e => setFundForm({ ...fundForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="fund-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="fund-description"
                  value={fundForm.description}
                  onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                  aria-required="true"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fund-amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fund-amount"
                    type="number"
                    value={fundForm.totalAmount}
                    onChange={e => setFundForm({ ...fundForm, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="fund-disaster-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Disaster Type <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="fund-disaster-type"
                    value={fundForm.disasterType}
                    onChange={e => setFundForm({ ...fundForm, disasterType: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                  >
                    <option value="">Select Disaster Type</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="hurricane">Hurricane</option>
                    <option value="wildfire">Wildfire</option>
                    <option value="drought">Drought</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fund-scope" className="block text-sm font-medium text-gray-700 mb-1">
                    Geographic Scope <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fund-scope"
                    type="text"
                    value={fundForm.geographicScope}
                    onChange={e => setFundForm({ ...fundForm, geographicScope: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="fund-expires" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date &amp; Time <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="fund-expires"
                    type="datetime-local"
                    value={fundForm.expiresAt}
                    onChange={e => setFundForm({ ...fundForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    aria-required="true"
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
                  {loading ? 'Creating…' : 'Create Fund'}
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

          {/* Rapid Response Form */}
          <section
            id="rapid-response-form"
            aria-label="Rapid Disaster Response"
            hidden={!showRapidForm}
            className="bg-red-50 p-6 rounded-lg mb-6"
          >
            <h2 className="text-xl font-semibold mb-4">Rapid Disaster Response</h2>
            <form onSubmit={handleRapidDeployment} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rapid-disaster-id" className="block text-sm font-medium text-gray-700 mb-1">
                    Disaster ID <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rapid-disaster-id"
                    type="text"
                    value={rapidForm.disasterId}
                    onChange={e => setRapidForm({ ...rapidForm, disasterId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="rapid-disaster-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Disaster Type <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="rapid-disaster-type"
                    value={rapidForm.disasterType}
                    onChange={e => setRapidForm({ ...rapidForm, disasterType: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                    aria-required="true"
                  >
                    <option value="">Select Disaster Type</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="hurricane">Hurricane</option>
                    <option value="wildfire">Wildfire</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rapid-area" className="block text-sm font-medium text-gray-700 mb-1">
                    Affected Area <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rapid-area"
                    type="text"
                    value={rapidForm.affectedArea}
                    onChange={e => setRapidForm({ ...rapidForm, affectedArea: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="rapid-budget" className="block text-sm font-medium text-gray-700 mb-1">
                    Total Budget <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rapid-budget"
                    type="number"
                    value={rapidForm.totalBudget}
                    onChange={e => setRapidForm({ ...rapidForm, totalBudget: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                    aria-required="true"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2" id="rapid-categories-label">Fund Categories</h3>
                <ul aria-labelledby="rapid-categories-label" className="space-y-2">
                  {rapidForm.categories.map((category, index) => (
                    <li key={index} className="flex items-center gap-4 text-sm">
                      <span className="w-24 font-medium">{category.name}</span>
                      <span className="w-16">{category.percentage}%</span>
                      <span className="text-gray-600">{category.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  aria-disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Deploying…' : 'Deploy Rapid Response'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRapidForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* Active Funds List */}
          <section aria-label="Active Emergency Funds">
            <h2 className="text-xl font-semibold mb-4">Active Emergency Funds</h2>

            {loading && (
              <div role="status" aria-live="polite" className="text-center py-4">
                <span aria-hidden="true">Loading…</span>
                <span className="sr-only">Loading active funds, please wait.</span>
              </div>
            )}

            {!loading && funds.length === 0 && (
              <p className="text-gray-500 text-center py-4">No active funds found.</p>
            )}

            {!loading && funds.length > 0 && (
              <ul className="grid gap-4" aria-label="Emergency funds list">
                {funds.map(fund => {
                  const status = getFundStatus(fund);
                  const monitorRef = useRef<HTMLButtonElement>(null);
                  return (
                    <li key={fund.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{fund.name}</h3>
                          <p className="text-gray-600">{fund.description}</p>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">ID: </dt><dd className="inline">{fund.id}</dd></div>
                            <div><dt className="inline font-bold">Disaster: </dt><dd className="inline">{fund.disasterType}</dd></div>
                            <div><dt className="inline font-bold">Area: </dt><dd className="inline">{fund.geographicScope}</dd></div>
                            <div><dt className="inline font-bold">Created: </dt><dd className="inline">{formatDate(fund.createdAt)}</dd></div>
                            <div><dt className="inline font-bold">Expires: </dt><dd className="inline">{formatDate(fund.expiresAt)}</dd></div>
                          </dl>
                        </div>

                        <div className="text-right">
                          <p className={`font-semibold ${status.className}`} aria-label={`Status: ${status.label}`}>
                            {status.label}
                            {!fund.isActive && <span className="sr-only"> (inactive)</span>}
                          </p>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">Total: </dt><dd className="inline">{formatAmount(fund.totalAmount)}</dd></div>
                            <div><dt className="inline font-bold">Released: </dt><dd className="inline">{formatAmount(fund.releasedAmount)}</dd></div>
                            <div>
                              <dt className="inline font-bold">Remaining: </dt>
                              <dd className="inline">{formatAmount((parseInt(fund.totalAmount) - parseInt(fund.releasedAmount)).toString())}</dd>
                            </div>
                          </dl>

                          <div className="mt-4 flex gap-2 justify-end">
                            <button
                              ref={monitorRef}
                              onClick={() => handleMonitorFund(fund.id, monitorRef)}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              aria-label={`Monitor fund: ${fund.name}`}
                            >
                              Monitor
                            </button>
                            <button
                              onClick={() => aidClient.generateFundQRCode(fund.id, fund)}
                              className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
                              aria-label={`Generate QR code for fund: ${fund.name}`}
                            >
                              QR Code
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

      {/* Fund Details Modal */}
      {selectedFund && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto"
          >
            <h2 id="modal-title" className="text-2xl font-bold mb-4">{selectedFund.name}</h2>

            <div className="space-y-4">
              <section aria-label="Fund Details">
                <h3 className="font-semibold">Fund Details</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">ID:</dt><dd>{selectedFund.id}</dd></div>
                  <div><dt className="font-bold">Status:</dt><dd>{selectedFund.isActive ? 'Active' : 'Inactive'}</dd></div>
                  <div><dt className="font-bold">Total Amount:</dt><dd>{formatAmount(selectedFund.totalAmount)}</dd></div>
                  <div><dt className="font-bold">Released Amount:</dt><dd>{formatAmount(selectedFund.releasedAmount)}</dd></div>
                  <div><dt className="font-bold">Created:</dt><dd>{formatDate(selectedFund.createdAt)}</dd></div>
                  <div><dt className="font-bold">Expires:</dt><dd>{formatDate(selectedFund.expiresAt)}</dd></div>
                </dl>
              </section>

              <section aria-label="Description">
                <h3 className="font-semibold">Description</h3>
                <p className="text-gray-600 mt-1">{selectedFund.description}</p>
              </section>

              <section aria-label="Disaster Information">
                <h3 className="font-semibold">Disaster Information</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">Type:</dt><dd>{selectedFund.disasterType}</dd></div>
                  <div><dt className="font-bold">Geographic Scope:</dt><dd>{selectedFund.geographicScope}</dd></div>
                </dl>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                ref={modalCloseRef}
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
