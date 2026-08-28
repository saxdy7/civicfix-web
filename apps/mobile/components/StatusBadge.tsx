import { View, Text, StyleSheet } from "react-native";

import { color, radius, fontSize, spacing } from "../lib/theme";
import { STATUS_SHORT_LABEL } from "../lib/status";
import { STATUS_COLOR } from "../lib/status";
import type { IssueStatus } from "../lib/types";

export function StatusBadge({ status }: { status: IssueStatus }) {
  const tone = STATUS_COLOR[status];

  return (
    <View style={[styles.badge, { backgroundColor: `${tone}1a`, borderColor: tone }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.text, { color: tone }]}>{STATUS_SHORT_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: spacing[2],
    borderRadius: radius.control,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
