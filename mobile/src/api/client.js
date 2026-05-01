import axios from 'axios';
import { Platform } from 'react-native';

const DEFAULT_LOCAL_API_URL = 'http://localhost:5000/api';
const DEFAULT_BROWSER_LOCAL_API_URL = 'http://127.0.0.1:5000/api';

const normalizeApiUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const shouldPreferBrowserLoopback =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(String(window.location?.hostname || '').toLowerCase());

const configuredApiUrls = shouldPreferBrowserLoopback
  ? [DEFAULT_BROWSER_LOCAL_API_URL]
  : [
      process.env.EXPO_PUBLIC_API_URL,
      process.env.EXPO_PUBLIC_API_FALLBACK_URL,
      DEFAULT_LOCAL_API_URL,
    ]
      .map(normalizeApiUrl)
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index);

let activeApiUrl = configuredApiUrls[0] || DEFAULT_LOCAL_API_URL;
let apiResolutionPromise = null;
let apiUrlResolved = shouldPreferBrowserLoopback;
let authToken = null;
let authFailureHandler = null;

const buildHealthUrl = (apiUrl) => `${normalizeApiUrl(apiUrl)}/health`;

const probeApiUrl = async (apiUrl, timeoutMs = 2500) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildHealthUrl(apiUrl), {
      method: 'GET',
      signal: controller.signal,
    });

    return response.ok;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

const chooseReachableApiUrl = async (candidates = configuredApiUrls) => {
  for (const apiUrl of candidates) {
    // Prefer a backend that answers the health check so local/deployed switching
    // works without hand-editing the client code every time.
    if (await probeApiUrl(apiUrl)) {
      return apiUrl;
    }
  }

  return candidates[0] || activeApiUrl || DEFAULT_LOCAL_API_URL;
};

const setActiveApiUrl = (apiUrl) => {
  activeApiUrl = normalizeApiUrl(apiUrl) || DEFAULT_LOCAL_API_URL;
  apiUrlResolved = true;
  api.defaults.baseURL = activeApiUrl;
  return activeApiUrl;
};

const ensureActiveApiUrl = async ({ force = false } = {}) => {
  if (!force && apiUrlResolved && api.defaults.baseURL) {
    return api.defaults.baseURL;
  }

  if (!apiResolutionPromise) {
    apiResolutionPromise = chooseReachableApiUrl()
      .then((apiUrl) => setActiveApiUrl(apiUrl))
      .finally(() => {
        apiResolutionPromise = null;
      });
  }

  return apiResolutionPromise;
};

const failoverApiUrl = async (failedApiUrl) => {
  const remainingUrls = configuredApiUrls.filter((apiUrl) => apiUrl !== normalizeApiUrl(failedApiUrl));

  if (!remainingUrls.length) {
    return setActiveApiUrl(failedApiUrl);
  }

  const nextApiUrl = await chooseReachableApiUrl(remainingUrls);
  return setActiveApiUrl(nextApiUrl);
};

const canRetryOnAlternateApi = (config = {}) => {
  const method = String(config.method || 'get').toLowerCase();
  return ['get', 'head', 'options'].includes(method);
};

export const API_URL = activeApiUrl;
export const getApiBaseUrl = () => activeApiUrl;
export const getFileBaseUrl = () => getApiBaseUrl().replace(/\/api$/, '');
export const getConfiguredApiUrls = () => [...configuredApiUrls];
export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;
export const setAuthFailureHandler = (handler) => {
  authFailureHandler = handler;
};

const api = axios.create({
  baseURL: activeApiUrl,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const resolvedBaseUrl = await ensureActiveApiUrl();
  config.baseURL = resolvedBaseUrl;

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestConfig = error?.config || {};
    const failedBaseUrl = requestConfig.baseURL || activeApiUrl;

    if (!error?.response && configuredApiUrls.length > 1) {
      const nextApiUrl = await failoverApiUrl(failedBaseUrl);

      if (canRetryOnAlternateApi(requestConfig) && !requestConfig._apiFailoverRetried && nextApiUrl !== failedBaseUrl) {
        requestConfig._apiFailoverRetried = true;
        requestConfig.baseURL = nextApiUrl;
        return api.request(requestConfig);
      }
    }

    if (error?.response?.status === 401 && authToken && typeof authFailureHandler === 'function') {
      await authFailureHandler(error);
    }

    return Promise.reject(error);
  }
);

export const extractErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || fallback;

export default api;
