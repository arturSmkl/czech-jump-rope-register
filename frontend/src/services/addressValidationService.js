/**
 * Address validation service using the RUIAN API (proxied through the backend).
 * Caches results to avoid exceeding the rate limit (1000 req/hour).
 */

import { getAuth } from 'firebase/auth';
import { errorStore } from '@/stores/errorStore';

const API_URL = import.meta.env.VITE_API_URL;

// Cache: key = serialized address -> { valid: boolean, timestamp: number }
const addressCache = new Map();

/**
 * Build a cache key from address fields.
 */
function cacheKey(address) {
  if (!address) return '';
  const parts = [
    address.street || '',
    address.house_number || '',
    address.zip_code || '',
    address.township || '',
    address.country || ''
  ];
  return parts.join('|').toLowerCase().trim();
}

/**
 * Check if an address has enough fields to be worth validating.
 */
function hasValidatableAddress(address) {
  if (!address) return false;
  // Need at least township or street to validate
  return !!(address.township || address.street);
}

/**
 * Validate an address against the RUIAN API (via backend proxy).
 * Returns: true (valid), false (invalid), null (cannot validate / no data).
 * Results are cached to avoid exceeding the rate limit.
 *
 * @param {Object} address - { street, house_number, zip_code, township, country }
 * @returns {Promise<boolean|null>}
 */
export async function validateAddress(address) {
  if (!address || !hasValidatableAddress(address)) return null;

  // Only validate Czech addresses (or addresses with no country specified)
  const country = (address.country || '').toLowerCase().trim();
  if (country && country !== 'cz' && country !== 'česko' && country !== 'česká republika' && country !== 'czech republic' && country !== 'czk') {
    return null; // Can't validate non-Czech addresses with RUIAN
  }

  const key = cacheKey(address);
  if (!key || key === '||||') return null;

  // Check cache
  if (addressCache.has(key)) {
    return addressCache.get(key).valid;
  }

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();

    const params = new URLSearchParams();
    if (address.township) params.append('township', address.township);
    if (address.zip_code) params.append('zip_code', address.zip_code);
    if (address.house_number) params.append('house_number', address.house_number);
    if (address.street) params.append('street', address.street);

    const response = await fetch(`${API_URL}/validate-address?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 429) {
        errorStore.setError('RÚIAN API: překročen limit požadavků (1000/hod). Zkuste to později.');
        return null;
      }
      errorStore.setError(`RÚIAN API: chyba ${response.status}`);
      return null;
    }

    const data = await response.json();
    addressCache.set(key, { valid: data.valid, timestamp: Date.now() });
    return data.valid;
  } catch (err) {
    errorStore.setError('RÚIAN API: ověření adresy selhalo — ' + err.message);
    return null;
  }
}

/**
 * Get cached validation result for an address (no API call).
 * Returns: true (valid), false (invalid), undefined (not cached).
 */
export function getCachedAddressValidation(address) {
  if (!address || !hasValidatableAddress(address)) return undefined;
  const key = cacheKey(address);
  if (addressCache.has(key)) {
    return addressCache.get(key).valid;
  }
  return undefined;
}

/**
 * Clear the address validation cache.
 */
export function clearAddressCache() {
  addressCache.clear();
}
