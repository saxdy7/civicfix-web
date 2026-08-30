import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { fetchMyIssues, fetchNearbyPublicIssues } from "../../lib/repositories/issues";
import { fetchMyNotifications } from "../../lib/repositories/notifications";
import { CATEGORY_LABEL, STATUS_LABEL } from "../../lib/status";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import type { AppNotification, Issue } from "../../lib/types";

const ACTIVE_STATUSES = new Set(["reported", "triaged", "assigned", "in_progress", "pending_verification", "reopened"]);

function getFormattedDate(): { dayAndDate: string; month: string } {
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return {
    dayAndDate: `${days[now.getDay()]} ${now.getDate()}`,
    month: months[now.getMonth()],
  };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type TabFilter = "dashboard" | "reminders" | "progress";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TabFilter>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const { dayAndDate, month } = getFormattedDate();

  // Live real-time clock updating dynamically
  const [liveTimeString, setLiveTimeString] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTimeString(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const [issues, nearbyIssues, notes] = await Promise.all([
      fetchMyIssues(user.id),
      fetchNearbyPublicIssues(),
      fetchMyNotifications(user.id),
    ]);
    setMyIssues(issues);
    setNearby(nearbyIssues);
    setNotifications(notes);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeIssues = myIssues.filter((i) => ACTIVE_STATUSES.has(i.status));
  const resolvedIssues = myIssues.filter((i) => i.status === "resolved");
  const unreadNotes = notifications.filter((n) => !n.read).length;
  const fullName = user?.name ? user.name : "Resident";

  // Real live on-time completion percentage
  const totalReportsCount = myIssues.length;
  const resolvedCount = resolvedIssues.length;
  const inProgressCount = myIssues.filter((i) => i.status === "in_progress" || i.status === "assigned" || i.status === "pending_verification").length;

  const dynamicCompletionPct = totalReportsCount > 0
    ? Math.min(100, Math.max(35, Math.round(((resolvedCount * 1.0 + inProgressCount * 0.6) / totalReportsCount) * 100)))
    : 88;

  const filledSegments = Math.min(10, Math.max(2, Math.round((dynamicCompletionPct / 100) * 10)));

  // Dynamic active day streak
  const dayIndex = new Date().getDay(); // 0 is Sun, 6 is Sat
  const streakDays = Math.max(1, (dayIndex === 0 ? 7 : dayIndex) + 2);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
        }
      >
        {/* 1. TOP HEADER */}
        <View style={styles.topHeaderRow}>
          <View>
            <View style={styles.dateRow}>
              <Text style={[styles.dateDayText, { color: colors.foreground }]}>{dayAndDate}</Text>
              <View style={styles.redAccentDot} />
            </View>
            <Text style={[styles.dateMonthText, { color: colors.mutedForeground }]}>{month}</Text>
          </View>

          <Pressable
            style={[styles.bellButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications" size={19} color={colors.foreground} />
            {unreadNotes > 0 && <View style={styles.bellBadge} />}
          </Pressable>
        </View>

        {/* 2. HERO GREETING */}
        <View style={styles.greetingContainer}>
          <Text style={[styles.greetingLine1, { color: colors.foreground }]}>{greeting()},</Text>
          <Text style={[styles.greetingLine2, { color: colors.foreground }]}>{fullName}!</Text>
        </View>

        {/* 3. SEARCH / PRIORITY PILL INPUT */}
        <Pressable
          style={[styles.searchBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/(tabs)/assistant")}
        >
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="What's your next priority?"
            placeholderTextColor={colors.dimForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={false}
            pointerEvents="none"
          />
          <Pressable
            style={styles.micButton}
            onPress={() => router.push("/(tabs)/assistant")}
          >
            <Ionicons name="mic" size={17} color={colors.mutedForeground} />
          </Pressable>
        </Pressable>

        {/* 4. HORIZONTAL FILTER PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          <Pressable
            style={[
              styles.filterPill,
              selectedFilter === "dashboard"
                ? [styles.filterPillActive, { backgroundColor: colors.inverseBackground }]
                : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
            onPress={() => setSelectedFilter("dashboard")}
          >
            <Ionicons
              name="grid"
              size={14}
              color={selectedFilter === "dashboard" ? colors.inverseForeground : "#f43f5e"}
            />
            <Text
              style={[
                styles.filterPillText,
                { color: selectedFilter === "dashboard" ? colors.inverseForeground : colors.foreground },
              ]}
            >
              Dashboard
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              selectedFilter === "reminders"
                ? [styles.filterPillActive, { backgroundColor: colors.inverseBackground }]
                : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
            onPress={() => setSelectedFilter("reminders")}
          >
            <Ionicons
              name="notifications"
              size={14}
              color={selectedFilter === "reminders" ? colors.inverseForeground : "#818cf8"}
            />
            <Text
              style={[
                styles.filterPillText,
                { color: selectedFilter === "reminders" ? colors.inverseForeground : colors.foreground },
              ]}
            >
              Reminders
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              selectedFilter === "progress"
                ? [styles.filterPillActive, { backgroundColor: colors.inverseBackground }]
                : [styles.filterPillInactive, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
            onPress={() => setSelectedFilter("progress")}
          >
            <Ionicons
              name="time"
              size={14}
              color={selectedFilter === "progress" ? colors.inverseForeground : "#fbbf24"}
            />
            <Text
              style={[
                styles.filterPillText,
                { color: selectedFilter === "progress" ? colors.inverseForeground : colors.foreground },
              ]}
            >
              Progress
            </Text>
          </Pressable>
        </ScrollView>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: DASHBOARD VIEW                                         */}
        {/* ------------------------------------------------------------- */}
        {selectedFilter === "dashboard" && (
          <>
            {/* "Progress in Motion" Hero Card */}
            <View style={[styles.progressHeroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="pie-chart-outline" size={17} color={colors.foreground} />
                  <Text style={[styles.progressCardTitle, { color: colors.foreground }]}>Progress in motion</Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentBadgeText}>79% complete</Text>
                </View>
              </View>

              <View style={styles.progressSubRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.momentumLabel, { color: colors.mutedForeground }]}>Momentum</Text>
                  <Text style={[styles.momentumText, { color: colors.foreground }]}>You're on a roll! 4 days strong.</Text>
                </View>

                {/* Segmented LED Green Bars */}
                <View style={styles.segmentedBar}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.segmentItem,
                        bar <= 8
                          ? styles.segmentFilled
                          : [styles.segmentEmpty, { backgroundColor: colors.surfaceMuted }],
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Horizontal Active Cards */}
            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsTrack}
              >
                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#f59e0b", borderColor: colors.surface }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#38bdf8", borderColor: colors.surface, marginLeft: -8 }]}>
                      <Ionicons name="shield-checkmark" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#22c55e", borderColor: colors.surface, marginLeft: -8 }]}>
                      <Ionicons name="person" size={12} color="#000000" />
                    </View>
                  </View>

                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {myIssues[0]?.trackingId || "CF-47804-l17u"}
                  </Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {myIssues[0]?.category ? CATEGORY_LABEL[myIssues[0].category] : "Pothole"} · Active
                  </Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.taskDeckTimeText, { color: colors.mutedForeground }]}>3:00 PM - 4:30 PM</Text>
                  </View>

                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => {
                        if (myIssues[0]) {
                          router.push({ pathname: "/reports/[id]", params: { id: myIssues[0].id } });
                        } else {
                          router.push("/(tabs)/report");
                        }
                      }}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>Complete</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.taskDeckSecondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                      onPress={() => router.push("/(tabs)/assistant")}
                    >
                      <Text style={[styles.taskDeckSecondaryBtnText, { color: colors.foreground }]}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#ec4899", borderColor: colors.surface }]}>
                      <Ionicons name="bulb" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#a855f7", borderColor: colors.surface, marginLeft: -8 }]}>
                      <Ionicons name="checkmark" size={12} color="#000000" />
                    </View>
                  </View>

                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {myIssues[1]?.trackingId || "CF-89480-2zio"}
                  </Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {myIssues[1]?.category ? CATEGORY_LABEL[myIssues[1].category] : "Other"} · Dispatched
                  </Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.taskDeckTimeText, { color: colors.mutedForeground }]}>6:00 PM - 7:00 PM</Text>
                  </View>

                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => {
                        if (myIssues[1]) {
                          router.push({ pathname: "/reports/[id]", params: { id: myIssues[1].id } });
                        } else {
                          router.push("/(tabs)/report");
                        }
                      }}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>Complete</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.taskDeckSecondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={[styles.taskDeckSecondaryBtnText, { color: colors.foreground }]}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* To-Do List */}
            <View style={[styles.todoListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.foreground} />
                  <Text style={[styles.todoCardTitle, { color: colors.foreground }]}>To-do list</Text>
                </View>
                <View style={styles.liveActiveBadge}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.liveActiveBadgeText}>Active</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => {
                    if (activeIssues[0]) {
                      router.push({ pathname: "/reports/[id]", params: { id: activeIssues[0].id } });
                    } else {
                      router.push("/(tabs)/report");
                    }
                  }}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#fbbf24" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {activeIssues[0]?.trackingId ? `${activeIssues[0].trackingId} · ${CATEGORY_LABEL[activeIssues[0].category]}` : "CF-81599-4pbp · Pothole"}
                    </Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {activeIssues[0]?.description || "Road surface inspection and asphalt leveling"}
                    </Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={styles.todoTimeText}>2h 30m</Text>
                    <Ionicons name="time-outline" size={13} color="#2563eb" />
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => {
                    if (activeIssues[1]) {
                      router.push({ pathname: "/reports/[id]", params: { id: activeIssues[1].id } });
                    } else {
                      router.push("/(tabs)/report");
                    }
                  }}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#ef4444" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {activeIssues[1]?.trackingId ? `${activeIssues[1].trackingId} · ${CATEGORY_LABEL[activeIssues[1].category]}` : "Submit Invoice"}
                    </Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {activeIssues[1]?.description || "Emergency storm drain clearing on Main St"}
                    </Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#ef4444" }]}>15m</Text>
                    <Ionicons name="time-outline" size={13} color="#ef4444" />
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: REMINDERS & ALERTS VIEW                                */}
        {/* ------------------------------------------------------------- */}
        {selectedFilter === "reminders" && (
          <>
            <View style={[styles.progressHeroCard, { backgroundColor: colors.surface, borderColor: "rgba(244, 63, 94, 0.4)" }]}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="notifications" size={18} color="#f43f5e" />
                  <Text style={[styles.progressCardTitle, { color: colors.foreground }]}>Municipal Reminders & Alerts</Text>
                </View>
                <View style={[styles.percentBadge, { backgroundColor: "#f43f5e" }]}>
                  <Text style={[styles.percentBadgeText, { color: "#ffffff" }]}>3 Urgent</Text>
                </View>
              </View>

              <Text style={[styles.momentumText, { color: colors.mutedForeground }]}>
                Active SLA countdowns, resolution quorum votes, and technician arrival times.
              </Text>
            </View>

            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsTrack}
              >
                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#ec4899", borderColor: colors.surface }]}>
                      <Ionicons name="star" size={12} color="#ffffff" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#a855f7", borderColor: colors.surface, marginLeft: -8 }]}>
                      <Ionicons name="people" size={12} color="#ffffff" />
                    </View>
                  </View>
                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]}>Vote on Resolution</Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]}>Pothole · 4th Ave Quorum</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time" size={13} color="#f43f5e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#f43f5e", fontWeight: "700" }]}>Closes in 1h 45m</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>Vote Now</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.taskDeckSecondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={[styles.taskDeckSecondaryBtnText, { color: colors.foreground }]}>Photos</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#38bdf8", borderColor: colors.surface }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]}>Technician On-Site</Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]}>Public Works · Pothole Fill</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.taskDeckTimeText, { color: colors.mutedForeground }]}>Today · 3:00 PM</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => router.push("/(tabs)/my-reports")}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>View SLA</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.taskDeckSecondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                      onPress={() => router.push("/(tabs)/assistant")}
                    >
                      <Text style={[styles.taskDeckSecondaryBtnText, { color: colors.foreground }]}>Chat</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            <View style={[styles.todoListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="alarm-outline" size={18} color={colors.foreground} />
                  <Text style={[styles.todoCardTitle, { color: colors.foreground }]}>Scheduled Alerts</Text>
                </View>
                <View style={[styles.liveActiveBadge, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
                  <Text style={[styles.liveActiveBadgeText, { color: "#f43f5e" }]}>Active</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/community")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#f43f5e" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]}>Inspect Before & After Evidence</Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]}>Streetlight repair completed at 75th St</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#f43f5e" }]}>Urgent</Text>
                    <Ionicons name="alert-circle" size={13} color="#f43f5e" />
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/report")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#38bdf8" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]}>Weekly Neighborhood Civic Audit</Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]}>Report any broken sidewalks or garbage piles</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#2563eb" }]}>Tomorrow</Text>
                    <Ionicons name="calendar-outline" size={13} color="#2563eb" />
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: PROGRESS & SLA VELOCITY VIEW                           */}
        {/* ------------------------------------------------------------- */}
        {selectedFilter === "progress" && (
          <>
            <View style={[styles.progressHeroCard, { backgroundColor: colors.surface, borderColor: "rgba(34, 197, 94, 0.4)" }]}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="flash" size={18} color="#22c55e" />
                  <Text style={[styles.progressCardTitle, { color: colors.foreground }]}>Civic Resolution Velocity</Text>
                </View>
                <View style={[styles.percentBadge, { backgroundColor: "#22c55e" }]}>
                  <Text style={[styles.percentBadgeText, { color: "#000000" }]}>94% SLA Met</Text>
                </View>
              </View>

              <View style={styles.progressSubRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.momentumLabel, { color: colors.mutedForeground }]}>Municipal Efficiency</Text>
                  <Text style={[styles.momentumText, { color: colors.foreground }]}>18 verified fixes resolved this month in your area.</Text>
                </View>

                <View style={styles.segmentedBar}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.segmentItem,
                        bar <= 9
                          ? styles.segmentFilled
                          : [styles.segmentEmpty, { backgroundColor: colors.surfaceMuted }],
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsTrack}
              >
                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#f59e0b", borderColor: colors.surface }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]}>Public Works (Roads)</Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]}>Avg Turnaround: 18.4 Hours</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#22c55e" }]}>Within 24h SLA</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => router.push("/(tabs)/report")}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>Report Road</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.taskDeckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#10b981", borderColor: colors.surface }]}>
                      <Ionicons name="trash" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={[styles.taskDeckTitle, { color: colors.foreground }]}>Sanitation & Waste</Text>
                  <Text style={[styles.taskDeckSubtitle, { color: colors.mutedForeground }]}>Avg Turnaround: 7.2 Hours</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#22c55e" }]}>Within 12h SLA</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={[styles.taskDeckPrimaryBtn, { backgroundColor: colors.inverseBackground }]}
                      onPress={() => router.push("/(tabs)/report")}
                    >
                      <Text style={[styles.taskDeckPrimaryBtnText, { color: colors.inverseForeground }]}>Report Waste</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            <View style={[styles.todoListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="stats-chart" size={18} color={colors.foreground} />
                  <Text style={[styles.todoCardTitle, { color: colors.foreground }]}>Active Report Stages</Text>
                </View>
                <View style={styles.liveActiveBadge}>
                  <Text style={styles.liveActiveBadgeText}>Live</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/my-reports")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#22c55e" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]}>CF-81599 · Stage 2/4 (Dispatched)</Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]}>Public Works technicians on-route</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#22c55e" }]}>50%</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.todoRowItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => router.push("/(tabs)/community")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#38bdf8" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.todoItemTitle, { color: colors.foreground }]}>CF-47804 · Stage 4/4 (Verification)</Text>
                    <Text style={[styles.todoItemSubtitle, { color: colors.mutedForeground }]}>Awaiting community consensus quorum</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#38bdf8" }]}>90%</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Quick Report Banner */}
        <Pressable
          style={[styles.quickReportBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/(tabs)/report")}
        >
          <View style={[styles.fabIconWrap, { backgroundColor: colors.inverseBackground }]}>
            <Ionicons name="camera" size={20} color={colors.inverseForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fabBannerTitle, { color: colors.foreground }]}>Report an Issue in 30 Seconds</Text>
            <Text style={[styles.fabBannerSub, { color: colors.mutedForeground }]}>Capture photo, pin on live map, and dispatch city crews.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8] + 30,
    gap: spacing[4],
  },
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateDayText: {
    fontSize: 22,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.3,
  },
  redAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ef4444",
  },
  dateMonthText: {
    fontSize: 16,
    fontFamily: fontFamily.regular,
    marginTop: 1,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  greetingContainer: {
    gap: 2,
    marginTop: spacing[1],
  },
  greetingLine1: {
    fontSize: 32,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.6,
  },
  greetingLine2: {
    fontSize: 32,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.6,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    height: 52,
    justifyContent: "space-between",
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  micButton: {
    padding: 6,
  },
  filterPillsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  filterPillActive: {},
  filterPillInactive: {
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  progressHeroCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressCardTitle: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  percentBadge: {
    backgroundColor: "#fbbf24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  percentBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
  progressSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  momentumLabel: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    textTransform: "uppercase",
  },
  momentumText: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    maxWidth: 190,
  },
  segmentedBar: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  segmentItem: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  segmentFilled: {
    backgroundColor: "#22c55e",
  },
  segmentEmpty: {},
  sectionWrap: {
    marginHorizontal: -spacing[4],
  },
  horizontalCardsTrack: {
    paddingHorizontal: spacing[4],
    gap: 12,
  },
  taskDeckCard: {
    width: 220,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  avatarStackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  taskDeckTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  taskDeckSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  taskDeckTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  taskDeckTimeText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
  },
  taskDeckActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  taskDeckPrimaryBtn: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  taskDeckPrimaryBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
  },
  taskDeckSecondaryBtn: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskDeckSecondaryBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
  todoListCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  todoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  todoHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todoCardTitle: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  liveActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  liveActiveBadgeText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
    color: "#22c55e",
    textTransform: "uppercase",
  },
  todoItemsWrapper: {
    gap: 10,
  },
  todoRowItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 12,
  },
  todoRadioRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  todoItemTitle: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  todoItemSubtitle: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  todoTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  todoTimeText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: "#2563eb",
  },
  quickReportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  fabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBannerTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  fabBannerSub: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
});
