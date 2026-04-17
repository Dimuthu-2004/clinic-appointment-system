import axios from 'axios';

const FALLBACK_API_URL = 'http://localhost:5000/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

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

export const extractErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message || fallback;

export default api;
