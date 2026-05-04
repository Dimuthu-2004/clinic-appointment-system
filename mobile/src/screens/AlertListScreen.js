import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

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

  const filteredAlerts = [...alerts]
    .filter((alertItem) => {
      const searchValue = search.trim().toLowerCase();

      if (!searchValue) {
        return true;
      }

      return [
        alertItem.title,
        alertItem.message,
        alertItem.status,
        alertItem.targetCondition,
        alertItem.sendEmailNotifications ? 'email' : 'in-app',
      ].some((value) => String(value || '').toLowerCase().includes(searchValue));
    })
    .sort((left, right) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case 'title':
          return String(left.title || '').localeCompare(String(right.title || ''));
        case 'recipients':
          return (right.notificationsSentCount || right.targetedPatients?.length || 0) - (left.notificationsSentCount || left.targetedPatients?.length || 0);
        case 'status':
          return String(left.status || '').localeCompare(String(right.status || ''));
        case 'newest':
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });

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

      <AppInput
        label="Search alerts"
        onChangeText={setSearch}
        placeholder="Search title, message, status, or condition"
        value={search}
      />
      <AppSelect
        items={[
          { label: 'Newest first', value: 'newest' },
          { label: 'Oldest first', value: 'oldest' },
          { label: 'Title A-Z', value: 'title' },
          { label: 'Most recipients', value: 'recipients' },
          { label: 'Status', value: 'status' },
        ]}
        label="Sort alerts"
        onValueChange={setSortBy}
        value={sortBy}
      />

      {filteredAlerts.length === 0 ? (
        <EmptyState
          message={search ? 'No alerts matched that search.' : user?.role === 'admin' ? 'No alerts have been created yet.' : 'No clinic alerts are available right now.'}
          title="No alerts found"
        />
      ) : (
        filteredAlerts.map((alertItem) => (
          <EntityCard
            key={alertItem._id}
            meta={
              user?.role === 'admin'
                ? [
                    `Audience: ${alertItem.sendToAll ? 'All users' : 'Targeted users'}`,
                    `Recipients: ${alertItem.notificationsSentCount || alertItem.targetedPatients?.length || 0}`,
                    `Age range: ${formatAgeRange(alertItem)}`,
                    `Condition filter: ${alertItem.sendToAll ? 'All users' : alertItem.targetCondition || 'All patients'}`,
                    `Delivery: ${alertItem.sendEmailNotifications ? 'In-app + email' : 'In-app only'}`,
                    `Closes: ${alertItem.endsAt ? formatDateTime(alertItem.endsAt) : 'No closing time'}`,
                    `Created: ${formatDateTime(alertItem.createdAt)}`,
                  ]
                : [
                    `Published: ${formatDateTime(alertItem.createdAt)}`,
                    `Closes: ${alertItem.endsAt ? formatDateTime(alertItem.endsAt) : 'No closing time'}`,
                    `Targeting: ${alertItem.sendToAll ? 'All users' : `${formatAgeRange(alertItem)}${alertItem.targetCondition ? `, ${alertItem.targetCondition}` : ''}`}`,
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
