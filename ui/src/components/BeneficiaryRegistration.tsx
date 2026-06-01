import React, { useState, useEffect, useRef } from 'react';
import { BeneficiaryClient, BeneficiaryProfile, VerificationFactor, NetworkConfig } from '../../sdk/src/types';

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
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const openModalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [registrationForm, setRegistrationForm] = useState({
    beneficiaryId: '', name: '', disasterId: '', location: '',
    walletAddress: '', familySize: '1', specialNeeds: '',
    possessionFactors: '', behavioralFactors: '', socialFactors: ''
  });

  const [verificationForm, setVerificationForm] = useState({
    beneficiaryId: '', verifierKey: '', providedFactors: ''
  });

  const [ussdSession, setUssdSession] = useState({
    sessionId: '', phoneNumber: '', currentStep: 'welcome', response: ''
  });
  const ussdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadBeneficiaries(); }, []);

  // Focus trap for modal
  useEffect(() => {
    if (!selectedBeneficiary) return;
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
  }, [selectedBeneficiary]);

  const closeModal = () => {
    setSelectedBeneficiary(null);
    openModalTriggerRef.current?.focus();
  };

  const loadBeneficiaries = useCallback(async () => {
    try {
      setLoading(true);
      const list = await beneficiaryClient.listBeneficiariesByDisaster('sample_disaster_001');
      setBeneficiaries(list);
    } catch (error) {
      console.error('Failed to load beneficiaries:', error);
      setErrorMessage('Failed to load beneficiaries.');
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
    setErrorMessage('');
    try {
      setLoading(true);
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
        registrationForm.specialNeeds.split(',').map(f => f.trim()).filter(Boolean),
        verificationFactors
      );
      const codes = beneficiaryClient.generateRecoveryCodes(registrationForm.beneficiaryId);
      setRecoveryCodes(codes);
      setShowRegistrationForm(false);
      setRegistrationForm({ beneficiaryId: '', name: '', disasterId: '', location: '', walletAddress: '', familySize: '1', specialNeeds: '', possessionFactors: '', behavioralFactors: '', socialFactors: '' });
      setStatusMessage('Beneficiary registered successfully. Save your recovery codes.');
      loadBeneficiaries();
    } catch (error) {
      console.error('Failed to register beneficiary:', error);
      setErrorMessage('Failed to register beneficiary. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      const providedFactors: VerificationFactor[] = verificationForm.providedFactors
        .split(',').map(f => ({ factorType: 'possession', value: f.trim(), weight: 50, verifiedAt: Date.now() }));
      const verified = await beneficiaryClient.verifyBeneficiary(
        verificationForm.verifierKey, verificationForm.beneficiaryId, providedFactors
      );
      setStatusMessage(verified ? 'Beneficiary verified successfully.' : 'Verification failed. Please check the provided factors.');
      if (!verified) setErrorMessage('Verification failed. Please check the provided factors.');
      setShowVerificationForm(false);
      setVerificationForm({ beneficiaryId: '', verifierKey: '', providedFactors: '' });
      loadBeneficiaries();
    } catch (error) {
      console.error('Failed to verify beneficiary:', error);
      setErrorMessage('Failed to verify beneficiary.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAccess = async (beneficiaryId: string, recoveryCode: string, newWalletAddress: string) => {
    try {
      const restored = await beneficiaryClient.restoreAccess(beneficiaryId, recoveryCode, newWalletAddress);
      if (restored) {
        setStatusMessage('Access restored successfully.');
        loadBeneficiaries();
      } else {
        setErrorMessage('Failed to restore access. Check recovery code.');
      }
    } catch (error) {
      console.error('Failed to restore access:', error);
      setErrorMessage('Failed to restore access.');
    }
  };

  const handleUSSDSession = (phoneNumber: string) => {
    const session = beneficiaryClient.createUSSDSession(phoneNumber);
    setUssdSession({ sessionId: session.sessionId, phoneNumber, currentStep: 'welcome', response: session.welcomeMessage });
  };

  const handleUSSDInput = (input: string) => {
    const result = beneficiaryClient.processUSSDInput(ussdSession.sessionId, input, ussdSession.currentStep);
    setUssdSession({ ...ussdSession, currentStep: result.nextStep, response: result.response });
    if (result.completed) {
      setStatusMessage('USSD registration completed.');
      setUssdSession({ sessionId: '', phoneNumber: '', currentStep: 'welcome', response: '' });
    }
  };

  const getTrustScoreLabel = (score: number) => {
    if (score >= 80) return { label: 'High', className: 'text-green-600' };
    if (score >= 60) return { label: 'Medium', className: 'text-yellow-600' };
    return { label: 'Low', className: 'text-red-600' };
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-4 py-2 z-50">
        Skip to main content
      </a>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusMessage}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{errorMessage}</div>

      <main id="main-content">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Beneficiary Registration</h1>
          <p className="text-gray-600 mb-6">Biometric-free identity management for displaced persons</p>

          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800">{errorMessage}</div>
          )}
          {statusMessage && (
            <div role="status" className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-800">{statusMessage}</div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowRegistrationForm(v => !v)}
              aria-expanded={showRegistrationForm}
              aria-controls="registration-form"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showRegistrationForm ? 'Hide Registration Form' : 'Register Beneficiary'}
            </button>
            <button
              onClick={() => setShowVerificationForm(v => !v)}
              aria-expanded={showVerificationForm}
              aria-controls="verification-form"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {showVerificationForm ? 'Hide Verification Form' : 'Verify Identity'}
            </button>
            <button
              onClick={() => handleUSSDSession('+1234567890')}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              USSD Demo
            </button>
          </div>

          {/* Registration Form */}
          <section id="registration-form" aria-label="Register New Beneficiary" hidden={!showRegistrationForm} className="bg-blue-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Register New Beneficiary</h2>
            <form onSubmit={handleRegistration} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-id" className="block text-sm font-medium text-gray-700 mb-1">Beneficiary ID <span aria-hidden="true">*</span></label>
                  <input id="reg-id" type="text" value={registrationForm.beneficiaryId}
                    onChange={e => setRegistrationForm({ ...registrationForm, beneficiaryId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name <span aria-hidden="true">*</span></label>
                  <input id="reg-name" type="text" value={registrationForm.name}
                    onChange={e => setRegistrationForm({ ...registrationForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-disaster" className="block text-sm font-medium text-gray-700 mb-1">Disaster ID <span aria-hidden="true">*</span></label>
                  <input id="reg-disaster" type="text" value={registrationForm.disasterId}
                    onChange={e => setRegistrationForm({ ...registrationForm, disasterId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="reg-location" className="block text-sm font-medium text-gray-700 mb-1">Location <span aria-hidden="true">*</span></label>
                  <input id="reg-location" type="text" value={registrationForm.location}
                    onChange={e => setRegistrationForm({ ...registrationForm, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-wallet" className="block text-sm font-medium text-gray-700 mb-1">Wallet Address <span aria-hidden="true">*</span></label>
                  <input id="reg-wallet" type="text" value={registrationForm.walletAddress}
                    onChange={e => setRegistrationForm({ ...registrationForm, walletAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="reg-family-size" className="block text-sm font-medium text-gray-700 mb-1">Family Size <span aria-hidden="true">*</span></label>
                  <input id="reg-family-size" type="number" value={registrationForm.familySize} min="1"
                    onChange={e => setRegistrationForm({ ...registrationForm, familySize: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required aria-required="true" />
                </div>
              </div>
              <div>
                <label htmlFor="reg-special-needs" className="block text-sm font-medium text-gray-700 mb-1">Special Needs (comma-separated)</label>
                <input id="reg-special-needs" type="text" value={registrationForm.specialNeeds}
                  onChange={e => setRegistrationForm({ ...registrationForm, specialNeeds: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-describedby="reg-special-needs-hint" />
                <p id="reg-special-needs-hint" className="text-xs text-gray-500 mt-1">e.g. medical, mobility, dietary</p>
              </div>
              <div>
                <label htmlFor="reg-possession" className="block text-sm font-medium text-gray-700 mb-1">Possession Factors (comma-separated) <span aria-hidden="true">*</span></label>
                <input id="reg-possession" type="text" value={registrationForm.possessionFactors}
                  onChange={e => setRegistrationForm({ ...registrationForm, possessionFactors: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required aria-required="true" aria-describedby="reg-possession-hint" />
                <p id="reg-possession-hint" className="text-xs text-gray-500 mt-1">e.g. phone_number, id_card, family_photo</p>
              </div>
              <div>
                <label htmlFor="reg-behavioral" className="block text-sm font-medium text-gray-700 mb-1">Behavioral Factors (comma-separated) <span aria-hidden="true">*</span></label>
                <input id="reg-behavioral" type="text" value={registrationForm.behavioralFactors}
                  onChange={e => setRegistrationForm({ ...registrationForm, behavioralFactors: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required aria-required="true" aria-describedby="reg-behavioral-hint" />
                <p id="reg-behavioral-hint" className="text-xs text-gray-500 mt-1">e.g. signature_pattern, voice_sample</p>
              </div>
              <div>
                <label htmlFor="reg-social" className="block text-sm font-medium text-gray-700 mb-1">Social Factors (comma-separated) <span aria-hidden="true">*</span></label>
                <input id="reg-social" type="text" value={registrationForm.socialFactors}
                  onChange={e => setRegistrationForm({ ...registrationForm, socialFactors: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required aria-required="true" aria-describedby="reg-social-hint" />
                <p id="reg-social-hint" className="text-xs text-gray-500 mt-1">e.g. community_leader_vouch, neighbor_confirmation</p>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} aria-disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50">
                  {loading ? 'Registering…' : 'Register Beneficiary'}
                </button>
                <button type="button" onClick={() => setShowRegistrationForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* Verification Form */}
          <section id="verification-form" aria-label="Verify Beneficiary Identity" hidden={!showVerificationForm} className="bg-green-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Verify Beneficiary Identity</h2>
            <form onSubmit={handleVerification} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ver-id" className="block text-sm font-medium text-gray-700 mb-1">Beneficiary ID <span aria-hidden="true">*</span></label>
                  <input id="ver-id" type="text" value={verificationForm.beneficiaryId}
                    onChange={e => setVerificationForm({ ...verificationForm, beneficiaryId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500" required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="ver-key" className="block text-sm font-medium text-gray-700 mb-1">Verifier Key <span aria-hidden="true">*</span></label>
                  <input id="ver-key" type="password" value={verificationForm.verifierKey}
                    onChange={e => setVerificationForm({ ...verificationForm, verifierKey: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500" required aria-required="true"
                    autoComplete="current-password" />
                </div>
              </div>
              <div>
                <label htmlFor="ver-factors" className="block text-sm font-medium text-gray-700 mb-1">Provided Factors (comma-separated) <span aria-hidden="true">*</span></label>
                <input id="ver-factors" type="text" value={verificationForm.providedFactors}
                  onChange={e => setVerificationForm({ ...verificationForm, providedFactors: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  required aria-required="true" aria-describedby="ver-factors-hint" />
                <p id="ver-factors-hint" className="text-xs text-gray-500 mt-1">e.g. phone_number, signature_pattern, community_vouch</p>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={loading} aria-disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50">
                  {loading ? 'Verifying…' : 'Verify Identity'}
                </button>
                <button type="button" onClick={() => setShowVerificationForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* USSD Demo */}
          {ussdSession.sessionId && (
            <section aria-label="USSD Session" className="bg-purple-50 p-6 rounded-lg mb-6">
              <h2 className="text-xl font-semibold mb-4">USSD Session (Feature Phone)</h2>
              <dl className="text-sm mb-3 space-y-1">
                <div><dt className="inline font-medium">Phone: </dt><dd className="inline">{ussdSession.phoneNumber}</dd></div>
                <div><dt className="inline font-medium">Session: </dt><dd className="inline">{ussdSession.sessionId}</dd></div>
              </dl>
              <div className="bg-white p-4 rounded border mb-3" aria-live="polite" aria-atomic="true" aria-label="USSD response">
                <p className="font-mono">{ussdSession.response}</p>
              </div>
              <label htmlFor="ussd-input" className="block text-sm font-medium text-gray-700 mb-1">Enter your choice</label>
              <div className="flex gap-2">
                <input
                  id="ussd-input"
                  ref={ussdInputRef}
                  type="text"
                  className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  aria-describedby="ussd-hint"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = ussdInputRef.current?.value ?? '';
                    handleUSSDInput(val);
                    if (ussdInputRef.current) ussdInputRef.current.value = '';
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Submit
                </button>
              </div>
              <p id="ussd-hint" className="text-xs text-gray-500 mt-1">Type a number and press Submit to navigate the USSD menu.</p>
            </section>
          )}

          {/* Recovery Codes */}
          {recoveryCodes.length > 0 && (
            <section aria-label="Recovery Codes" className="bg-yellow-50 p-6 rounded-lg mb-6">
              <h2 className="text-xl font-semibold mb-4 text-red-600">
                <span aria-hidden="true">⚠ </span>Important: Save Your Recovery Codes
              </h2>
              <ul className="space-y-2" aria-label="Recovery codes list">
                {recoveryCodes.map((code, index) => (
                  <li key={index} className="bg-white p-3 rounded border font-mono text-sm">
                    <span className="sr-only">Recovery Code {index + 1}: </span>{code}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-600 mt-4">
                Store these codes safely. They can be used to restore access if you lose your device.
              </p>
            </section>
          )}

          {/* Beneficiaries List */}
          <section aria-label="Registered Beneficiaries">
            <h2 className="text-xl font-semibold mb-4">Registered Beneficiaries</h2>
            {loading && (
              <div role="status" aria-live="polite" className="text-center py-4">
                <span className="sr-only">Loading beneficiaries, please wait.</span>
                <span aria-hidden="true">Loading…</span>
              </div>
            )}
            {!loading && beneficiaries.length === 0 && (
              <p className="text-gray-500 text-center py-4">No beneficiaries found.</p>
            )}
            {!loading && beneficiaries.length > 0 && (
              <ul className="grid gap-4" aria-label="Beneficiaries list">
                {beneficiaries.map(beneficiary => {
                  const trustScore = getTrustScoreLabel(beneficiary.trustScore);
                  const detailsRef = React.createRef<HTMLButtonElement>();
                  return (
                    <li key={beneficiary.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{beneficiary.name}</h3>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">ID: </dt><dd className="inline">{beneficiary.id}</dd></div>
                            <div><dt className="inline font-bold">Disaster: </dt><dd className="inline">{beneficiary.disasterId}</dd></div>
                            <div><dt className="inline font-bold">Location: </dt><dd className="inline">{beneficiary.location}</dd></div>
                            <div><dt className="inline font-bold">Family Size: </dt><dd className="inline">{beneficiary.familySize}</dd></div>
                            <div><dt className="inline font-bold">Registered: </dt><dd className="inline">{formatDate(beneficiary.registrationDate)}</dd></div>
                            <div><dt className="inline font-bold">Last Verified: </dt><dd className="inline">{formatDate(beneficiary.lastVerified)}</dd></div>
                            {beneficiary.specialNeeds.length > 0 && (
                              <div><dt className="inline font-bold">Special Needs: </dt><dd className="inline">{beneficiary.specialNeeds.join(', ')}</dd></div>
                            )}
                          </dl>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${trustScore.className}`} aria-label={`Trust score: ${beneficiary.trustScore} out of 100 (${trustScore.label})`}>
                            Trust Score: {beneficiary.trustScore}/100
                          </p>
                          <div className="mt-2">
                            <span className={`px-2 py-1 rounded text-xs ${beneficiary.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                              aria-label={`Status: ${beneficiary.isActive ? 'Active' : 'Inactive'}`}>
                              {beneficiary.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="mt-4 flex gap-2 justify-end">
                            <button
                              ref={detailsRef}
                              onClick={() => { openModalTriggerRef.current = detailsRef.current; setSelectedBeneficiary(beneficiary); }}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              aria-label={`View details for ${beneficiary.name}`}
                            >
                              Details
                            </button>
                            <button
                              onClick={() => beneficiaryClient.generateBeneficiaryQRCode(beneficiary.id, beneficiary)}
                              className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
                              aria-label={`Generate QR code for ${beneficiary.name}`}
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

      {/* Beneficiary Details Modal */}
      {selectedBeneficiary && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="beneficiary-modal-title"
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto"
          >
            <h2 id="beneficiary-modal-title" className="text-2xl font-bold mb-4">{selectedBeneficiary.name}</h2>
            <div className="space-y-4">
              <section aria-label="Personal Information">
                <h3 className="font-semibold">Personal Information</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">ID:</dt><dd>{selectedBeneficiary.id}</dd></div>
                  <div><dt className="font-bold">Status:</dt><dd>{selectedBeneficiary.isActive ? 'Active' : 'Inactive'}</dd></div>
                  <div><dt className="font-bold">Trust Score:</dt><dd>{selectedBeneficiary.trustScore}/100</dd></div>
                  <div><dt className="font-bold">Family Size:</dt><dd>{selectedBeneficiary.familySize}</dd></div>
                  <div><dt className="font-bold">Wallet:</dt><dd>{selectedBeneficiary.walletAddress}</dd></div>
                  <div><dt className="font-bold">Location:</dt><dd>{selectedBeneficiary.location}</dd></div>
                </dl>
              </section>
              <section aria-label="Verification Factors">
                <h3 className="font-semibold">Verification Factors</h3>
                <ul className="mt-2 space-y-2">
                  {selectedBeneficiary.verificationFactors.map((factor, index) => (
                    <li key={index} className="bg-gray-50 p-2 rounded text-sm">
                      <dl className="space-y-1">
                        <div><dt className="inline font-bold">Type: </dt><dd className="inline">{factor.factorType}</dd></div>
                        <div><dt className="inline font-bold">Weight: </dt><dd className="inline">{factor.weight}</dd></div>
                        <div><dt className="inline font-bold">Verified: </dt><dd className="inline">{formatDate(factor.verifiedAt)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label="Recovery Options">
                <h3 className="font-semibold mb-2">Recovery Options</h3>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const code = (form.elements.namedItem('recovery-code') as HTMLInputElement).value;
                    const wallet = (form.elements.namedItem('new-wallet') as HTMLInputElement).value;
                    if (code && wallet) handleRestoreAccess(selectedBeneficiary.id, code, wallet);
                  }}
                  className="space-y-2"
                >
                  <div>
                    <label htmlFor="recovery-code" className="block text-sm font-medium text-gray-700 mb-1">Recovery Code</label>
                    <input id="recovery-code" name="recovery-code" type="text"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                  </div>
                  <div>
                    <label htmlFor="new-wallet" className="block text-sm font-medium text-gray-700 mb-1">New Wallet Address</label>
                    <input id="new-wallet" name="new-wallet" type="text"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                  </div>
                  <button type="submit"
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2">
                    Restore Access
                  </button>
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
