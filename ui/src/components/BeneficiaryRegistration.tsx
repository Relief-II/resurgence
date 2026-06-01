import React, { useState, useEffect, useCallback } from 'react';
import { BeneficiaryProfile, VerificationFactor, NetworkConfig, PaginationCursor } from '../../../sdk/src/types';
import { BeneficiaryClient } from '../../../sdk/src/beneficiaryClient';

const PAGE_SIZE = 20;

interface BeneficiaryRegistrationProps {
  beneficiaryClient: BeneficiaryClient;
  config: NetworkConfig;
  registrarKey: string;
}

export const BeneficiaryRegistration: React.FC<BeneficiaryRegistrationProps> = ({
  beneficiaryClient,
}) => {
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<PaginationCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<BeneficiaryProfile | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Registration form state
  const [registrationForm, setRegistrationForm] = useState({
    beneficiaryId: '',
    name: '',
    disasterId: '',
    location: '',
    walletAddress: '',
    familySize: '1',
    specialNeeds: '',
    possessionFactors: '',
    behavioralFactors: '',
    socialFactors: ''
  });

  // Verification form state
  const [verificationForm, setVerificationForm] = useState({
    beneficiaryId: '',
    verifierKey: '',
    providedFactors: ''
  });

  // USSD session state
  const [ussdSession, setUssdSession] = useState({
    sessionId: '',
    phoneNumber: '',
    currentStep: 'welcome',
    response: ''
  });

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  const loadBeneficiaries = useCallback(async () => {
    try {
      setLoading(true);
      const page = await beneficiaryClient.listBeneficiariesPaginated('sample_disaster_001', {
        limit: PAGE_SIZE,
      });
      setBeneficiaries(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Failed to load beneficiaries:', error);
    } finally {
      setLoading(false);
    }
  }, [beneficiaryClient]);

  const loadMoreBeneficiaries = async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    try {
      setLoadingMore(true);
      const page = await beneficiaryClient.listBeneficiariesPaginated('sample_disaster_001', {
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setBeneficiaries(prev => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Failed to load more beneficiaries:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Create verification factors
      const verificationFactors = beneficiaryClient.createVerificationFactors(
        registrationForm.possessionFactors.split(',').map(f => f.trim()),
        registrationForm.behavioralFactors.split(',').map(f => f.trim()),
        registrationForm.socialFactors.split(',').map(f => f.trim())
      );

      await beneficiaryClient.registerBeneficiary(
        registrarKey,
        registrationForm.beneficiaryId,
        registrationForm.name,
        registrationForm.disasterId,
        registrationForm.location,
        registrationForm.walletAddress,
        parseInt(registrationForm.familySize),
        registrationForm.specialNeeds.split(',').map(f => f.trim()).filter(f => f),
        verificationFactors
      );

      // Generate recovery codes
      const codes = beneficiaryClient.generateRecoveryCodes(registrationForm.beneficiaryId);
      setRecoveryCodes(codes);

      setShowRegistrationForm(false);
      setRegistrationForm({
        beneficiaryId: '',
        name: '',
        disasterId: '',
        location: '',
        walletAddress: '',
        familySize: '1',
        specialNeeds: '',
        possessionFactors: '',
        behavioralFactors: '',
        socialFactors: ''
      });
      loadBeneficiaries();
      alert('Beneficiary registered successfully! Save your recovery codes.');
    } catch (error) {
      console.error('Failed to register beneficiary:', error);
      alert('Failed to register beneficiary');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const providedFactors: VerificationFactor[] = verificationForm.providedFactors
        .split(',')
        .map(f => ({
          factorType: 'possession', // Simplified
          value: f.trim(),
          weight: 50,
          verifiedAt: Date.now()
        }));

      const verified = await beneficiaryClient.verifyBeneficiary(
        verificationForm.verifierKey,
        verificationForm.beneficiaryId,
        providedFactors
      );

      if (verified) {
        alert('Beneficiary verified successfully!');
      } else {
        alert('Verification failed. Please check the provided factors.');
      }

      setShowVerificationForm(false);
      setVerificationForm({
        beneficiaryId: '',
        verifierKey: '',
        providedFactors: ''
      });
      loadBeneficiaries();
    } catch (error) {
      console.error('Failed to verify beneficiary:', error);
      alert('Failed to verify beneficiary');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAccess = async (beneficiaryId: string, recoveryCode: string) => {
    try {
      const newWalletAddress = prompt('Enter new wallet address:');
      if (!newWalletAddress) return;

      const restored = await beneficiaryClient.restoreAccess(beneficiaryId, recoveryCode, newWalletAddress);
      
      if (restored) {
        alert('Access restored successfully!');
        loadBeneficiaries();
      } else {
        alert('Failed to restore access. Check recovery code.');
      }
    },
    [beneficiaryClient]
  );

  // Reset pagination and reload whenever filters change (debounced 300 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage({ limit: PAGE_SIZE, search, locationFilter, activeOnly, minTrustScore }, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, locationFilter, activeOnly, minTrustScore, fetchPage]);

  const loadMore = () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    fetchPage(
      { cursor: nextCursor, limit: PAGE_SIZE, search, locationFilter, activeOnly, minTrustScore },
      true
    );
  };

  const clearFilters = () => {
    setSearch('');
    setLocationFilter('');
    setActiveOnly(true);
    setMinTrustScore(0);
  };

  const getTrustColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Beneficiary Registration</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Biometric-free identity management for displaced persons
        </p>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setShowRegistrationForm(!showRegistrationForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Register Beneficiary
          </button>
          <button
            onClick={() => setShowVerificationForm(!showVerificationForm)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Verify Identity
          </button>
          <button
            onClick={() => handleUSSDSession('+1234567890')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            USSD Demo
          </button>
        </div>

        {/* Registration Form */}
        {showRegistrationForm && (
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Register New Beneficiary</h2>
            <form onSubmit={handleRegistration} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Beneficiary ID"
                  value={registrationForm.beneficiaryId}
                  onChange={(e) => setRegistrationForm({...registrationForm, beneficiaryId: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={registrationForm.name}
                  onChange={(e) => setRegistrationForm({...registrationForm, name: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Disaster ID"
                  value={registrationForm.disasterId}
                  onChange={(e) => setRegistrationForm({...registrationForm, disasterId: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={registrationForm.location}
                  onChange={(e) => setRegistrationForm({...registrationForm, location: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Wallet Address"
                  value={registrationForm.walletAddress}
                  onChange={(e) => setRegistrationForm({...registrationForm, walletAddress: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
                <input
                  type="number"
                  placeholder="Family Size"
                  value={registrationForm.familySize}
                  onChange={(e) => setRegistrationForm({...registrationForm, familySize: e.target.value})}
                  className="px-3 py-2 border rounded"
                  min="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Special Needs (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., medical, mobility, dietary"
                  value={registrationForm.specialNeeds}
                  onChange={(e) => setRegistrationForm({...registrationForm, specialNeeds: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Possession Factors (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., phone_number, id_card, family_photo"
                  value={registrationForm.possessionFactors}
                  onChange={(e) => setRegistrationForm({...registrationForm, possessionFactors: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Behavioral Factors (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., signature_pattern, voice_sample, handwriting"
                  value={registrationForm.behavioralFactors}
                  onChange={(e) => setRegistrationForm({...registrationForm, behavioralFactors: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Social Factors (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., community_leader_vouch, neighbor_confirmation, local_organization"
                  value={registrationForm.socialFactors}
                  onChange={(e) => setRegistrationForm({...registrationForm, socialFactors: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  {loading ? 'Registering...' : 'Register Beneficiary'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegistrationForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Verification Form */}
        {showVerificationForm && (
          <div className="bg-green-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Verify Beneficiary Identity</h2>
            <form onSubmit={handleVerification} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Beneficiary ID"
                  value={verificationForm.beneficiaryId}
                  onChange={(e) => setVerificationForm({...verificationForm, beneficiaryId: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
                <input
                  type="password"
                  placeholder="Verifier Key"
                  value={verificationForm.verifierKey}
                  onChange={(e) => setVerificationForm({...verificationForm, verifierKey: e.target.value})}
                  className="px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Provided Factors (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., phone_number, signature_pattern, community_vouch"
                  value={verificationForm.providedFactors}
                  onChange={(e) => setVerificationForm({...verificationForm, providedFactors: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  {loading ? 'Verifying...' : 'Verify Identity'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVerificationForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* USSD Demo */}
        {ussdSession.sessionId && (
          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">USSD Session (Feature Phone)</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Phone: {ussdSession.phoneNumber}</p>
                <p className="text-sm text-gray-600">Session: {ussdSession.sessionId}</p>
              </div>
              
              <div className="bg-white p-4 rounded border">
                <p className="font-mono">{ussdSession.response}</p>
              </div>
              
              <input
                type="checkbox"
                aria-label="Active only"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
            <label className="flex items-center gap-2 text-sm">
              Min trust score:
              <input
                type="number"
                aria-label="Minimum trust score"
                min={0}
                max={100}
                value={minTrustScore}
                onChange={e =>
                  setMinTrustScore(Math.max(0, Math.min(100, Number(e.target.value))))
                }
                className="w-16 px-2 py-1 border rounded text-sm"
              />
            </label>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 underline"
              aria-label="Clear all filters"
            >
              Clear filters
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Beneficiaries List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Registered Beneficiaries</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500" aria-live="polite">Loading beneficiaries…</div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-gray-500 text-center py-8" aria-live="polite">No beneficiaries found</div>
          ) : (
            <>
              <div className="grid gap-4">
                {beneficiaries.map((beneficiary) => (
                <div key={beneficiary.id} className="border dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{b.name}</h3>
                      <p className="text-sm text-gray-600">
                        ID: {b.id} · {b.location} · Family: {b.familySize}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold text-sm ${getTrustColor(b.trustScore)}`}>
                        Trust {b.trustScore}/100
                      </span>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          b.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination footer */}
            <div className="mt-4 text-center">
              {hasMore ? (
                <button
                  onClick={loadMoreBeneficiaries}
                  disabled={loadingMore}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  aria-label="Load more beneficiaries"
                >
                  {loadingMore ? 'Loading…' : 'Load More'}
                </button>
              ) : (
                <p className="text-gray-400 text-sm" aria-live="polite">All beneficiaries loaded ({beneficiaries.length} total)</p>
              )}
            </div>
            </>
          )}
        </div>

        {/* Beneficiary Details Modal */}
        {selectedBeneficiary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{selectedBeneficiary.name}</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <p><strong>ID:</strong> {selectedBeneficiary.id}</p>
                    <p><strong>Status:</strong> {selectedBeneficiary.isActive ? 'Active' : 'Inactive'}</p>
                    <p><strong>Trust Score:</strong> {selectedBeneficiary.trustScore}/100</p>
                    <p><strong>Family Size:</strong> {selectedBeneficiary.familySize}</p>
                    <p><strong>Wallet:</strong> {selectedBeneficiary.walletAddress}</p>
                    <p><strong>Location:</strong> {selectedBeneficiary.location}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold">Verification Factors</h3>
                  <div className="mt-2 space-y-2">
                    {selectedBeneficiary.verificationFactors.map((factor, index) => (
                      <div key={index} className="bg-gray-50 p-2 rounded">
                        <p><strong>Type:</strong> {factor.factorType}</p>
                        <p><strong>Weight:</strong> {factor.weight}</p>
                        <p><strong>Verified:</strong> {formatDate(factor.verifiedAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold">Recovery Options</h3>
                  <button
                    onClick={() => {
                      const code = prompt('Enter recovery code:');
                      if (code) {
                        handleRestoreAccess(selectedBeneficiary.id, code);
                      }
                    }}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                  >
                    Restore Access
                  </button>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : (
                <p className="text-gray-500 text-sm">
                  All beneficiaries loaded — {beneficiaries.length} total
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
