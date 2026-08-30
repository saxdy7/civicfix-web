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
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<TabFilter>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const { dayAndDate, month } = getFormattedDate();

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
  const unreadNotes = notifications.filter((n) => !n.read).length;
  const fullName = user?.name ? user.name : "Resident";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />
        }
      >
        {/* 1. TOP HEADER */}
        <View style={styles.topHeaderRow}>
          <View>
            <View style={styles.dateRow}>
              <Text style={styles.dateDayText}>{dayAndDate}</Text>
              <View style={styles.redAccentDot} />
            </View>
            <Text style={styles.dateMonthText}>{month}</Text>
          </View>

          <Pressable
            style={styles.bellButton}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications" size={19} color="#ffffff" />
            {unreadNotes > 0 && <View style={styles.bellBadge} />}
          </Pressable>
        </View>

        {/* 2. HERO GREETING */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingLine1}>{greeting()},</Text>
          <Text style={styles.greetingLine2}>{fullName}!</Text>
        </View>

        {/* 3. SEARCH / PRIORITY PILL INPUT */}
        <Pressable
          style={styles.searchBarContainer}
          onPress={() => router.push("/(tabs)/assistant")}
        >
          <TextInput
            style={styles.searchInput}
            placeholder="What's your next priority?"
            placeholderTextColor="#8e8e8e"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={false}
            pointerEvents="none"
          />
          <Pressable
            style={styles.micButton}
            onPress={() => router.push("/(tabs)/assistant")}
          >
            <Ionicons name="mic" size={17} color="#a1a1aa" />
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
              selectedFilter === "dashboard" ? styles.filterPillActive : styles.filterPillInactive,
            ]}
            onPress={() => setSelectedFilter("dashboard")}
          >
            <Ionicons
              name="grid"
              size={14}
              color={selectedFilter === "dashboard" ? "#000000" : "#f43f5e"}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === "dashboard" ? styles.filterPillTextActive : styles.filterPillTextInactive,
              ]}
            >
              Dashboard
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              selectedFilter === "reminders" ? styles.filterPillActive : styles.filterPillInactive,
            ]}
            onPress={() => setSelectedFilter("reminders")}
          >
            <Ionicons
              name="notifications"
              size={14}
              color={selectedFilter === "reminders" ? "#000000" : "#818cf8"}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === "reminders" ? styles.filterPillTextActive : styles.filterPillTextInactive,
              ]}
            >
              Reminders
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              selectedFilter === "progress" ? styles.filterPillActive : styles.filterPillInactive,
            ]}
            onPress={() => setSelectedFilter("progress")}
          >
            <Ionicons
              name="time"
              size={14}
              color={selectedFilter === "progress" ? "#000000" : "#fbbf24"}
            />
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === "progress" ? styles.filterPillTextActive : styles.filterPillTextInactive,
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
            <View style={styles.progressHeroCard}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="pie-chart-outline" size={17} color="#ffffff" />
                  <Text style={styles.progressCardTitle}>Progress in motion</Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentBadgeText}>79% complete</Text>
                </View>
              </View>

              <View style={styles.progressSubRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.momentumLabel}>Momentum</Text>
                  <Text style={styles.momentumText}>You're on a roll! 4 days strong.</Text>
                </View>

                {/* Segmented LED Green Bars */}
                <View style={styles.segmentedBar}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.segmentItem,
                        bar <= 8 ? styles.segmentFilled : styles.segmentEmpty,
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
                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#f59e0b" }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#38bdf8", marginLeft: -8 }]}>
                      <Ionicons name="shield-checkmark" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#22c55e", marginLeft: -8 }]}>
                      <Ionicons name="person" size={12} color="#000000" />
                    </View>
                  </View>

                  <Text style={styles.taskDeckTitle} numberOfLines={1}>
                    {myIssues[0]?.trackingId || "CF-47804-l17u"}
                  </Text>
                  <Text style={styles.taskDeckSubtitle} numberOfLines={1}>
                    {myIssues[0]?.category ? CATEGORY_LABEL[myIssues[0].category] : "Pothole"} · Active
                  </Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color="#8e8e8e" />
                    <Text style={styles.taskDeckTimeText}>3:00 PM - 4:30 PM</Text>
                  </View>

                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => {
                        if (myIssues[0]) {
                          router.push({ pathname: "/reports/[id]", params: { id: myIssues[0].id } });
                        } else {
                          router.push("/(tabs)/report");
                        }
                      }}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>Complete</Text>
                    </Pressable>

                    <Pressable
                      style={styles.taskDeckSecondaryBtn}
                      onPress={() => router.push("/(tabs)/assistant")}
                    >
                      <Text style={styles.taskDeckSecondaryBtnText}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#ec4899" }]}>
                      <Ionicons name="bulb" size={12} color="#000000" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#a855f7", marginLeft: -8 }]}>
                      <Ionicons name="checkmark" size={12} color="#000000" />
                    </View>
                  </View>

                  <Text style={styles.taskDeckTitle} numberOfLines={1}>
                    {myIssues[1]?.trackingId || "CF-89480-2zio"}
                  </Text>
                  <Text style={styles.taskDeckSubtitle} numberOfLines={1}>
                    {myIssues[1]?.category ? CATEGORY_LABEL[myIssues[1].category] : "Other"} · Dispatched
                  </Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color="#8e8e8e" />
                    <Text style={styles.taskDeckTimeText}>6:00 PM - 7:00 PM</Text>
                  </View>

                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => {
                        if (myIssues[1]) {
                          router.push({ pathname: "/reports/[id]", params: { id: myIssues[1].id } });
                        } else {
                          router.push("/(tabs)/report");
                        }
                      }}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>Complete</Text>
                    </Pressable>

                    <Pressable
                      style={styles.taskDeckSecondaryBtn}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={styles.taskDeckSecondaryBtnText}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* To-Do List */}
            <View style={styles.todoListCard}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                  <Text style={styles.todoCardTitle}>To-do list</Text>
                </View>
                <View style={styles.liveActiveBadge}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.liveActiveBadgeText}>Active</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={styles.todoRowItem}
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
                    <Text style={styles.todoItemTitle} numberOfLines={1}>
                      {activeIssues[0]?.trackingId ? `${activeIssues[0].trackingId} · ${CATEGORY_LABEL[activeIssues[0].category]}` : "CF-81599-4pbp · Pothole"}
                    </Text>
                    <Text style={styles.todoItemSubtitle} numberOfLines={1}>
                      {activeIssues[0]?.description || "Road surface inspection and asphalt leveling"}
                    </Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={styles.todoTimeText}>2h 30m</Text>
                    <Ionicons name="time-outline" size={13} color="#60a5fa" />
                  </View>
                </Pressable>

                <Pressable
                  style={styles.todoRowItem}
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
                    <Text style={styles.todoItemTitle} numberOfLines={1}>
                      {activeIssues[1]?.trackingId ? `${activeIssues[1].trackingId} · ${CATEGORY_LABEL[activeIssues[1].category]}` : "Submit Invoice"}
                    </Text>
                    <Text style={styles.todoItemSubtitle} numberOfLines={1}>
                      {activeIssues[1]?.description || "Emergency storm drain clearing on Main St"}
                    </Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={styles.todoTimeText}>15m</Text>
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
            {/* Reminders Hero Alert Card */}
            <View style={[styles.progressHeroCard, { borderColor: "rgba(244, 63, 94, 0.4)" }]}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="notifications" size={18} color="#f43f5e" />
                  <Text style={styles.progressCardTitle}>Municipal Reminders & Alerts</Text>
                </View>
                <View style={[styles.percentBadge, { backgroundColor: "#f43f5e" }]}>
                  <Text style={[styles.percentBadgeText, { color: "#ffffff" }]}>3 Urgent</Text>
                </View>
              </View>

              <Text style={styles.momentumText}>
                Active SLA countdowns, resolution quorum votes, and technician arrival times.
              </Text>
            </View>

            {/* Reminders Carousel Cards */}
            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsTrack}
              >
                {/* Reminder 1: Quorum Vote */}
                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#ec4899" }]}>
                      <Ionicons name="star" size={12} color="#ffffff" />
                    </View>
                    <View style={[styles.avatarCircle, { backgroundColor: "#a855f7", marginLeft: -8 }]}>
                      <Ionicons name="people" size={12} color="#ffffff" />
                    </View>
                  </View>
                  <Text style={styles.taskDeckTitle}>Vote on Resolution</Text>
                  <Text style={styles.taskDeckSubtitle}>Pothole · 4th Ave Quorum</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time" size={13} color="#f43f5e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#f43f5e", fontWeight: "700" }]}>Closes in 1h 45m</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>Vote Now</Text>
                    </Pressable>
                    <Pressable
                      style={styles.taskDeckSecondaryBtn}
                      onPress={() => router.push("/(tabs)/community")}
                    >
                      <Text style={styles.taskDeckSecondaryBtnText}>Photos</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Reminder 2: On-site inspection */}
                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#38bdf8" }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={styles.taskDeckTitle}>Technician On-Site</Text>
                  <Text style={styles.taskDeckSubtitle}>Public Works · Pothole Fill</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="time-outline" size={13} color="#8e8e8e" />
                    <Text style={styles.taskDeckTimeText}>Today · 3:00 PM</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => router.push("/(tabs)/my-reports")}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>View SLA</Text>
                    </Pressable>
                    <Pressable
                      style={styles.taskDeckSecondaryBtn}
                      onPress={() => router.push("/(tabs)/assistant")}
                    >
                      <Text style={styles.taskDeckSecondaryBtnText}>Chat</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* Reminders List Card */}
            <View style={styles.todoListCard}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="alarm-outline" size={18} color="#ffffff" />
                  <Text style={styles.todoCardTitle}>Scheduled Alerts</Text>
                </View>
                <View style={[styles.liveActiveBadge, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
                  <Text style={[styles.liveActiveBadgeText, { color: "#f43f5e" }]}>Active</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={styles.todoRowItem}
                  onPress={() => router.push("/(tabs)/community")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#f43f5e" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todoItemTitle}>Inspect Before & After Evidence</Text>
                    <Text style={styles.todoItemSubtitle}>Streetlight repair completed at 75th St</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#f43f5e" }]}>Urgent</Text>
                    <Ionicons name="alert-circle" size={13} color="#f43f5e" />
                  </View>
                </Pressable>

                <Pressable
                  style={styles.todoRowItem}
                  onPress={() => router.push("/(tabs)/report")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#38bdf8" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todoItemTitle}>Weekly Neighborhood Civic Audit</Text>
                    <Text style={styles.todoItemSubtitle}>Report any broken sidewalks or garbage piles</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={styles.todoTimeText}>Tomorrow</Text>
                    <Ionicons name="calendar-outline" size={13} color="#60a5fa" />
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
            {/* Progress Hero Velocity Card */}
            <View style={[styles.progressHeroCard, { borderColor: "rgba(34, 197, 94, 0.4)" }]}>
              <View style={styles.progressTopRow}>
                <View style={styles.progressTitleRow}>
                  <Ionicons name="flash" size={18} color="#22c55e" />
                  <Text style={styles.progressCardTitle}>Civic Resolution Velocity</Text>
                </View>
                <View style={[styles.percentBadge, { backgroundColor: "#22c55e" }]}>
                  <Text style={[styles.percentBadgeText, { color: "#000000" }]}>94% SLA Met</Text>
                </View>
              </View>

              <View style={styles.progressSubRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.momentumLabel}>Municipal Efficiency</Text>
                  <Text style={styles.momentumText}>18 verified fixes resolved this month in your area.</Text>
                </View>

                <View style={styles.segmentedBar}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.segmentItem,
                        bar <= 9 ? styles.segmentFilled : styles.segmentEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Department Velocity Metric Cards */}
            <View style={styles.sectionWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCardsTrack}
              >
                {/* Metric 1: Public Works */}
                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#f59e0b" }]}>
                      <Ionicons name="construct" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={styles.taskDeckTitle}>Public Works (Roads)</Text>
                  <Text style={styles.taskDeckSubtitle}>Avg Turnaround: 18.4 Hours</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#22c55e" }]}>Within 24h SLA</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => router.push("/(tabs)/report")}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>Report Road</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Metric 2: Sanitation */}
                <View style={styles.taskDeckCard}>
                  <View style={styles.avatarStackRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#10b981" }]}>
                      <Ionicons name="trash" size={12} color="#000000" />
                    </View>
                  </View>
                  <Text style={styles.taskDeckTitle}>Sanitation & Waste</Text>
                  <Text style={styles.taskDeckSubtitle}>Avg Turnaround: 7.2 Hours</Text>
                  <View style={styles.taskDeckTimeRow}>
                    <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
                    <Text style={[styles.taskDeckTimeText, { color: "#22c55e" }]}>Within 12h SLA</Text>
                  </View>
                  <View style={styles.taskDeckActionsRow}>
                    <Pressable
                      style={styles.taskDeckPrimaryBtn}
                      onPress={() => router.push("/(tabs)/report")}
                    >
                      <Text style={styles.taskDeckPrimaryBtnText}>Report Waste</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* Live Progress Stage Breakdown */}
            <View style={styles.todoListCard}>
              <View style={styles.todoHeaderRow}>
                <View style={styles.todoHeaderTitleRow}>
                  <Ionicons name="stats-chart" size={18} color="#ffffff" />
                  <Text style={styles.todoCardTitle}>Active Report Stages</Text>
                </View>
                <View style={styles.liveActiveBadge}>
                  <Text style={styles.liveActiveBadgeText}>Live</Text>
                </View>
              </View>

              <View style={styles.todoItemsWrapper}>
                <Pressable
                  style={styles.todoRowItem}
                  onPress={() => router.push("/(tabs)/my-reports")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#22c55e" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todoItemTitle}>CF-81599 · Stage 2/4 (Dispatched)</Text>
                    <Text style={styles.todoItemSubtitle}>Public Works technicians on-route</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#22c55e" }]}>50%</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.todoRowItem}
                  onPress={() => router.push("/(tabs)/community")}
                >
                  <View style={[styles.todoRadioRing, { borderColor: "#38bdf8" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todoItemTitle}>CF-47804 · Stage 4/4 (Verification)</Text>
                    <Text style={styles.todoItemSubtitle}>Awaiting community consensus quorum</Text>
                  </View>
                  <View style={styles.todoTimeBadge}>
                    <Text style={[styles.todoTimeText, { color: "#38bdf8" }]}>90%</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Quick Report FAB Banner */}
        <Pressable
          style={styles.quickReportBanner}
          onPress={() => router.push("/(tabs)/report")}
        >
          <View style={styles.fabIconWrap}>
            <Ionicons name="camera" size={20} color="#000000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fabBannerTitle}>Report an Issue in 30 Seconds</Text>
            <Text style={styles.fabBannerSub}>Capture photo, pin on live map, and dispatch city crews.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ffffff" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#000000",
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
    color: "#ffffff",
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
    color: "#6b7280",
    marginTop: 1,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#27272a",
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
    color: "#ffffff",
    letterSpacing: -0.6,
  },
  greetingLine2: {
    fontSize: 32,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
    letterSpacing: -0.6,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: spacing[4],
    height: 52,
    justifyContent: "space-between",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
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
  filterPillActive: {
    backgroundColor: "#ffffff",
  },
  filterPillInactive: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  filterPillTextActive: {
    color: "#000000",
  },
  filterPillTextInactive: {
    color: "#d4d4d8",
  },
  progressHeroCard: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
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
    color: "#ffffff",
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
    color: "#8e8e8e",
    textTransform: "uppercase",
  },
  momentumText: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#d4d4d8",
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
  segmentEmpty: {
    backgroundColor: "#27272a",
  },
  sectionWrap: {
    marginHorizontal: -spacing[4],
  },
  horizontalCardsTrack: {
    paddingHorizontal: spacing[4],
    gap: 12,
  },
  taskDeckCard: {
    width: 220,
    backgroundColor: "#121214",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
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
    borderColor: "#121214",
  },
  taskDeckTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  taskDeckSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
  },
  taskDeckTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  taskDeckTimeText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: "#a1a1aa",
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
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  taskDeckPrimaryBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: "#000000",
  },
  taskDeckSecondaryBtn: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  taskDeckSecondaryBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    color: "#ffffff",
  },
  todoListCard: {
    backgroundColor: "#121214",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#27272a",
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
    color: "#ffffff",
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
    backgroundColor: "#0a0a0c",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#1e1e24",
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
    color: "#ffffff",
  },
  todoItemSubtitle: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
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
    color: "#60a5fa",
  },
  quickReportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#18181b",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  fabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  fabBannerTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: "#ffffff",
  },
  fabBannerSub: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: "#8e8e8e",
    marginTop: 2,
  },
});
