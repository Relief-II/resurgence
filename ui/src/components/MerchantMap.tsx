import React, { useState, useEffect, useRef } from 'react';
import { MerchantClient, Merchant, Location, NetworkConfig } from '../../sdk/src/types';

interface MerchantMapProps {
  merchantClient: MerchantClient;
  config: NetworkConfig;
  adminKey: string;
}

export const MerchantMap: React.FC<MerchantMapProps> = ({ merchantClient, config, adminKey }) => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [searchRadius, setSearchRadius] = useState(10);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const openModalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [onboardingForm, setOnboardingForm] = useState({
    merchantId: '', name: '', businessType: 'grocery', contactInfo: '',
    stellarAddress: '', acceptedTokens: 'XLM', dailyLimit: '1000', monthlyLimit: '10000',
    location: {
      latitude: '', longitude: '', address: '', city: '',
      country: '', postalCode: '', facilityName: '', contactPerson: ''
    }
  });

  useEffect(() => { loadMerchants(); loadVerificationQueue(); }, []);

  // Focus trap for modal
  useEffect(() => {
    if (!selectedMerchant) return;
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
  }, [selectedMerchant]);

  const closeModal = () => {
    setSelectedMerchant(null);
    openModalTriggerRef.current?.focus();
  };

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const nearbyMerchants = await merchantClient.findMerchantsByLocation(mapCenter.lat, mapCenter.lng, searchRadius);
      setMerchants(nearbyMerchants);
    } catch (error) {
      console.error('Failed to load merchants:', error);
      setErrorMessage('Failed to load merchants.');
    } finally {
      setLoading(false);
    }
  };

  const loadVerificationQueue = async () => {
    try {
      const queue = await merchantClient.getVerificationQueue();
      setVerificationQueue(queue);
    } catch (error) {
      console.error('Failed to load verification queue:', error);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      setLoading(true);
      const location: Location = {
        latitude: parseFloat(onboardingForm.location.latitude),
        longitude: parseFloat(onboardingForm.location.longitude),
        address: onboardingForm.location.address,
        city: onboardingForm.location.city,
        country: onboardingForm.location.country,
        postalCode: onboardingForm.location.postalCode
      };
      const request = merchantClient.createOnboardingRequest(
        onboardingForm.name, onboardingForm.businessType, location,
        onboardingForm.contactInfo, onboardingForm.stellarAddress
      );
      await merchantClient.registerMerchant(adminKey, onboardingForm.merchantId, request);
      setShowOnboardingForm(false);
      setOnboardingForm({
        merchantId: '', name: '', businessType: 'grocery', contactInfo: '',
        stellarAddress: '', acceptedTokens: 'XLM', dailyLimit: '1000', monthlyLimit: '10000',
        location: { latitude: '', longitude: '', address: '', city: '', country: '', postalCode: '', facilityName: '', contactPerson: '' }
      });
      setStatusMessage('Merchant registered successfully. Awaiting verification.');
      loadVerificationQueue();
    } catch (error) {
      console.error('Failed to onboard merchant:', error);
      setErrorMessage('Failed to onboard merchant. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMerchant = async (merchantId: string, approved: boolean) => {
    setErrorMessage('');
    try {
      setLoading(true);
      await merchantClient.verifyMerchant(adminKey, merchantId, approved, '');
      setStatusMessage(`Merchant ${approved ? 'approved' : 'rejected'} successfully.`);
      loadVerificationQueue();
      loadMerchants();
    } catch (error) {
      console.error('Failed to verify merchant:', error);
      setErrorMessage('Failed to verify merchant.');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchVerify = async (approved: boolean) => {
    setErrorMessage('');
    try {
      setLoading(true);
      const results = await merchantClient.batchVerifyMerchants(adminKey, verificationQueue, approved, 'Batch verification');
      setStatusMessage(`Batch verification completed: ${results.length} merchants ${approved ? 'approved' : 'rejected'}.`);
      loadVerificationQueue();
      loadMerchants();
    } catch (error) {
      console.error('Failed to batch verify:', error);
      setErrorMessage('Failed to batch verify merchants.');
    } finally {
      setLoading(false);
    }
  };

  const getReputationLabel = (score: number): { label: string; className: string } => {
    if (score >= 80) return { label: 'High', className: 'text-green-600' };
    if (score >= 60) return { label: 'Medium', className: 'text-yellow-600' };
    return { label: 'Low', className: 'text-red-600' };
  };

  const getMerchantStatusLabel = (merchant: Merchant) => {
    if (!merchant.isActive) return { text: 'Inactive', className: 'bg-gray-100 text-gray-800' };
    if (!merchant.isVerified) return { text: 'Pending', className: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Verified', className: 'bg-green-100 text-green-800' };
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-4 py-2 z-50">
        Skip to main content
      </a>

      {/* Live regions */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{statusMessage}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{errorMessage}</div>

      <main id="main-content">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Merchant Network</h1>
          <p className="text-gray-600 mb-6">Local merchant onboarding and GPS-verified payment acceptance</p>

          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-800">{errorMessage}</div>
          )}
          {statusMessage && (
            <div role="status" className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-800">{statusMessage}</div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowOnboardingForm(v => !v)}
              aria-expanded={showOnboardingForm}
              aria-controls="onboarding-form"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {showOnboardingForm ? 'Hide Onboarding Form' : 'Onboard Merchant'}
            </button>
            <button
              onClick={loadMerchants}
              disabled={loading}
              aria-disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Search Location
            </button>
            {verificationQueue.length > 0 && (
              <button
                onClick={() => handleBatchVerify(true)}
                disabled={loading}
                aria-disabled={loading}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                aria-label={`Approve all ${verificationQueue.length} merchants in queue`}
              >
                Approve All ({verificationQueue.length})
              </button>
            )}
          </div>

          {/* Onboarding Form */}
          <section
            id="onboarding-form"
            aria-label="Onboard New Merchant"
            hidden={!showOnboardingForm}
            className="bg-blue-50 p-6 rounded-lg mb-6"
          >
            <h2 className="text-xl font-semibold mb-4">Onboard New Merchant</h2>
            <form onSubmit={handleOnboarding} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-merchant-id" className="block text-sm font-medium text-gray-700 mb-1">Merchant ID <span aria-hidden="true">*</span></label>
                  <input id="ob-merchant-id" type="text" value={onboardingForm.merchantId}
                    onChange={e => setOnboardingForm({ ...onboardingForm, merchantId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="ob-name" className="block text-sm font-medium text-gray-700 mb-1">Business Name <span aria-hidden="true">*</span></label>
                  <input id="ob-name" type="text" value={onboardingForm.name}
                    onChange={e => setOnboardingForm({ ...onboardingForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-business-type" className="block text-sm font-medium text-gray-700 mb-1">Business Type <span aria-hidden="true">*</span></label>
                  <select id="ob-business-type" value={onboardingForm.businessType}
                    onChange={e => setOnboardingForm({ ...onboardingForm, businessType: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true">
                    <option value="grocery">Grocery Store</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="hardware">Hardware Store</option>
                    <option value="fuel_station">Fuel Station</option>
                    <option value="clothing">Clothing Store</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="transport">Transport</option>
                    <option value="communication">Communication</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ob-contact" className="block text-sm font-medium text-gray-700 mb-1">Contact Information <span aria-hidden="true">*</span></label>
                  <input id="ob-contact" type="text" value={onboardingForm.contactInfo}
                    onChange={e => setOnboardingForm({ ...onboardingForm, contactInfo: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-stellar" className="block text-sm font-medium text-gray-700 mb-1">Stellar Address <span aria-hidden="true">*</span></label>
                  <input id="ob-stellar" type="text" value={onboardingForm.stellarAddress}
                    onChange={e => setOnboardingForm({ ...onboardingForm, stellarAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="ob-tokens" className="block text-sm font-medium text-gray-700 mb-1">Accepted Tokens</label>
                  <input id="ob-tokens" type="text" value={onboardingForm.acceptedTokens}
                    onChange={e => setOnboardingForm({ ...onboardingForm, acceptedTokens: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-describedby="ob-tokens-hint" />
                  <p id="ob-tokens-hint" className="text-xs text-gray-500 mt-1">Comma-separated, e.g. XLM, USDC</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-daily-limit" className="block text-sm font-medium text-gray-700 mb-1">Daily Limit <span aria-hidden="true">*</span></label>
                  <input id="ob-daily-limit" type="number" value={onboardingForm.dailyLimit} min="0"
                    onChange={e => setOnboardingForm({ ...onboardingForm, dailyLimit: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
                <div>
                  <label htmlFor="ob-monthly-limit" className="block text-sm font-medium text-gray-700 mb-1">Monthly Limit <span aria-hidden="true">*</span></label>
                  <input id="ob-monthly-limit" type="number" value={onboardingForm.monthlyLimit} min="0"
                    onChange={e => setOnboardingForm({ ...onboardingForm, monthlyLimit: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required aria-required="true" />
                </div>
              </div>

              <fieldset className="border-t pt-4">
                <legend className="font-semibold mb-2">Location Information</legend>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ob-lat" className="block text-sm font-medium text-gray-700 mb-1">Latitude <span aria-hidden="true">*</span></label>
                    <input id="ob-lat" type="number" step="any" value={onboardingForm.location.latitude}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, latitude: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required aria-required="true" />
                  </div>
                  <div>
                    <label htmlFor="ob-lng" className="block text-sm font-medium text-gray-700 mb-1">Longitude <span aria-hidden="true">*</span></label>
                    <input id="ob-lng" type="number" step="any" value={onboardingForm.location.longitude}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, longitude: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required aria-required="true" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label htmlFor="ob-address" className="block text-sm font-medium text-gray-700 mb-1">Address <span aria-hidden="true">*</span></label>
                    <input id="ob-address" type="text" value={onboardingForm.location.address}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, address: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required aria-required="true" />
                  </div>
                  <div>
                    <label htmlFor="ob-city" className="block text-sm font-medium text-gray-700 mb-1">City <span aria-hidden="true">*</span></label>
                    <input id="ob-city" type="text" value={onboardingForm.location.city}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, city: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required aria-required="true" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <label htmlFor="ob-country" className="block text-sm font-medium text-gray-700 mb-1">Country <span aria-hidden="true">*</span></label>
                    <input id="ob-country" type="text" value={onboardingForm.location.country}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, country: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required aria-required="true" />
                  </div>
                  <div>
                    <label htmlFor="ob-postal" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input id="ob-postal" type="text" value={onboardingForm.location.postalCode}
                      onChange={e => setOnboardingForm({ ...onboardingForm, location: { ...onboardingForm.location, postalCode: e.target.value } })}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </fieldset>

              <div className="flex gap-4">
                <button type="submit" disabled={loading} aria-disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50">
                  {loading ? 'Onboarding…' : 'Onboard Merchant'}
                </button>
                <button type="button" onClick={() => setShowOnboardingForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                  Cancel
                </button>
              </div>
            </form>
          </section>

          {/* Location Search */}
          <section aria-label="Location Search" className="bg-gray-50 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Search Location</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-32">
                <label htmlFor="search-lat" className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input id="search-lat" type="number" step="any" value={mapCenter.lat}
                  onChange={e => setMapCenter({ ...mapCenter, lat: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1 min-w-32">
                <label htmlFor="search-lng" className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input id="search-lng" type="number" step="any" value={mapCenter.lng}
                  onChange={e => setMapCenter({ ...mapCenter, lng: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="w-32">
                <label htmlFor="search-radius" className="block text-sm font-medium text-gray-700 mb-1">Radius (km)</label>
                <input id="search-radius" type="number" value={searchRadius} min="1"
                  onChange={e => setSearchRadius(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>

          {/* Verification Queue */}
          {verificationQueue.length > 0 && (
            <section aria-label="Merchant Verification Queue" className="bg-yellow-50 p-4 rounded-lg mb-6">
              <h2 className="text-lg font-semibold mb-2">
                Verification Queue
                <span className="ml-2 text-sm font-normal text-gray-600">({verificationQueue.length} pending)</span>
              </h2>
              <ul className="space-y-2" aria-label="Merchants awaiting verification">
                {verificationQueue.map(merchantId => (
                  <li key={merchantId} className="flex items-center justify-between bg-white p-3 rounded border">
                    <span className="font-medium">{merchantId}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerifyMerchant(merchantId, true)}
                        disabled={loading}
                        aria-disabled={loading}
                        className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 disabled:opacity-50"
                        aria-label={`Approve merchant ${merchantId}`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleVerifyMerchant(merchantId, false)}
                        disabled={loading}
                        aria-disabled={loading}
                        className="bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50"
                        aria-label={`Reject merchant ${merchantId}`}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Merchants List */}
          <section aria-label="Active Merchants">
            <h2 className="text-xl font-semibold mb-4">
              Active Merchants
              {!loading && <span className="ml-2 text-sm font-normal text-gray-600">({merchants.length} found)</span>}
            </h2>

            {loading && (
              <div role="status" aria-live="polite" className="text-center py-4">
                <span className="sr-only">Loading merchants, please wait.</span>
                <span aria-hidden="true">Loading…</span>
              </div>
            )}

            {!loading && merchants.length === 0 && (
              <p className="text-gray-500 text-center py-4">No merchants found in this area.</p>
            )}

            {!loading && merchants.length > 0 && (
              <ul className="grid gap-4" aria-label="Merchants list">
                {merchants.map(merchant => {
                  const status = getMerchantStatusLabel(merchant);
                  const reputation = getReputationLabel(merchant.reputationScore);
                  const detailsRef = React.createRef<HTMLButtonElement>();
                  return (
                    <li key={merchant.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{merchant.name}</h3>
                          <p className="text-gray-600">{merchant.businessType}</p>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">ID: </dt><dd className="inline">{merchant.id}</dd></div>
                            <div><dt className="inline font-bold">Address: </dt><dd className="inline">{merchant.location.address}</dd></div>
                            <div><dt className="inline font-bold">City: </dt><dd className="inline">{merchant.location.city}, {merchant.location.country}</dd></div>
                            <div><dt className="inline font-bold">Contact: </dt><dd className="inline">{merchant.contactInfo}</dd></div>
                            <div><dt className="inline font-bold">Registered: </dt><dd className="inline">{formatDate(merchant.registrationDate)}</dd></div>
                            <div><dt className="inline font-bold">Accepted Tokens: </dt><dd className="inline">{merchant.acceptedTokens.join(', ')}</dd></div>
                          </dl>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${reputation.className}`}
                            aria-label={`Reputation score: ${merchant.reputationScore} out of 100 (${reputation.label})`}
                          >
                            Reputation: {merchant.reputationScore}/100
                          </p>
                          <div className="mt-2">
                            <span
                              className={`px-2 py-1 rounded text-xs ${status.className}`}
                              aria-label={`Status: ${status.text}`}
                            >
                              {status.text}
                            </span>
                          </div>
                          <dl className="mt-2 space-y-1 text-sm">
                            <div><dt className="inline font-bold">Daily Limit: </dt><dd className="inline">{merchant.dailyLimit}</dd></div>
                            <div><dt className="inline font-bold">Monthly: </dt><dd className="inline">{merchant.monthlyLimit}</dd></div>
                            <div><dt className="inline font-bold">Current: </dt><dd className="inline">{merchant.currentMonthVolume}</dd></div>
                          </dl>
                          <div className="mt-4 flex gap-2 justify-end">
                            <button
                              ref={detailsRef}
                              onClick={() => { openModalTriggerRef.current = detailsRef.current; setSelectedMerchant(merchant); }}
                              className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                              aria-label={`View details for ${merchant.name}`}
                            >
                              Details
                            </button>
                            <button
                              onClick={() => merchantClient.generateMerchantQRCode(merchant.id, merchant)}
                              className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1"
                              aria-label={`Generate QR code for ${merchant.name}`}
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

      {/* Merchant Details Modal */}
      {selectedMerchant && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="merchant-modal-title"
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto"
          >
            <h2 id="merchant-modal-title" className="text-2xl font-bold mb-4">{selectedMerchant.name}</h2>

            <div className="space-y-4">
              <section aria-label="Business Information">
                <h3 className="font-semibold">Business Information</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">ID:</dt><dd>{selectedMerchant.id}</dd></div>
                  <div><dt className="font-bold">Type:</dt><dd>{selectedMerchant.businessType}</dd></div>
                  <div><dt className="font-bold">Status:</dt><dd>{selectedMerchant.isVerified ? 'Verified' : 'Pending'}</dd></div>
                  <div><dt className="font-bold">Reputation:</dt><dd>{selectedMerchant.reputationScore}/100</dd></div>
                  <div><dt className="font-bold">Owner:</dt><dd>{selectedMerchant.owner}</dd></div>
                  <div><dt className="font-bold">Registered:</dt><dd>{formatDate(selectedMerchant.registrationDate)}</dd></div>
                </dl>
              </section>

              <section aria-label="Location">
                <h3 className="font-semibold">Location</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  <div><dt className="inline font-bold">Address: </dt><dd className="inline">{selectedMerchant.location.address}</dd></div>
                  <div><dt className="inline font-bold">City: </dt><dd className="inline">{selectedMerchant.location.city}</dd></div>
                  <div><dt className="inline font-bold">Country: </dt><dd className="inline">{selectedMerchant.location.country}</dd></div>
                  <div><dt className="inline font-bold">Postal: </dt><dd className="inline">{selectedMerchant.location.postalCode}</dd></div>
                  <div>
                    <dt className="inline font-bold">Coordinates: </dt>
                    <dd className="inline">
                      <span aria-label={`Latitude ${selectedMerchant.location.latitude}, Longitude ${selectedMerchant.location.longitude}`}>
                        {selectedMerchant.location.latitude}, {selectedMerchant.location.longitude}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-label="Financial Limits">
                <h3 className="font-semibold">Financial Limits</h3>
                <dl className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div><dt className="font-bold">Daily Limit:</dt><dd>{selectedMerchant.dailyLimit}</dd></div>
                  <div><dt className="font-bold">Monthly Limit:</dt><dd>{selectedMerchant.monthlyLimit}</dd></div>
                  <div><dt className="font-bold">Current Volume:</dt><dd>{selectedMerchant.currentMonthVolume}</dd></div>
                  <div>
                    <dt className="font-bold">Monthly Utilization:</dt>
                    <dd>
                      <span aria-label={`${Math.round((parseInt(selectedMerchant.currentMonthVolume) / parseInt(selectedMerchant.monthlyLimit)) * 100)}% of monthly limit used`}>
                        {Math.round((parseInt(selectedMerchant.currentMonthVolume) / parseInt(selectedMerchant.monthlyLimit)) * 100)}%
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-label="Payment Information">
                <h3 className="font-semibold">Accepted Tokens</h3>
                <ul className="flex flex-wrap gap-2 mt-2" aria-label="Accepted payment tokens">
                  {selectedMerchant.acceptedTokens.map((token, index) => (
                    <li key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{token}</li>
                  ))}
                </ul>
                {selectedMerchant.stellarTomlUrl && (
                  <p className="mt-2 text-sm">
                    <strong>Stellar TOML:</strong>{' '}
                    <a href={selectedMerchant.stellarTomlUrl} className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500" target="_blank" rel="noopener noreferrer">
                      {selectedMerchant.stellarTomlUrl}
                    </a>
                  </p>
                )}
              </section>

              <section aria-label="Actions">
                <h3 className="font-semibold mb-2">Actions</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const feedback = window.prompt('Enter feedback score (-10 to +10):');
                      if (feedback !== null) {
                        merchantClient.updateReputation(adminKey, selectedMerchant.id, parseInt(feedback));
                        setStatusMessage('Reputation updated.');
                      }
                    }}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
                    aria-label={`Update reputation for ${selectedMerchant.name}`}
                  >
                    Update Reputation
                  </button>
                  <button
                    onClick={() => merchantClient.getMerchantTransactions(selectedMerchant.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    aria-label={`View transactions for ${selectedMerchant.name}`}
                  >
                    View Transactions
                  </button>
                </div>
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
