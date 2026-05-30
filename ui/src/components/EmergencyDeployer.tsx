import React, { useState, useEffect, useCallback } from 'react';
import { AidClient, EmergencyFund, NetworkConfig } from '../../sdk/src/types';
import {
  useFormValidation,
  FieldError,
  compose,
  required,
  minLength,
  maxLength,
  identifier,
  isPositiveNumber,
  minValue,
  disasterType,
  futureDate,
  isInteger,
} from '../validation';
import {
  SkeletonList,
  SkeletonCard,
  StatusMessage,
  EmptyState,
  ErrorState,
  LoadingButton,
  PageLoadingOverlay,
} from './LoadingPrimitives';

interface EmergencyDeployerProps {
  aidClient: AidClient;
  config: NetworkConfig;
  adminKey: string;
}

export const EmergencyDeployer: React.FC<EmergencyDeployerProps> = ({
  aidClient,
  config,
  adminKey,
}) => {
  const [funds, setFunds] = useState<EmergencyFund[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRapidForm, setShowRapidForm] = useState(false);
  const [selectedFund, setSelectedFund] = useState<EmergencyFund | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  const [fundForm, setFundForm] = useState({
    fundId: '',
    name: '',
    description: '',
    totalAmount: '',
    disasterType: '',
    geographicScope: '',
    expiresAt: '',
    requiredSignatures: '1',
  });

  const fundValidation = useFormValidation<typeof fundForm>({
    fundId: compose(required('Fund ID'), identifier('Fund ID')),
    name: compose(required('Fund Name'), minLength(2, 'Fund Name'), maxLength(100, 'Fund Name')),
    description: compose(required('Description'), minLength(10, 'Description'), maxLength(500, 'Description')),
    totalAmount: compose(required('Total Amount'), isPositiveNumber('Total Amount'), minValue(1, 'Total Amount')),
    disasterType: compose(required('Disaster Type'), disasterType),
    geographicScope: compose(required('Geographic Scope'), minLength(2, 'Geographic Scope'), maxLength(200, 'Geographic Scope')),
    expiresAt: compose(required('Expiry Date'), futureDate('Expiry Date')),
    requiredSignatures: compose(required('Required Signatures'), isInteger('Required Signatures'), minValue(1, 'Required Signatures')),
  });

  const rapidValidation = useFormValidation<typeof rapidForm>({
    disasterId: compose(required('Disaster ID'), identifier('Disaster ID')),
    disasterType: compose(required('Disaster Type'), disasterType),
    affectedArea: compose(required('Affected Area'), minLength(2, 'Affected Area'), maxLength(200, 'Affected Area')),
    totalBudget: compose(required('Total Budget'), isPositiveNumber('Total Budget'), minValue(1, 'Total Budget')),
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
      { name: 'Water', percentage: 10, description: 'Clean water and sanitation' },
    ],
  });

  const loadActiveFunds = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const activeFunds = await aidClient.listActiveFunds();
      setFunds(activeFunds);
    } catch (error) {
      setListError('Failed to load emergency funds. Please try again.');
      console.error('Failed to load funds:', error);
    } finally {
      setListLoading(false);
    }
  }, [aidClient]);

  useEffect(() => {
    loadActiveFunds();
  }, [loadActiveFunds]);

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundValidation.validateAll(fundForm as Record<keyof typeof fundForm, string>)) return;
    setSubmitting(true);
    setSubmitStatus(null);
    try {
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
      setFundForm({
        fundId: '',
        name: '',
        description: '',
        totalAmount: '',
        disasterType: '',
        geographicScope: '',
        expiresAt: '',
        requiredSignatures: '1',
      });
      fundValidation.reset();
      setSubmitStatus({ type: 'success', message: 'Emergency fund created successfully.' });
      loadActiveFunds();
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Failed to create emergency fund. Please try again.' });
      console.error('Failed to create fund:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRapidDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rapidValidation.validateAll(rapidForm as Record<keyof typeof rapidForm, string>)) return;
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const fundIds = await aidClient.deployRapidResponse(
        adminKey,
        rapidForm.disasterId,
        rapidForm.disasterType,
        rapidForm.affectedArea,
        rapidForm.totalBudget,
        rapidForm.categories
      );
      setShowRapidForm(false);
      setRapidForm({ ...rapidForm, disasterId: '', disasterType: '', affectedArea: '', totalBudget: '' });
      rapidValidation.reset();
      setSubmitStatus({ type: 'success', message: `Created ${fundIds.length} emergency funds for rapid response.` });
      loadActiveFunds();
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Failed to deploy rapid response. Please try again.' });
      console.error('Failed to deploy rapid response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMonitorFund = async (fundId: string) => {
    try {
      const fund = await aidClient.getFund(fundId);
      if (fund) setSelectedFund(fund);
    } catch (error) {
      console.error('Failed to monitor fund:', error);
    }
  };

  const handleCleanupExpired = async () => {
    setCleaningUp(true);
    try {
      await aidClient.cleanupExpiredFunds(adminKey);
      setSubmitStatus({ type: 'success', message: 'Expired funds cleaned up successfully.' });
      loadActiveFunds();
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Failed to cleanup expired funds.' });
      console.error('Failed to cleanup expired funds:', error);
    } finally {
      setCleaningUp(false);
    }
  };

  const formatAmount = (amount: string) =>
    new Intl.NumberFormat().format(parseInt(amount) || 0);

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString();

  const getFundStatusColor = (fund: EmergencyFund) => {
    const now = Date.now();
    if (now > fund.expiresAt) return 'text-red-600';
    if (now > fund.expiresAt - 7 * 24 * 60 * 60 * 1000) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {submitting && <PageLoadingOverlay message="Deploying emergency fund…" />}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency Fund Deployer</h1>
        <p className="text-gray-600 mb-6">
          Rapid deployment and monitoring of emergency relief funds
        </p>

        {submitStatus && (
          <StatusMessage
            type={submitStatus.type}
            message={submitStatus.message}
            onDismiss={() => setSubmitStatus(null)}
            className="mb-4"
          />
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-expanded={showCreateForm}
            aria-controls="create-fund-form"
          >
            Create Emergency Fund
          </button>
          <button
            onClick={() => setShowRapidForm(!showRapidForm)}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-expanded={showRapidForm}
            aria-controls="rapid-form"
          >
            Rapid Disaster Response
          </button>
          <LoadingButton
            onClick={handleCleanupExpired}
            loading={cleaningUp}
            loadingLabel="Cleaning up…"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cleanup Expired
          </LoadingButton>
        </div>

        {/* Create Fund Form */}
        {showCreateForm && (
          <div id="create-fund-form" className="bg-gray-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Create Emergency Fund</h2>
            <form onSubmit={handleCreateFund} className="space-y-4" aria-label="Create emergency fund form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Fund ID"
                    value={fundForm.fundId}
                    onChange={(e) => { setFundForm({ ...fundForm, fundId: e.target.value }); fundValidation.validateField('fundId', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('fundId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.fundId && fundValidation.errors.fundId ? 'border-red-500' : ''}`}
                    aria-label="Fund ID"
                    aria-describedby="fundId-error"
                  />
                  <FieldError id="fundId-error" error={fundValidation.touched.fundId ? fundValidation.errors.fundId : null} />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Fund Name"
                    value={fundForm.name}
                    onChange={(e) => { setFundForm({ ...fundForm, name: e.target.value }); fundValidation.validateField('name', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.name && fundValidation.errors.name ? 'border-red-500' : ''}`}
                    aria-label="Fund Name"
                    aria-describedby="name-error"
                  />
                  <FieldError id="name-error" error={fundValidation.touched.name ? fundValidation.errors.name : null} />
                </div>
              </div>
              <div>
                <textarea
                  placeholder="Description"
                  value={fundForm.description}
                  onChange={(e) => { setFundForm({ ...fundForm, description: e.target.value }); fundValidation.validateField('description', e.target.value); }}
                  onBlur={(e) => fundValidation.validateField('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.description && fundValidation.errors.description ? 'border-red-500' : ''}`}
                  rows={3}
                  aria-label="Description"
                  aria-describedby="description-error"
                />
                <FieldError id="description-error" error={fundValidation.touched.description ? fundValidation.errors.description : null} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    placeholder="Total Amount"
                    value={fundForm.totalAmount}
                    onChange={(e) => { setFundForm({ ...fundForm, totalAmount: e.target.value }); fundValidation.validateField('totalAmount', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('totalAmount', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.totalAmount && fundValidation.errors.totalAmount ? 'border-red-500' : ''}`}
                    aria-label="Total Amount"
                    aria-describedby="totalAmount-error"
                  />
                  <FieldError id="totalAmount-error" error={fundValidation.touched.totalAmount ? fundValidation.errors.totalAmount : null} />
                </div>
                <div>
                  <select
                    value={fundForm.disasterType}
                    onChange={(e) => { setFundForm({ ...fundForm, disasterType: e.target.value }); fundValidation.validateField('disasterType', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('disasterType', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.disasterType && fundValidation.errors.disasterType ? 'border-red-500' : ''}`}
                    aria-label="Disaster Type"
                    aria-describedby="disasterType-error"
                  >
                    <option value="">Select Disaster Type</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="hurricane">Hurricane</option>
                    <option value="wildfire">Wildfire</option>
                    <option value="drought">Drought</option>
                  </select>
                  <FieldError id="disasterType-error" error={fundValidation.touched.disasterType ? fundValidation.errors.disasterType : null} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Geographic Scope"
                    value={fundForm.geographicScope}
                    onChange={(e) => { setFundForm({ ...fundForm, geographicScope: e.target.value }); fundValidation.validateField('geographicScope', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('geographicScope', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.geographicScope && fundValidation.errors.geographicScope ? 'border-red-500' : ''}`}
                    aria-label="Geographic Scope"
                    aria-describedby="geographicScope-error"
                  />
                  <FieldError id="geographicScope-error" error={fundValidation.touched.geographicScope ? fundValidation.errors.geographicScope : null} />
                </div>
                <div>
                  <input
                    type="datetime-local"
                    value={fundForm.expiresAt}
                    onChange={(e) => { setFundForm({ ...fundForm, expiresAt: e.target.value }); fundValidation.validateField('expiresAt', e.target.value); }}
                    onBlur={(e) => fundValidation.validateField('expiresAt', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${fundValidation.touched.expiresAt && fundValidation.errors.expiresAt ? 'border-red-500' : ''}`}
                    aria-label="Expiry Date"
                    aria-describedby="expiresAt-error"
                  />
                  <FieldError id="expiresAt-error" error={fundValidation.touched.expiresAt ? fundValidation.errors.expiresAt : null} />
                </div>
              </div>
              <div className="flex gap-3">
                <LoadingButton
                  type="submit"
                  loading={submitting}
                  loadingLabel="Creating…"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Create Fund
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rapid Response Form */}
        {showRapidForm && (
          <div id="rapid-form" className="bg-red-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Rapid Disaster Response</h2>
            <form onSubmit={handleRapidDeployment} className="space-y-4" aria-label="Rapid disaster response form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Disaster ID"
                    value={rapidForm.disasterId}
                    onChange={(e) => { setRapidForm({ ...rapidForm, disasterId: e.target.value }); rapidValidation.validateField('disasterId', e.target.value); }}
                    onBlur={(e) => rapidValidation.validateField('disasterId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${rapidValidation.touched.disasterId && rapidValidation.errors.disasterId ? 'border-red-500' : ''}`}
                    aria-label="Disaster ID"
                    aria-describedby="rapid-disasterId-error"
                  />
                  <FieldError id="rapid-disasterId-error" error={rapidValidation.touched.disasterId ? rapidValidation.errors.disasterId : null} />
                </div>
                <div>
                  <select
                    value={rapidForm.disasterType}
                    onChange={(e) => { setRapidForm({ ...rapidForm, disasterType: e.target.value }); rapidValidation.validateField('disasterType', e.target.value); }}
                    onBlur={(e) => rapidValidation.validateField('disasterType', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${rapidValidation.touched.disasterType && rapidValidation.errors.disasterType ? 'border-red-500' : ''}`}
                    aria-label="Disaster Type"
                    aria-describedby="rapid-disasterType-error"
                  >
                    <option value="">Select Disaster Type</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="hurricane">Hurricane</option>
                    <option value="wildfire">Wildfire</option>
                  </select>
                  <FieldError id="rapid-disasterType-error" error={rapidValidation.touched.disasterType ? rapidValidation.errors.disasterType : null} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Affected Area"
                    value={rapidForm.affectedArea}
                    onChange={(e) => { setRapidForm({ ...rapidForm, affectedArea: e.target.value }); rapidValidation.validateField('affectedArea', e.target.value); }}
                    onBlur={(e) => rapidValidation.validateField('affectedArea', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${rapidValidation.touched.affectedArea && rapidValidation.errors.affectedArea ? 'border-red-500' : ''}`}
                    aria-label="Affected Area"
                    aria-describedby="rapid-affectedArea-error"
                  />
                  <FieldError id="rapid-affectedArea-error" error={rapidValidation.touched.affectedArea ? rapidValidation.errors.affectedArea : null} />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Total Budget"
                    value={rapidForm.totalBudget}
                    onChange={(e) => { setRapidForm({ ...rapidForm, totalBudget: e.target.value }); rapidValidation.validateField('totalBudget', e.target.value); }}
                    onBlur={(e) => rapidValidation.validateField('totalBudget', e.target.value)}
                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${rapidValidation.touched.totalBudget && rapidValidation.errors.totalBudget ? 'border-red-500' : ''}`}
                    aria-label="Total Budget"
                    aria-describedby="rapid-totalBudget-error"
                  />
                  <FieldError id="rapid-totalBudget-error" error={rapidValidation.touched.totalBudget ? rapidValidation.errors.totalBudget : null} />
                </div>
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
              <div className="flex gap-3">
                <LoadingButton
                  type="submit"
                  loading={submitting}
                  loadingLabel="Deploying…"
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Deploy Rapid Response
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => setShowRapidForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Funds List */}
        <section aria-label="Active Emergency Funds">
          <h2 className="text-xl font-semibold mb-4">Active Emergency Funds</h2>

          {listLoading ? (
            <SkeletonList count={3} />
          ) : listError ? (
            <ErrorState message={listError} onRetry={loadActiveFunds} />
          ) : funds.length === 0 ? (
            <EmptyState
              title="No active funds"
              description="Deploy an emergency fund to get started."
              icon="💰"
              action={
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Create Emergency Fund
                </button>
              }
            />
          ) : (
            <div className="grid gap-4" role="list" aria-label="Emergency funds">
              {funds.map((fund) => (
                <div
                  key={fund.id}
                  role="listitem"
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
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
                        <p><strong>Remaining:</strong> {formatAmount(
                          (parseInt(fund.totalAmount) - parseInt(fund.releasedAmount)).toString()
                        )}</p>
                      </div>
                      <div className="mt-4 flex gap-2 justify-end">
                        <button
                          onClick={() => handleMonitorFund(fund.id)}
                          className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          Monitor
                        </button>
                        <button
                          onClick={() => aidClient.generateFundQRCode(fund.id, fund)}
                          className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          QR Code
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Fund Details Modal */}
        {selectedFund && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-modal-title"
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          >
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
              <h2 id="fund-modal-title" className="text-2xl font-bold mb-4">{selectedFund.name}</h2>
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
                <button
                  onClick={() => setSelectedFund(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
