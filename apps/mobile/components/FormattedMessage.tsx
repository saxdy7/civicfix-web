import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme-context";
import { fontFamily, fontSize, radius, spacing } from "../lib/theme";

interface FormattedMessageProps {
  text: string;
  isUser?: boolean;
}

/**
 * Parses inline tokens (**bold**, `code/pill`, *italic*) into clean styled Text spans
 * without displaying raw asterisk symbols or backticks.
 */
function renderInlineSpans(
  rawText: string,
  textColor: string,
  badgeBg: string,
  badgeBorder: string,
  isUser: boolean,
) {
  // Regex to split by **bold**, `code`, or *italic*
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = rawText.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold (**text**)
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <Text
          key={idx}
          style={[
            styles.boldText,
            { color: textColor },
          ]}
        >
          {inner}
        </Text>
      );
    }

    // Inline Code / ID Badge (`code`)
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={idx}
          style={[
            styles.codePill,
            {
              backgroundColor: isUser ? "rgba(255,255,255,0.2)" : badgeBg,
              color: textColor,
              borderColor: badgeBorder,
            },
          ]}
        >
          {" "}{inner}{" "}
        </Text>
      );
    }

    // Italic (*text*)
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={idx}
          style={[
            styles.italicText,
            { color: textColor },
          ]}
        >
          {inner}
        </Text>
      );
    }

    // Plain text
    return (
      <Text key={idx} style={{ color: textColor }}>
        {part}
      </Text>
    );
  });
}

export function FormattedMessage({ text, isUser = false }: FormattedMessageProps) {
  const { colors } = useTheme();

  const textColor = isUser ? colors.inverseForeground : colors.foreground;
  const mutedColor = isUser ? "rgba(255,255,255,0.75)" : colors.mutedForeground;
  const badgeBg = colors.surfaceMuted;
  const badgeBorder = colors.border;

  // Split text by lines
  const rawLines = text.split("\n");

  return (
    <View style={styles.container}>
      {rawLines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <View key={lineIdx} style={styles.lineSpacer} />;
        }

        // Horizontal Rule
        if (/^─{3,}$|^---$/.test(trimmed)) {
          return (
            <View
              key={lineIdx}
              style={[
                styles.divider,
                { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : colors.border },
              ]}
            />
          );
        }

        // Heading (### Heading or ## Heading)
        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          const headingText = trimmed.replace(/^#+\s*/, "");
          return (
            <View key={lineIdx} style={styles.headingBlock}>
              <Text
                style={[
                  styles.headingText,
                  { color: textColor },
                ]}
              >
                {renderInlineSpans(headingText, textColor, badgeBg, badgeBorder, isUser)}
              </Text>
            </View>
          );
        }

        // Bullet point (• item or - item or * item)
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || (trimmed.startsWith("* ") && !trimmed.startsWith("**"))) {
          const itemText = trimmed.replace(/^[•\-*]\s*/, "");
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: isUser ? textColor : colors.civicBlue }]}>•</Text>
              <Text style={[styles.bulletText, { color: textColor }]}>
                {renderInlineSpans(itemText, textColor, badgeBg, badgeBorder, isUser)}
              </Text>
            </View>
          );
        }

        // Numbered list item (1. item, 2. item)
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numberMatch) {
          const num = numberMatch[1];
          const itemText = numberMatch[2];
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={[styles.numberPrefix, { color: isUser ? textColor : colors.civicBlue }]}>
                {num}.
              </Text>
              <Text style={[styles.bulletText, { color: textColor }]}>
                {renderInlineSpans(itemText, textColor, badgeBg, badgeBorder, isUser)}
              </Text>
            </View>
          );
        }

        // Standard paragraph line
        return (
          <Text key={lineIdx} style={[styles.paragraph, { color: textColor }]}>
            {renderInlineSpans(trimmed, textColor, badgeBg, badgeBorder, isUser)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 3,
    width: "100%",
  },
  lineSpacer: {
    height: 6,
  },
  divider: {
    height: 1,
    marginVertical: 6,
    width: "100%",
  },
  headingBlock: {
    marginTop: 4,
    marginBottom: 2,
  },
  headingText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    lineHeight: 22,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    lineHeight: 21,
  },
  boldText: {
    fontFamily: fontFamily.bold,
    fontWeight: "700",
  },
  italicText: {
    fontFamily: fontFamily.regular,
    fontStyle: "italic",
  },
  codePill: {
    fontFamily: fontFamily.display || fontFamily.semibold,
    fontSize: 12,
    fontWeight: "600",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingLeft: 2,
    marginVertical: 1,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  numberPrefix: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fontFamily.bold,
    minWidth: 16,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
});
