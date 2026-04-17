import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, useTheme } from '../theme';
import { formatDateTime } from '../utils/date';

export default function AlertListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const canManage = user?.role === 'admin';
  const isFocused = useIsFocused();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        const response = await api.get('/alerts');
        setAlerts(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load alerts', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadAlerts();
    }
  }, [isFocused]);

  if (loading) {
    return <LoadingOverlay message="Loading alerts..." />;
  }

  const formatAgeRange = (alertItem) => {
    const minAge = alertItem.minAge ?? alertItem.ageLimit ?? null;
    const maxAge = alertItem.maxAge ?? null;

    if (minAge === null && maxAge === null) {
      return 'All ages';
    }

    return `${minAge ?? 'Any'} - ${maxAge ?? 'Any'}`;
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>Alerts</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            {user?.role === 'admin'
              ? 'Create targeted health alerts that become patient notifications.'
              : 'Clinic health alerts sent by the admin team.'}
          </Text>
        </View>
        {canManage ? <AppButton title="New" onPress={() => navigation.navigate('AlertForm')} /> : null}
      </View>

      {alerts.length === 0 ? (
        <EmptyState
          message={user?.role === 'admin' ? 'No alerts have been created yet.' : 'No clinic alerts are available right now.'}
          title="No alerts found"
        />
      ) : (
        alerts.map((alertItem) => (
          <EntityCard
            key={alertItem._id}
            meta={
              user?.role === 'admin'
                ? [
                    `Recipients: ${alertItem.notificationsSentCount || alertItem.targetedPatients?.length || 0}`,
                    `Age range: ${formatAgeRange(alertItem)}`,
                    `Condition filter: ${alertItem.targetCondition || 'All patients'}`,
                    `Created: ${formatDateTime(alertItem.createdAt)}`,
                  ]
                : [
                    `Published: ${formatDateTime(alertItem.createdAt)}`,
                    `Targeting: ${formatAgeRange(alertItem)}${alertItem.targetCondition ? `, ${alertItem.targetCondition}` : ''}`,
                  ]
            }
            onPress={() => navigation.navigate('AlertForm', { alertItem })}
            status={alertItem.status}
            subtitle={alertItem.message}
            title={alertItem.title}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 22,
  },
});
