import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppSelect from '../components/AppSelect';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { colors, spacing, useTheme } from '../theme';
import { formatDateTime } from '../utils/date';

const roleOptions = [
  { label: 'All roles', value: '' },
  { label: 'Patient', value: 'patient' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Finance Manager', value: 'finance_manager' },
  { label: 'Pharmacist', value: 'pharmacist' },
  { label: 'Admin', value: 'admin' },
];

export default function UserManagementScreen({ navigation }) {
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const query = roleFilter ? `?role=${roleFilter}` : '';
        const response = await api.get(`/users${query}`);
        setUsers(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load users', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadUsers();
    }
  }, [isFocused, roleFilter]);

  if (loading) {
    return <LoadingOverlay message="Loading user management..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>Users</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            Review registered accounts by role, open their details, and delete accounts when necessary with a confirmation prompt.
          </Text>
        </View>
      </View>

      <AppSelect items={roleOptions} label="Filter by role" onValueChange={setRoleFilter} value={roleFilter} />

      {users.length === 0 ? (
        <EmptyState title="No users found" message="No user accounts matched the current filter." />
      ) : (
        users.map((account) => (
          <EntityCard
            key={account._id}
            title={`${account.firstName} ${account.lastName}`}
            subtitle={account.email}
            status={account.role === 'admin' ? 'confirmed' : 'active'}
            meta={[
              `Role: ${String(account.role).replace(/_/g, ' ')}`,
              `Phone: ${account.phone || 'Not set'}`,
              `Last login: ${account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Not logged in yet'}`,
              ...(account.role === 'doctor' && account.specialization
                ? [`Specialization: ${account.specialization}`]
                : []),
            ]}
            onPress={() => navigation.navigate('UserForm', { userRecord: account })}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
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
