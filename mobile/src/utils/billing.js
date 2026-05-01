import { Alert, Linking } from 'react-native';
import { getApiBaseUrl, getAuthToken } from '../api/client';

export const openBillingInvoice = async (billingId) => {
  const token = getAuthToken();

  if (!billingId || !token) {
    Alert.alert('Bill unavailable', 'Unable to open the bill right now.');
    return;
  }

  const invoiceUrl = `${getApiBaseUrl()}/billings/${billingId}/invoice.pdf?token=${encodeURIComponent(token)}`;
  await Linking.openURL(invoiceUrl);
};
