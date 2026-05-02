import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { colors, spacing, useTheme } from '../theme';
import { openBillingInvoice } from '../utils/billing';
import { formatDateTime } from '../utils/date';

export default function NotificationListScreen() {
  const isFocused = useIsFocused();
  const { colors: themeColors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
    } catch (error) {
      Alert.alert('Unable to load notifications', error?.response?.data?.message || 'Try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadNotifications();
    }
  }, [isFocused]);

  const handleOpenNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item
          )
        );
      } catch (_error) {
        // Keep the feed usable even if marking read fails.
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAllRead(true);
      await api.patch('/notifications/read-all');
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        }))
      );
    } catch (error) {
      Alert.alert('Unable to update notifications', error?.response?.data?.message || 'Try again later.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  if (loading) {
    return <LoadingOverlay message="Loading notifications..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: themeColors.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>Appointment, payment, and feedback updates appear here.</Text>
        </View>
        {unreadCount ? (
          <AppButton
            loading={markingAllRead}
            onPress={handleMarkAllRead}
            title="Mark all read"
            variant="secondary"
          />
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <EmptyState message="You do not have any notifications yet." title="No notifications" />
      ) : (
        notifications.map((notification) => (
          <EntityCard
            key={notification._id}
            meta={[
              `Received: ${formatDateTime(notification.createdAt)}`,
              `Status: ${notification.isRead ? 'Read' : 'Unread'}`,
            ]}
            onPress={() => handleOpenNotification(notification)}
            status={notification.isRead ? 'completed' : 'active'}
            subtitle={
              notification.type === 'feedback' && notification.metadata?.adminReply
                ? `${notification.message}\n\nReply: ${notification.metadata.adminReply}`
                : notification.message
            }
            title={notification.title}
            footer={
              <View style={styles.footerBlock}>
                <View style={styles.footerRow}>
                  <Ionicons
                    color={notification.isRead ? themeColors.textMuted : themeColors.primaryDark}
                    name={notification.isRead ? 'mail-open-outline' : 'notifications-outline'}
                    size={18}
                  />
                  <Text style={[styles.footerText, { color: themeColors.textMuted }, !notification.isRead && { color: themeColors.primaryDark, fontWeight: '700' }]}>
                    {notification.isRead ? 'Viewed' : 'Tap to mark as read'}
                  </Text>
                </View>
                {notification.metadata?.billingId ? (
                  <AppButton
                    onPress={() => openBillingInvoice(notification.metadata.billingId)}
                    title="Download bill PDF"
                    variant="secondary"
                  />
                ) : null}
              </View>
            }
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
  headerCopy: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerBlock: {
    gap: spacing.sm,
  },
  footerText: {
    color: colors.textMuted,
  },
  unreadText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
