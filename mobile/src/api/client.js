import axios from 'axios';

const FALLBACK_API_URL = 'http://localhost:5000/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;

let authToken = null;
let authFailureHandler = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;
export const setAuthFailureHandler = (handler) => {
  authFailureHandler = handler;
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && authToken && typeof authFailureHandler === 'function') {
      await authFailureHandler(error);
    }

    return Promise.reject(error);
  }
);

export const extractErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || fallback;

export default api;
