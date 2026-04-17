import * as SecureStore from 'expo-secure-store';
import { createContext, useEffect, useRef, useState } from 'react';
import api, { extractErrorMessage, setAuthToken } from '../api/client';
import { registerDeviceForPushNotifications, unregisterDevicePushToken } from '../utils/pushNotifications';

const STORAGE_KEY = 'clinic-auth-session';
const PENDING_BOOKING_KEY = 'clinic-pending-booking';
const POST_AUTH_DESTINATION_KEY = 'clinic-post-auth-destination';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingAppointmentBooking, setPendingAppointmentBooking] = useState(null);
  const [postAuthDestination, setPostAuthDestination] = useState('');
  const registeredPushUserIdRef = useRef('');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [sessionString, pendingBookingString, savedPostAuthDestination] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEY),
          SecureStore.getItemAsync(PENDING_BOOKING_KEY),
          SecureStore.getItemAsync(POST_AUTH_DESTINATION_KEY),
        ]);

        if (pendingBookingString) {
          setPendingAppointmentBooking(JSON.parse(pendingBookingString));
        }

        if (savedPostAuthDestination) {
          setPostAuthDestination(savedPostAuthDestination);
        }

        if (!sessionString) {
          setLoading(false);
          return;
        }

        const session = JSON.parse(sessionString);
        setAuthToken(session.token);
        setToken(session.token);
        setUser(session.user);

        const response = await api.get('/auth/me');
        setUser(response.data.data);
      } catch (_error) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!user?._id || !token || registeredPushUserIdRef.current === user._id) {
      return;
    }

    registeredPushUserIdRef.current = user._id;
    registerDeviceForPushNotifications();
  }, [token, user?._id]);

  const persistSession = async (session) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
    setAuthToken(session.token);
    setToken(session.token);
    setUser(session.user);
  };

  const persistPendingAppointmentBooking = async (bookingDraft) => {
    await SecureStore.setItemAsync(PENDING_BOOKING_KEY, JSON.stringify(bookingDraft));
    setPendingAppointmentBooking(bookingDraft);
  };

  const clearPendingAppointmentBooking = async () => {
    await SecureStore.deleteItemAsync(PENDING_BOOKING_KEY);
    setPendingAppointmentBooking(null);
  };

  const persistPostAuthDestination = async (destination) => {
    if (!destination) {
      await SecureStore.deleteItemAsync(POST_AUTH_DESTINATION_KEY);
      setPostAuthDestination('');
      return;
    }

    await SecureStore.setItemAsync(POST_AUTH_DESTINATION_KEY, destination);
    setPostAuthDestination(destination);
  };

  const startAppointmentBookingAuthFlow = async (bookingDraft) => {
    await persistPendingAppointmentBooking(bookingDraft);
    await persistPostAuthDestination('resume-appointment-booking');
  };

  const consumePostAuthDestination = async () => {
    await persistPostAuthDestination('');
  };

  const signIn = async (values) => {
    const response = await api.post('/auth/login', {
      ...values,
      email: String(values.email || '').trim().toLowerCase(),
    });
    await persistSession(response.data.data);
  };

  const signUp = async (registrationType, values) => {
    const endpointMap = {
      patient: '/auth/register/patient',
      doctor: '/auth/register/doctor',
      staff: '/auth/register/staff',
    };

    const response = await api.post(endpointMap[registrationType] || endpointMap.patient, {
      ...values,
      email: String(values.email || '').trim().toLowerCase(),
    });
    await persistSession(response.data.data);
  };

  const signOut = async () => {
    await unregisterDevicePushToken();
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
    registeredPushUserIdRef.current = '';
  };

  const refreshProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const nextUser = response.data.data;
      setUser(nextUser);

      if (token) {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ token, user: nextUser }));
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Failed to refresh profile'));
    }
  };

  const updateProfile = async (values) => {
    const payload = {
      ...values,
      ...(values.email !== undefined
        ? { email: String(values.email || '').trim().toLowerCase() }
        : {}),
    };

    const response = await api.patch('/auth/me', payload);
    const nextUser = response.data.data;
    setUser(nextUser);

    if (token) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ token, user: nextUser }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user && token),
        pendingAppointmentBooking,
        postAuthDestination,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
        startAppointmentBookingAuthFlow,
        clearPendingAppointmentBooking,
        consumePostAuthDestination,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
