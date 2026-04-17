import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { radii, shadow, spacing, useTheme } from '../theme';

const defaultShortcutIcons = {
  Alerts: 'notifications-outline',
  Appointments: 'calendar-outline',
  Billing: 'wallet-outline',
  'Clinic hours': 'time-outline',
  Feedback: 'chatbubble-ellipses-outline',
  'Book appointment': 'add-circle-outline',
  'Drug inventory': 'medkit-outline',
  'Medical history': 'time-outline',
  'Medical records': 'document-text-outline',
  Payments: 'card-outline',
  Prescriptions: 'document-attach-outline',
  Records: 'folder-open-outline',
  Users: 'people-outline',
};

export default function DashboardTopBar({
  shortcutItems = [],
  onViewProfile,
  showNotifications = false,
  notificationCount = 0,
  onOpenNotifications,
  title = 'Smart Clinic',
}) {
  const { signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeMenu, setActiveMenu] = useState('');

  const closeMenu = () => setActiveMenu('');

  const handleShortcutPress = async (item) => {
    closeMenu();
    item.onPress?.();
  };

  const handleProfilePress = async (action) => {
    closeMenu();

    if (action === 'profile') {
      onViewProfile?.();
      return;
    }

    if (action === 'logout') {
      await signOut();
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={[styles.caption, { color: colors.textMuted }]}>Smart Clinic</Text>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => setActiveMenu('shortcuts')}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons color={colors.text} name="menu-outline" size={22} />
          </Pressable>
          {showNotifications ? (
            <Pressable
              onPress={onOpenNotifications}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons color={colors.text} name="notifications-outline" size={20} />
              {notificationCount ? (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.badgeText, { color: colors.surface }]}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setActiveMenu('profile')}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons color={colors.text} name="person-circle-outline" size={24} />
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" transparent visible={Boolean(activeMenu)} onRequestClose={closeMenu}>
        <View style={styles.modalOverlay}>
          <Pressable
            onPress={closeMenu}
            style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(2, 12, 16, 0.55)' : 'rgba(16, 52, 60, 0.12)' }]}
          />
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginTop: insets.top + 56,
                width: activeMenu === 'profile' ? 220 : 286,
              },
            ]}
          >
            <View style={[styles.menuHeader, { backgroundColor: colors.surfaceMuted, borderBottomColor: colors.border }]}>
              <Text style={[styles.menuHeaderText, { color: colors.primaryDark }]}>{activeMenu === 'profile' ? 'Account' : 'Quick access'}</Text>
            </View>
            {activeMenu === 'shortcuts' ? (
              <View style={[styles.menuItem, styles.themeMenuItem, { borderBottomColor: colors.border }]}>
                <View style={styles.menuItemMain}>
                  <View style={[styles.menuIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons color={colors.primaryDark} name={isDark ? 'moon' : 'sunny'} size={18} />
                  </View>
                  <Text style={[styles.menuText, { color: colors.text }]}>Dark theme</Text>
                </View>
                <Switch
                  onValueChange={toggleTheme}
                  thumbColor={colors.surface}
                  trackColor={{ false: '#CBD5E1', true: '#0891B2' }}
                  value={isDark}
                />
              </View>
            ) : null}
            {activeMenu === 'shortcuts'
              ? shortcutItems.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => handleShortcutPress(item)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      styles.pressableMenuItem,
                      {
                        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.menuItemMain}>
                      <View style={[styles.menuIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons
                          color={colors.primaryDark}
                          name={item.icon || defaultShortcutIcons[item.label] || 'ellipse-outline'}
                          size={18}
                        />
                      </View>
                      <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
                    </View>
                    <View style={styles.menuItemSide}>
                      {item.badge ? (
                        <View style={[styles.itemBadge, { backgroundColor: colors.primaryDark }]}>
                          <Text style={[styles.itemBadgeText, { color: colors.surface }]}>{item.badge}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.openPill, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={[styles.openPillText, { color: colors.primaryDark }]}>Open</Text>
                      </View>
                      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                    </View>
                  </Pressable>
                ))
              : (
                <>
                  <Pressable
                    onPress={() => handleProfilePress('profile')}
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.menuItemMain}>
                      <View style={[styles.menuIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons color={colors.primaryDark} name="person-outline" size={18} />
                      </View>
                      <Text style={[styles.menuText, { color: colors.text }]}>View profile</Text>
                    </View>
                    <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleProfilePress('logout')}
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.menuItemMain}>
                      <View style={[styles.menuIconWrap, styles.logoutIconWrap]}>
                        <Ionicons color={colors.danger} name="log-out-outline" size={18} />
                      </View>
                      <Text style={[styles.menuText, { color: colors.danger }]}>Logout</Text>
                    </View>
                    <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                  </Pressable>
                </>
              )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 10,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow,
  },
  menuHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  menuHeaderText: {
    fontWeight: '800',
  },
  menuItem: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressableMenuItem: {
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  themeMenuItem: {
    backgroundColor: 'transparent',
  },
  menuItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  menuItemSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconWrap: {
    backgroundColor: '#FDECEC',
  },
  menuText: {
    fontWeight: '700',
  },
  openPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
