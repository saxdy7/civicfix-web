import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Share,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "../../lib/auth-context";
import { useTheme } from "../../lib/theme-context";
import { createIssue, fetchMyIssues, uploadIssuePhoto } from "../../lib/repositories/issues";
import { fontFamily, fontSize, radius, spacing } from "../../lib/theme";
import { processCivicAssistantQuery, type AIResponse } from "../../lib/ai-assistant-engine";
import { FormattedMessage } from "../../components/FormattedMessage";
import {
  deleteChatSession,
  generateChatTitle,
  loadAllChatSessions,
  saveChatSession,
  type ChatMessage,
  type ChatSession,
} from "../../lib/chat-sessions";

const QUICK_PROMPTS = [
  "🔍 Track my pending report",
  "📋 Steps to raise a report",
  "🕳️ Pothole on main road",
  "🗳️ Community voting & SLA",
  "🗑️ How to delete a report",
];

const AVAILABLE_MODELS = [
  { id: "Quantum 3", name: "Quantum 3 (Default)", desc: "Ultra-fast multimodal civic reasoning" },
  { id: "CivicBot 3.1", name: "CivicBot 3.1 Pro", desc: "Specialized municipal dispatch & SLA knowledge" },
  { id: "Llama 4 Vision", name: "Llama 4 Vision", desc: "High-precision photo defect detection" },
];

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AssistantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState("Quantum 3");
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals & Drawers
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showModelSheet, setShowModelSheet] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(`session-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load chat history on mount / focus
  const loadHistory = useCallback(async () => {
    const loaded = await loadAllChatSessions();
    setSessions(loaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  // Request location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            address: "Current GPS Location",
          });
        }
      } catch {
        // Location optional
      }
    })();
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please enable photo permissions in settings.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        base64: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setAttachedPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined });
      }
    } catch {
      Alert.alert("Error", "Could not select photo.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please enable camera permissions in settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        base64: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setAttachedPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined });
      }
    } catch {
      Alert.alert("Error", "Could not take photo.");
    }
  };

  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([]);
    setInput("");
    setAttachedPhoto(null);
    setShowHistoryDrawer(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistoryDrawer(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const updated = await deleteChatSession(sessionId);
    setSessions(updated);
    if (currentSessionId === sessionId) {
      handleStartNewChat();
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend && !attachedPhoto) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend || "Attached photo for civic analysis.",
      createdAt: Date.now(),
      extracted: {
        photoUri: attachedPhoto?.uri || undefined,
        photoBase64: attachedPhoto?.base64 || undefined,
      },
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    const photoToProcess = attachedPhoto;
    setAttachedPhoto(null);
    setLoading(true);

    try {
      const userIssues = user ? await fetchMyIssues(user.id) : [];
      const aiResult: AIResponse = processCivicAssistantQuery(
        textToSend,
        photoToProcess,
        currentLocation,
        userIssues,
      );

      const botReply: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: aiResult.text,
        createdAt: Date.now(),
        extracted: aiResult.extracted,
        actions: aiResult.actions,
      };

      const finalMessages = [...updatedMessages, botReply];
      setMessages(finalMessages);

      const sessionTitle =
        sessions.find((s) => s.id === currentSessionId)?.title ||
        generateChatTitle(userMsg.text);

      const sessionObj: ChatSession = {
        id: currentSessionId,
        title: sessionTitle,
        messages: finalMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveChatSession(sessionObj);
      loadHistory();
    } catch (err: unknown) {
      console.warn("CivicBot error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (msg: ChatMessage, act: { actionId: string; promptPayload?: string }) => {
    if (act.actionId === "quick_prompt" && act.promptPayload) {
      sendMessage(act.promptPayload);
      return;
    }

    if (act.actionId === "view_report_detail" && act.promptPayload) {
      router.push(`/reports/${act.promptPayload}` as any);
      return;
    }

    if (act.actionId === "go_to_report") {
      router.push("/(tabs)/report");
      return;
    }

    if (act.actionId === "go_to_my_reports" || act.actionId === "modify_report") {
      router.push("/(tabs)/my-reports");
      return;
    }

    if (act.actionId === "go_to_community") {
      router.push("/(tabs)/community");
      return;
    }

    if (act.actionId === "confirm_report" && msg.extracted) {
      if (!user) {
        Alert.alert("Sign In Required", "Please sign in to file a civic report.", [
          { text: "Sign In", onPress: () => router.push("/sign-in") },
        ]);
        return;
      }

      setLoading(true);
      try {
        const result = await createIssue({
          category: msg.extracted.category || "other",
          severity: msg.extracted.severity || "medium",
          description: msg.extracted.description || "Reported via CivicBot AI",
          latitude: msg.extracted.latitude || 31.2542,
          longitude: msg.extracted.longitude || 75.7054,
          neighborhood: msg.extracted.locationText || "Civic Area",
        });

        if ("error" in result) {
          Alert.alert("Submission Error", result.error);
          setLoading(false);
          return;
        }

        if (msg.extracted.photoUri && msg.extracted.photoBase64) {
          await uploadIssuePhoto(result.issueId, {
            uri: msg.extracted.photoUri,
            base64: msg.extracted.photoBase64,
            mimeType: "image/jpeg",
          });
        }

        const successMsg: ChatMessage = {
          id: `bot-success-${Date.now()}`,
          sender: "bot",
          text: `🎉 **Report Submitted Successfully!**\n\n• **Tracking ID**: \`${result.trackingId}\`\n• **Status**: \`Reported\`\n• **Department**: Routed to municipal dispatch.\n\nYou can track live progress in the **My Reports** tab.`,
          createdAt: Date.now(),
          actions: [
            { label: "🔍 Track This Report", actionId: "view_report_detail", variant: "primary", promptPayload: result.issueId },
            { label: "📄 Go to My Reports", actionId: "go_to_my_reports", variant: "secondary" },
          ],
        };

        const finalWithSuccess = [...messages, successMsg];
        setMessages(finalWithSuccess);

        await saveChatSession({
          id: currentSessionId,
          title: "Civic Issue Submission",
          messages: finalWithSuccess,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        loadHistory();
      } catch {
        Alert.alert("Error", "Could not submit report.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await Share.share({ message: text });
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleToggleLike = (id: string) => {
    setLikedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayName = user?.name ? user.name.split(" ")[0] : "Resident";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={[styles.keyboardContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* 1. TOP HEADER */}
        <View style={[styles.topNavHeader, { borderBottomColor: colors.border }]}>
          <Pressable
            style={[styles.menuIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              loadHistory();
              setShowHistoryDrawer(true);
            }}
          >
            <Ionicons name="menu-outline" size={20} color={colors.foreground} />
          </Pressable>

          <Pressable
            style={[styles.planBadgeContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowModelSheet(true)}
          >
            <Text style={[styles.planBadgeText, { color: colors.foreground }]}>
              {selectedModel} · <Text style={{ color: "#22c55e", fontWeight: "700" }}>Online</Text>
            </Text>
          </Pressable>

          <Pressable
            style={[styles.resetBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleStartNewChat}
          >
            <Ionicons name="add-outline" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* 2. CHAT SCROLL AREA */}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.messagesScroll, { backgroundColor: colors.background }]}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 ? styles.emptyCenterContent : null,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyHeroContainer}>
              <View style={[styles.heroLogoWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={32} color={colors.foreground} />
              </View>
              <Text style={[styles.emptyHeroGreeting, { color: colors.foreground }]}>
                Good Morning, {displayName}
              </Text>
              <Text style={[styles.emptyHeroSub, { color: colors.mutedForeground }]}>
                Ask anything about CivicFix, track live reports, or describe a defect.
              </Text>

              <View style={styles.quickPromptsDeck}>
                {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                  <Pressable
                    key={prompt}
                    style={[styles.heroPromptPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => sendMessage(prompt)}
                  >
                    <Text style={[styles.heroPromptPillText, { color: colors.foreground }]}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === "user";

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowBot,
                  ]}
                >
                  {msg.extracted?.photoUri ? (
                    <Image
                      source={{ uri: msg.extracted.photoUri }}
                      style={styles.msgPhotoPreview}
                    />
                  ) : null}

                  <View
                    style={[
                      styles.bubbleContainer,
                      isUser
                        ? [styles.bubbleUser, { backgroundColor: colors.inverseBackground }]
                        : [styles.bubbleBot],
                    ]}
                  >
                    <FormattedMessage text={msg.text} isUser={isUser} />

                    {msg.actions && msg.actions.length > 0 && (
                      <View style={styles.bubbleActionsWrap}>
                        {msg.actions.map((act) => (
                          <Pressable
                            key={act.label}
                            style={[
                              styles.bubbleActionBtn,
                              act.variant === "primary"
                                ? [styles.bubbleActionPrimary, { backgroundColor: colors.inverseBackground }]
                                : [styles.bubbleActionSecondary, { backgroundColor: colors.surface, borderColor: colors.border }],
                            ]}
                            onPress={() => handleAction(msg, act)}
                          >
                            <Text
                              style={[
                                styles.bubbleActionText,
                                act.variant === "primary"
                                  ? { color: colors.inverseForeground }
                                  : { color: colors.foreground },
                              ]}
                            >
                              {act.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {!isUser && (
                    <View style={styles.botUtilityRow}>
                      <Pressable
                        style={styles.utilityIconBtn}
                        onPress={() => handleCopy(msg.id, msg.text)}
                      >
                        <Ionicons
                          name={copiedId === msg.id ? "checkmark" : "copy-outline"}
                          size={15}
                          color={copiedId === msg.id ? "#22c55e" : colors.mutedForeground}
                        />
                      </Pressable>

                      <Pressable
                        style={styles.utilityIconBtn}
                        onPress={() => handleToggleLike(msg.id)}
                      >
                        <Ionicons
                          name={likedMessages.has(msg.id) ? "thumbs-up" : "thumbs-up-outline"}
                          size={15}
                          color={likedMessages.has(msg.id) ? colors.foreground : colors.mutedForeground}
                        />
                      </Pressable>

                      <Pressable style={styles.utilityIconBtn}>
                        <Ionicons name="thumbs-down-outline" size={15} color={colors.mutedForeground} />
                      </Pressable>

                      <Pressable
                        style={styles.utilityIconBtn}
                        onPress={() => sendMessage("Tell me more details about this")}
                      >
                        <Ionicons name="share-outline" size={15} color={colors.mutedForeground} />
                      </Pressable>

                      <Pressable
                        style={styles.utilityIconBtn}
                        onPress={() => sendMessage("Re-analyze this issue")}
                      >
                        <Ionicons name="reload-outline" size={15} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {loading && (
            <View style={styles.typingIndicatorRow}>
              <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.foreground} />
                <Text style={[styles.typingText, { color: colors.mutedForeground }]}>CivicBot is thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Attached Photo Preview Chip */}
        {attachedPhoto && (
          <View style={[styles.attachedPreviewChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Image source={{ uri: attachedPhoto.uri }} style={styles.attachedThumbnail} />
            <Text style={[styles.attachedText, { color: colors.foreground }]} numberOfLines={1}>Photo attached for analysis</Text>
            <Pressable onPress={() => setAttachedPhoto(null)}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
            </Pressable>
          </View>
        )}

        {/* 3. FLOATING BOTTOM INPUT DOCK */}
        <View style={[styles.bottomDockContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.dockTextInput, { color: colors.foreground }]}
            placeholder="How can I help you today?"
            placeholderTextColor={colors.dimForeground}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            multiline={false}
          />

          <View style={styles.dockActionBar}>
            <Pressable
              style={[styles.dockPlusBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={() => setShowAttachSheet(true)}
            >
              <Ionicons name="add" size={20} color={colors.foreground} />
            </Pressable>

            <Pressable
              style={[styles.modelSelectorPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={() => setShowModelSheet(true)}
            >
              <Text style={[styles.modelSelectorText, { color: colors.foreground }]}>{selectedModel}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.mutedForeground} />
            </Pressable>

            <View style={{ flex: 1 }} />

            <Pressable
              style={styles.dockMicBtn}
              onPress={() => sendMessage("Give us steps to rise a report or issue in this platform")}
            >
              <Ionicons name="mic-outline" size={18} color={colors.mutedForeground} />
            </Pressable>

            <Pressable
              style={[
                styles.dockSendBtn,
                (input.trim() || attachedPhoto)
                  ? [styles.dockSendBtnActive, { backgroundColor: colors.inverseBackground }]
                  : [styles.dockSendBtnInactive, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }],
              ]}
              onPress={() => sendMessage()}
            >
              <Ionicons
                name={(input.trim() || attachedPhoto) ? "arrow-up" : "pulse-outline"}
                size={18}
                color={(input.trim() || attachedPhoto) ? colors.inverseForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>

        {/* 4. CHAT HISTORY DRAWER MODAL */}
        <Modal
          visible={showHistoryDrawer}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHistoryDrawer(false)}
        >
          <View style={styles.drawerBackdrop}>
            <Pressable
              style={styles.drawerDismissArea}
              onPress={() => setShowHistoryDrawer(false)}
            />

            <View style={[styles.drawerSidebarContainer, { backgroundColor: colors.surface, borderLeftColor: colors.border }]}>
              <View style={styles.drawerHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="chatbubbles" size={20} color={colors.foreground} />
                  <Text style={[styles.drawerHeaderTitle, { color: colors.foreground }]}>Chat History</Text>
                </View>

                <Pressable
                  style={styles.drawerCloseIconBtn}
                  onPress={() => setShowHistoryDrawer(false)}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
              </View>

              <Pressable
                style={[styles.drawerNewChatBtn, { backgroundColor: colors.inverseBackground }]}
                onPress={handleStartNewChat}
              >
                <Ionicons name="add-circle" size={18} color={colors.inverseForeground} />
                <Text style={[styles.drawerNewChatBtnText, { color: colors.inverseForeground }]}>New Conversation</Text>
              </Pressable>

              <Text style={[styles.drawerSectionLabel, { color: colors.mutedForeground }]}>Recent Conversations</Text>

              <ScrollView
                style={styles.drawerSessionsScroll}
                contentContainerStyle={styles.drawerSessionsContent}
                showsVerticalScrollIndicator={false}
              >
                {sessions.length === 0 ? (
                  <View style={styles.emptyDrawerWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.dimForeground} />
                    <Text style={[styles.emptyDrawerText, { color: colors.mutedForeground }]}>No past conversations yet.</Text>
                    <Text style={[styles.emptyDrawerSub, { color: colors.dimForeground }]}>Your chats with CivicBot will be automatically saved here.</Text>
                  </View>
                ) : (
                  sessions.map((session) => {
                    const isCurrent = session.id === currentSessionId;

                    return (
                      <Pressable
                        key={session.id}
                        style={[
                          styles.sessionCard,
                          isCurrent
                            ? [styles.sessionCardActive, { backgroundColor: colors.surfaceMuted, borderColor: colors.foreground }]
                            : [styles.sessionCardInactive, { backgroundColor: colors.background, borderColor: colors.border }],
                        ]}
                        onPress={() => handleSelectSession(session)}
                      >
                        <Ionicons
                          name={isCurrent ? "chatbubble" : "chatbubble-outline"}
                          size={16}
                          color={isCurrent ? colors.foreground : colors.mutedForeground}
                        />

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              styles.sessionTitleText,
                              { color: colors.foreground, fontFamily: isCurrent ? fontFamily.bold : fontFamily.medium },
                            ]}
                            numberOfLines={1}
                          >
                            {session.title}
                          </Text>
                          <Text style={[styles.sessionTimeText, { color: colors.mutedForeground }]}>{formatTime(session.updatedAt)}</Text>
                        </View>

                        <Pressable
                          style={styles.sessionDeleteBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        >
                          <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 5. PHOTO ATTACHMENT BOTTOM SHEET */}
        <Modal
          visible={showAttachSheet}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAttachSheet(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAttachSheet(false)}
          >
            <Pressable style={[styles.bottomSheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Attach Photo Evidence</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                AI vision will automatically inspect the defect, categorize it, and pin GPS coordinates.
              </Text>

              <View style={styles.sheetTilesList}>
                <Pressable
                  style={[styles.sheetOptionTile, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => {
                    setShowAttachSheet(false);
                    setTimeout(handleTakePhoto, 300);
                  }}
                >
                  <View style={[styles.sheetIconCircleWhite, { backgroundColor: colors.inverseBackground }]}>
                    <Ionicons name="camera" size={22} color={colors.inverseForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: colors.foreground }]}>Take Live Photo</Text>
                    <Text style={[styles.sheetOptionSub, { color: colors.mutedForeground }]}>Snap on-site damage (road, lighting, waste)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </Pressable>

                <Pressable
                  style={[styles.sheetOptionTile, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                  onPress={() => {
                    setShowAttachSheet(false);
                    setTimeout(handlePickImage, 300);
                  }}
                >
                  <View style={[styles.sheetIconCircleDark, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="images" size={20} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: colors.foreground }]}>Choose from Library</Text>
                    <Text style={[styles.sheetOptionSub, { color: colors.mutedForeground }]}>Select an existing image from camera roll</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <Pressable
                style={[styles.sheetCancelBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={() => setShowAttachSheet(false)}
              >
                <Text style={[styles.sheetCancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* 6. MODEL SELECTOR BOTTOM SHEET */}
        <Modal
          visible={showModelSheet}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowModelSheet(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowModelSheet(false)}
          >
            <Pressable style={[styles.bottomSheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Select AI Model</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                Choose the neural engine powering CivicFix conversation and vision.
              </Text>

              <View style={styles.sheetTilesList}>
                {AVAILABLE_MODELS.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[
                        styles.sheetOptionTile,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                        isSelected ? { borderColor: colors.foreground } : null,
                      ]}
                      onPress={() => {
                        setSelectedModel(m.id);
                        setShowModelSheet(false);
                      }}
                    >
                      <View
                        style={[
                          styles.sheetIconCircleDark,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          isSelected ? { backgroundColor: colors.inverseBackground } : null,
                        ]}
                      >
                        <Ionicons
                          name="hardware-chip"
                          size={18}
                          color={isSelected ? colors.inverseForeground : colors.foreground}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sheetOptionTitle, { color: colors.foreground }]}>{m.name}</Text>
                        <Text style={[styles.sheetOptionSub, { color: colors.mutedForeground }]}>{m.desc}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.sheetCancelBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={() => setShowModelSheet(false)}
              >
                <Text style={[styles.sheetCancelBtnText, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  topNavHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  menuIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  planBadgeContainer: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
  },
  resetBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[4],
  },
  emptyCenterContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyHeroContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    gap: 12,
  },
  heroLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  emptyHeroGreeting: {
    fontSize: 28,
    fontFamily: fontFamily.bold,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  emptyHeroSub: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  quickPromptsDeck: {
    gap: 8,
    width: "100%",
    marginTop: spacing[4],
  },
  heroPromptPill: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  heroPromptPillText: {
    fontSize: 13,
    fontFamily: fontFamily.medium,
  },
  messageRow: {
    width: "100%",
    gap: 6,
  },
  messageRowUser: {
    alignItems: "flex-end",
  },
  messageRowBot: {
    alignItems: "flex-start",
  },
  msgPhotoPreview: {
    width: 180,
    height: 120,
    borderRadius: 14,
    marginBottom: 4,
  },
  bubbleContainer: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "88%",
  },
  bubbleUser: {},
  bubbleBot: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 4,
    maxWidth: "96%",
  },
  messageText: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  bubbleActionsWrap: {
    gap: 8,
    marginTop: 12,
    width: "100%",
  },
  bubbleActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleActionPrimary: {},
  bubbleActionSecondary: {
    borderWidth: 1,
  },
  bubbleActionText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  botUtilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    paddingLeft: 2,
  },
  utilityIconBtn: {
    padding: 4,
  },
  typingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 4,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  typingText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
  attachedPreviewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  attachedThumbnail: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  attachedText: {
    fontSize: 12,
    fontFamily: fontFamily.medium,
    maxWidth: 200,
  },
  bottomDockContainer: {
    borderRadius: 26,
    borderWidth: 1,
    marginHorizontal: 14,
    marginBottom: Platform.OS === "ios" ? 6 : 12,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  dockTextInput: {
    fontSize: 15,
    fontFamily: fontFamily.regular,
    minHeight: 24,
    paddingVertical: 0,
  },
  dockActionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  dockPlusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modelSelectorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  modelSelectorText: {
    fontSize: 11,
    fontFamily: fontFamily.medium,
  },
  dockMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dockSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dockSendBtnActive: {},
  dockSendBtnInactive: {
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 19,
    fontFamily: fontFamily.bold,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  sheetTilesList: {
    gap: 10,
    marginVertical: 6,
  },
  sheetOptionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  sheetIconCircleWhite: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIconCircleDark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  sheetOptionSub: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  sheetCancelBtn: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  sheetCancelBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    flexDirection: "row",
  },
  drawerDismissArea: {
    flex: 1,
  },
  drawerSidebarContainer: {
    width: "82%",
    maxWidth: 320,
    borderLeftWidth: 1,
    paddingTop: Platform.OS === "ios" ? 54 : 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 14,
  },
  drawerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
  },
  drawerHeaderTitle: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
  },
  drawerCloseIconBtn: {
    padding: 6,
  },
  drawerNewChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radius.pill,
  },
  drawerNewChatBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
  },
  drawerSectionLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  drawerSessionsScroll: {
    flex: 1,
  },
  drawerSessionsContent: {
    gap: 8,
    paddingBottom: 16,
  },
  emptyDrawerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyDrawerText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  emptyDrawerSub: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textAlign: "center",
    maxWidth: 200,
    lineHeight: 15,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  sessionCardActive: {},
  sessionCardInactive: {},
  sessionTitleText: {
    fontSize: 13,
  },
  sessionTimeText: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  sessionDeleteBtn: {
    padding: 6,
  },
});
