import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BeneficiaryProfile,
  NetworkConfig,
  BeneficiarySearchOptions,
  PaginationCursor,
} from '../../../sdk/src/types';
import { BeneficiaryClient } from '../../../sdk/src/beneficiaryClient';

const PAGE_SIZE = 20;
const DISASTER_ID = 'sample_disaster_001';

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
  const [error, setError] = useState<string | null>(null);

  // Search / filter state
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [minTrustScore, setMinTrustScore] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (opts: BeneficiarySearchOptions, append: boolean) => {
      try {
        append ? setLoadingMore(true) : setLoading(true);
        setError(null);
        const page = await beneficiaryClient.searchBeneficiaries(DISASTER_ID, opts);
        setBeneficiaries(prev => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load beneficiaries');
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Beneficiary Registry</h1>

        {/* Search & Filter Bar */}
        <div
          className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3"
          role="search"
          aria-label="Search and filter beneficiaries"
        >
          <div className="flex gap-3 flex-wrap">
            <input
              type="search"
              aria-label="Search by name or ID"
              placeholder="Search by name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border rounded"
            />
            <input
              type="text"
              aria-label="Filter by location"
              placeholder="Filter by location…"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-4 flex-wrap items-center">
            <label className="flex items-center gap-2 text-sm">
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

        {/* Results */}
        {loading ? (
          <p aria-live="polite" className="text-center py-8 text-gray-500">
            Loading beneficiaries…
          </p>
        ) : beneficiaries.length === 0 ? (
          <p aria-live="polite" className="text-center py-8 text-gray-500">
            No beneficiaries found
          </p>
        ) : (
          <>
            <div className="grid gap-4">
              {beneficiaries.map(b => (
                <div
                  key={b.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
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

            <div className="mt-6 text-center">
              {hasMore ? (
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
