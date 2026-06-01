import React, { useState, useEffect } from 'react';
import { AidClient, EmergencyFund, NetworkConfig, BatchDisbursementEntry } from '../../sdk/src/types';

interface EmergencyDeployerProps {
  aidClient: AidClient;
  config: NetworkConfig;
  adminKey: string;
}

const EMPTY_ENTRY: BatchDisbursementEntry = { beneficiary: '', amount: '', purpose: '' };

export const EmergencyDeployer: React.FC<EmergencyDeployerProps> = ({
  aidClient,
  config,
  adminKey
}) => {
  const [funds, setFunds] = useState<EmergencyFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRapidForm, setShowRapidForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [selectedFund, setSelectedFund] = useState<EmergencyFund | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSuccess, setBatchSuccess] = useState<string | null>(null);

  // Form states
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

  const [batchForm, setBatchForm] = useState({
    fundId: '',
    approvers: '',
    entries: [{ ...EMPTY_ENTRY }] as BatchDisbursementEntry[],
  });

  useEffect(() => {
    loadActiveFunds();
  }, []);

  const loadActiveFunds = async () => {
    try {
      setLoading(true);
      const activeFunds = await aidClient.listActiveFunds();
      setFunds(activeFunds);
    } catch (error) {
      console.error('Failed to load funds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadActiveFunds();
    } catch (error) {
      console.error('Failed to create fund:', error);
      alert('Failed to create emergency fund');
    } finally {
      setLoading(false);
    }
  };

  const handleRapidDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
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
      loadActiveFunds();
      alert(`Created ${fundIds.length} emergency funds for rapid response`);
    } catch (error) {
      console.error('Failed to deploy rapid response:', error);
      alert('Failed to deploy rapid response');
    } finally {
      setLoading(false);
    }
  };

  // ── Batch disbursement handlers ──────────────────────────────────────────

  const addBatchEntry = () => {
    setBatchForm(f => ({ ...f, entries: [...f.entries, { ...EMPTY_ENTRY }] }));
  };

  const removeBatchEntry = (idx: number) => {
    setBatchForm(f => ({ ...f, entries: f.entries.filter((_, i) => i !== idx) }));
  };

  const updateBatchEntry = (idx: number, field: keyof BatchDisbursementEntry, value: string) => {
    setBatchForm(f => {
      const entries = [...f.entries];
      entries[idx] = { ...entries[idx], [field]: value };
      return { ...f, entries };
    });
  };

  const handleBatchDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchError(null);
    setBatchSuccess(null);

    // Client-side validation
    if (!batchForm.fundId.trim()) {
      setBatchError('Fund ID is required');
      return;
    }
    if (batchForm.entries.length === 0) {
      setBatchError('At least one entry is required');
      return;
    }
    const seen = new Set<string>();
    for (const entry of batchForm.entries) {
      if (!entry.beneficiary.trim() || !entry.amount.trim() || !entry.purpose.trim()) {
        setBatchError('All entry fields (beneficiary, amount, purpose) are required');
        return;
      }
      if (Number(entry.amount) <= 0) {
        setBatchError('Amount must be greater than zero');
        return;
      }
      if (seen.has(entry.beneficiary)) {
        setBatchError(`Duplicate beneficiary: ${entry.beneficiary}`);
        return;
      }
      seen.add(entry.beneficiary);
    }

    const approvers = batchForm.approvers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      const ids = await (aidClient as any).triggerBatchDisbursement(
        adminKey,
        batchForm.fundId,
        batchForm.entries,
        approvers
      );
      setBatchSuccess(`Batch submitted successfully. ${ids.length} disbursement(s) created.`);
      setBatchForm({ fundId: '', approvers: '', entries: [{ ...EMPTY_ENTRY }] });
      loadActiveFunds();
    } catch (error: any) {
      setBatchError(error.message ?? 'Batch disbursement failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleMonitorFund = async (fundId: string) => {
    try {
      const fund = await aidClient.getFund(fundId);
      if (fund) setSelectedFund(fund);
    } catch (error) {
      console.error('Failed to monitor fund:', error);
    }
  };

  const handleCleanupExpired = async () => {
    try {
      setLoading(true);
      await aidClient.cleanupExpiredFunds(adminKey);
      loadActiveFunds();
      alert('Expired funds cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup expired funds:', error);
      alert('Failed to cleanup expired funds');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string) => new Intl.NumberFormat().format(parseInt(amount) || 0);
  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString();
  const getFundStatusColor = (fund: EmergencyFund) => {
    const now = Date.now();
    if (now > fund.expiresAt) return 'text-red-600';
    if (now > fund.expiresAt - 7 * 24 * 60 * 60 * 1000) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Fund Deployer</h1>
        <p className="text-gray-600 mb-6">Rapid deployment and monitoring of emergency relief funds</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create Emergency Fund
          </button>
          <button onClick={() => setShowRapidForm(!showRapidForm)} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Rapid Disaster Response
          </button>
          <button
            onClick={() => { setShowBatchForm(!showBatchForm); setBatchError(null); setBatchSuccess(null); }}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Batch Disbursement
          </button>
          <button onClick={handleCleanupExpired} disabled={loading} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
            Cleanup Expired
          </button>
        </div>

        {/* Create Fund Form */}
        {showCreateForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Emergency Fund</h2>
            <form onSubmit={handleCreateFund} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Fund ID" value={fundForm.fundId} onChange={(e) => setFundForm({...fundForm, fundId: e.target.value})} className="px-3 py-2 border rounded" required />
                <input type="text" placeholder="Fund Name" value={fundForm.name} onChange={(e) => setFundForm({...fundForm, name: e.target.value})} className="px-3 py-2 border rounded" required />
              </div>
              <textarea placeholder="Description" value={fundForm.description} onChange={(e) => setFundForm({...fundForm, description: e.target.value})} className="w-full px-3 py-2 border rounded" rows={3} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Total Amount" value={fundForm.totalAmount} onChange={(e) => setFundForm({...fundForm, totalAmount: e.target.value})} className="px-3 py-2 border rounded" required />
                <select value={fundForm.disasterType} onChange={(e) => setFundForm({...fundForm, disasterType: e.target.value})} className="px-3 py-2 border rounded" required>
                  <option value="">Select Disaster Type</option>
                  <option value="earthquake">Earthquake</option>
                  <option value="flood">Flood</option>
                  <option value="hurricane">Hurricane</option>
                  <option value="wildfire">Wildfire</option>
                  <option value="drought">Drought</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Geographic Scope" value={fundForm.geographicScope} onChange={(e) => setFundForm({...fundForm, geographicScope: e.target.value})} className="px-3 py-2 border rounded" required />
                <input type="datetime-local" value={fundForm.expiresAt} onChange={(e) => setFundForm({...fundForm, expiresAt: e.target.value})} className="px-3 py-2 border rounded" required />
              </div>
              <div className="flex space-x-4">
                <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">{loading ? 'Creating...' : 'Create Fund'}</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Rapid Response Form */}
        {showRapidForm && (
          <div className="bg-red-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Rapid Disaster Response</h2>
            <form onSubmit={handleRapidDeployment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Disaster ID" value={rapidForm.disasterId} onChange={(e) => setRapidForm({...rapidForm, disasterId: e.target.value})} className="px-3 py-2 border rounded" required />
                <select value={rapidForm.disasterType} onChange={(e) => setRapidForm({...rapidForm, disasterType: e.target.value})} className="px-3 py-2 border rounded" required>
                  <option value="">Select Disaster Type</option>
                  <option value="earthquake">Earthquake</option>
                  <option value="flood">Flood</option>
                  <option value="hurricane">Hurricane</option>
                  <option value="wildfire">Wildfire</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Affected Area" value={rapidForm.affectedArea} onChange={(e) => setRapidForm({...rapidForm, affectedArea: e.target.value})} className="px-3 py-2 border rounded" required />
                <input type="number" placeholder="Total Budget" value={rapidForm.totalBudget} onChange={(e) => setRapidForm({...rapidForm, totalBudget: e.target.value})} className="px-3 py-2 border rounded" required />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Fund Categories:</h3>
                {rapidForm.categories.map((category, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <span className="w-24">{category.name}</span>
                    <span className="w-32">{category.percentage}%</span>
                    <span className="text-sm text-gray-600">{category.description}</span>
                  </div>
                ))}
              </div>
              <div className="flex space-x-4">
                <button type="submit" disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">{loading ? 'Deploying...' : 'Deploy Rapid Response'}</button>
                <button type="button" onClick={() => setShowRapidForm(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Batch Disbursement Form */}
        {showBatchForm && (
          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-1">Batch Disbursement</h2>
            <p className="text-sm text-gray-600 mb-4">
              Submit multiple disbursements atomically — all succeed or all fail.
            </p>

            {batchError && (
              <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
                {batchError}
              </div>
            )}
            {batchSuccess && (
              <div role="status" className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4">
                {batchSuccess}
              </div>
            )}

            <form onSubmit={handleBatchDisbursement} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fund ID</label>
                  <input
                    type="text"
                    placeholder="e.g. earthquake_response_2024"
                    value={batchForm.fundId}
                    onChange={(e) => setBatchForm(f => ({ ...f, fundId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    required
                    aria-label="Fund ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approver Addresses <span className="text-gray-400">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="GABC..., GDEF..."
                    value={batchForm.approvers}
                    onChange={(e) => setBatchForm(f => ({ ...f, approvers: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    aria-label="Approver addresses"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-700">Disbursement Entries</h3>
                  <button
                    type="button"
                    onClick={addBatchEntry}
                    className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200"
                    aria-label="Add disbursement entry"
                  >
                    + Add Entry
                  </button>
                </div>

                <div className="space-y-2">
                  {batchForm.entries.map((entry, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="mt-2 text-sm text-gray-500 w-6 shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="Beneficiary address"
                        value={entry.beneficiary}
                        onChange={(e) => updateBatchEntry(idx, 'beneficiary', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded text-sm"
                        required
                        aria-label={`Entry ${idx + 1} beneficiary`}
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={entry.amount}
                        min="1"
                        onChange={(e) => updateBatchEntry(idx, 'amount', e.target.value)}
                        className="w-32 px-3 py-2 border rounded text-sm"
                        required
                        aria-label={`Entry ${idx + 1} amount`}
                      />
                      <input
                        type="text"
                        placeholder="Purpose"
                        value={entry.purpose}
                        onChange={(e) => updateBatchEntry(idx, 'purpose', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded text-sm"
                        required
                        aria-label={`Entry ${idx + 1} purpose`}
                      />
                      {batchForm.entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBatchEntry(idx)}
                          className="mt-1 text-red-500 hover:text-red-700 px-2"
                          aria-label={`Remove entry ${idx + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Total entries: {batchForm.entries.length} &nbsp;|&nbsp;
                  Estimated total:{' '}
                  {batchForm.entries.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : `Submit Batch (${batchForm.entries.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowBatchForm(false); setBatchError(null); setBatchSuccess(null); }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Funds List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Emergency Funds</h2>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : funds.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No active funds found</div>
          ) : (
            <div className="grid gap-4">
              {funds.map((fund) => (
                <div key={fund.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{fund.name}</h3>
                      <p className="text-gray-600">{fund.description}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><strong>ID:</strong> {fund.id}</p>
                        <p><strong>Disaster:</strong> {fund.disasterType}</p>
                        <p><strong>Area:</strong> {fund.geographicScope}</p>
                        <p><strong>Created:</strong> {formatDate(fund.createdAt)}</p>
                        <p><strong>Expires:</strong> {formatDate(fund.expiresAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${getFundStatusColor(fund)}`}>
                        {fund.isActive ? 'Active' : 'Inactive'}
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><strong>Total:</strong> {formatAmount(fund.totalAmount)}</p>
                        <p><strong>Released:</strong> {formatAmount(fund.releasedAmount)}</p>
                        <p><strong>Remaining:</strong> {formatAmount((parseInt(fund.totalAmount) - parseInt(fund.releasedAmount)).toString())}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 justify-end">
                        <button onClick={() => handleMonitorFund(fund.id)} className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600">Monitor</button>
                        <button
                          onClick={() => { setBatchForm(f => ({ ...f, fundId: fund.id })); setShowBatchForm(true); setBatchError(null); setBatchSuccess(null); }}
                          className="bg-purple-500 text-white px-3 py-1 text-sm rounded hover:bg-purple-600"
                          aria-label={`Batch disburse from ${fund.name}`}
                        >
                          Batch Disburse
                        </button>
                        <button onClick={() => aidClient.generateFundQRCode(fund.id, fund)} className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600">QR Code</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fund Details Modal */}
        {selectedFund && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">{selectedFund.name}</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Fund Details</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <p><strong>ID:</strong> {selectedFund.id}</p>
                    <p><strong>Status:</strong> {selectedFund.isActive ? 'Active' : 'Inactive'}</p>
                    <p><strong>Total Amount:</strong> {formatAmount(selectedFund.totalAmount)}</p>
                    <p><strong>Released Amount:</strong> {formatAmount(selectedFund.releasedAmount)}</p>
                    <p><strong>Created:</strong> {formatDate(selectedFund.createdAt)}</p>
                    <p><strong>Expires:</strong> {formatDate(selectedFund.expiresAt)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Description</h3>
                  <p className="text-gray-600">{selectedFund.description}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Disaster Information</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <p><strong>Type:</strong> {selectedFund.disasterType}</p>
                    <p><strong>Geographic Scope:</strong> {selectedFund.geographicScope}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setSelectedFund(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
