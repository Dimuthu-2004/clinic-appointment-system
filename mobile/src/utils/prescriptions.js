import { Alert, Linking } from 'react-native';
import { getApiBaseUrl, getAuthToken } from '../api/client';

export const openPrescriptionPdf = async (prescriptionId) => {
  const token = getAuthToken();

  if (!prescriptionId || !token) {
    Alert.alert('Prescription unavailable', 'Unable to open the prescription right now.');
    return;
  }

  const prescriptionUrl = `${getApiBaseUrl()}/prescriptions/${prescriptionId}/pdf?token=${encodeURIComponent(token)}`;
  await Linking.openURL(prescriptionUrl);
};
