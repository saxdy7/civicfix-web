import { useCallback, useState } from "react";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, Linking, Pressable, RefreshControl, Text, View, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { useAuth } from "../lib/auth-context";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotificationWithIssue,
} from "../lib/repositories/notifications";
import { registerForPushNotifications } from "../lib/push-notifications";
import { color, fontFamily, fontSize, spacing } from "../lib/theme";

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotificationWithIssue[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [list, permission] = await Promise.all([
      fetchMyNotifications(user.id),
      Notifications.getPermissionsAsync(),
    ]);
    setNotifications(list);
    setPermissionDenied(permission.status === "denied");
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNotification = async (n: AppNotificationWithIssue) => {
    if (!n.read && user) {
      await markNotificationRead(n.id, user.id);
      setNotifications((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
    }
    if (n.issueId) router.push({ pathname: "/reports/[id]", params: { id: n.issueId } });
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    const result = await registerForPushNotifications(user.id);
    setPermissionDenied(!result.granted);
  };

  if (notifications === null) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <ActivityIndicator color={color.civicBlue} />
      </ScreenContainer>
    );
  }

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <ScreenContainer
      edges={["left", "right"]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.foreground} />}
    >
      {permissionDenied ? (
        <Card tone="muted" style={styles.permissionCard}>
          <Ionicons name="notifications-off-outline" size={20} color={color.civicAmber} />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <Text style={styles.permissionTitle}>Notifications are off</Text>
            <Text style={styles.permissionBody}>
              Turn them on in Settings to get notified when a report you filed changes status.
            </Text>
          </View>
          <Button
            label="Open Settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        </Card>
      ) : null}

      {notifications.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications"
          description="Status updates on your reports will appear here."
          action={
            !permissionDenied ? (
              <Button label="Enable notifications" variant="secondary" onPress={handleEnableNotifications} />
            ) : undefined
          }
        />
      ) : (
        <>
          {unread.length > 0 ? (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Unread</Text>
              <Text style={styles.markAllLink} onPress={handleMarkAllRead}>
                Mark all read
              </Text>
            </View>
          ) : null}
          {unread.map((n) => (
            <NotificationRow key={n.id} notification={n} onPress={() => openNotification(n)} />
          ))}

          {read.length > 0 ? <Text style={[styles.sectionLabel, { marginTop: spacing[2] }]}>Earlier</Text> : null}
          {read.map((n) => (
            <NotificationRow key={n.id} notification={n} onPress={() => openNotification(n)} />
          ))}
        </>
      )}
    </ScreenContainer>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotificationWithIssue;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={[styles.notifCard, !notification.read && styles.notifCardUnread]}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{notification.title}</Text>
          {!notification.read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString()}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  permissionTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  permissionBody: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  markAllLink: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicBlue,
  },
  notifCard: {
    marginBottom: spacing[3],
    opacity: 0.7,
  },
  notifCardUnread: {
    opacity: 1,
    borderColor: color.civicBlueSoft,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.civicBlue,
  },
  body: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  date: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.dimForeground,
  },
});
