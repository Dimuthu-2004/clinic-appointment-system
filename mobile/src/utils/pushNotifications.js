import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';

const PUSH_TOKEN_STORAGE_KEY = 'clinic-expo-push-token';

const isRunningInExpoGo = () =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

const loadNotificationsModule = async () => {
  if (isRunningInExpoGo()) {
    return null;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  return Notifications;
};

const getProjectId = () =>
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.expoConfig?.extra?.projectId ||
  null;

export const registerDeviceForPushNotifications = async () => {
  if (!Device.isDevice || isRunningInExpoGo()) {
    return null;
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Smart Clinic updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0E7490',
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResponse.data;

    await api.post('/notifications/push-token', {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName || Device.modelName || '',
    });
    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);

    return token;
  } catch (error) {
    console.warn('Push notification registration failed:', error?.message || error);
    return null;
  }
};

export const unregisterDevicePushToken = async () => {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);

  if (!token) {
    return;
  }

  try {
    await api.delete('/notifications/push-token', {
      data: { token },
    });
  } catch (error) {
    console.warn('Push notification unregister failed:', error?.message || error);
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
  }
};
