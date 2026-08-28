import { Text, View, StyleSheet } from "react-native";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { MOCK_NOTIFICATIONS } from "../lib/mock-data";
import { color, fontSize, spacing } from "../lib/theme";

export default function Notifications() {
  if (MOCK_NOTIFICATIONS.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState title="No notifications" description="Status updates on your reports will appear here." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {MOCK_NOTIFICATIONS.map((notification) => (
        <Card key={notification.id} style={{ marginBottom: spacing[3], opacity: notification.read ? 0.6 : 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>{notification.title}</Text>
            {!notification.read ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.body}>{notification.body}</Text>
          <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString()}</Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
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
    color: color.mutedForeground,
  },
  date: {
    fontSize: fontSize.xs,
    color: color.mutedForeground,
  },
});
