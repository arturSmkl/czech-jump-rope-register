/**
 * Address validation service using the RUIAN API.
 * Caches results to avoid exceeding the rate limit (1000 req/hour).
 */

import { errorStore } from '@/stores/errorStore';

const RUIAN_API_KEY = import.meta.env.VITE_RUIAN_API_KEY;
const RUIAN_BASE_URL = 'https://ruian.fnx.io/api/v1/ruian/validate';

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
 * Validate an address against the RUIAN API.
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

  if (!RUIAN_API_KEY) {
    console.warn('RUIAN API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append('apiKey', RUIAN_API_KEY);
    if (address.township) params.append('municipalityName', address.township);
    if (address.zip_code) params.append('zip', address.zip_code);
    if (address.house_number) params.append('cp', address.house_number);
    if (address.street) params.append('street', address.street);

    const response = await fetch(`${RUIAN_BASE_URL}?${params.toString()}`, {
      method: 'GET'
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

    // status: "MATCH" = exact match, "POSSIBLE" = close match, "NOT_FOUND" / "ERROR" = invalid
    const isValid = data && (data.status === 'MATCH' || data.status === 'POSSIBLE');

    addressCache.set(key, { valid: isValid, timestamp: Date.now() });
    return isValid;
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
