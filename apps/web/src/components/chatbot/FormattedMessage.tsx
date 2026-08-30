import React from "react";

interface FormattedMessageProps {
  text: string;
  isUser?: boolean;
}

/**
 * Parses inline tokens (**bold**, `code/pill`, *italic*) into styled React nodes
 * without displaying raw asterisk symbols or backticks.
 */
function renderInlineSpans(rawText: string, isUser: boolean): React.ReactNode {
  // Regex to split by **bold**, `code`, or *italic*
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = rawText.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold (**text**)
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={idx}
          style={{
            fontWeight: 700,
            color: isUser ? "inherit" : "var(--color-foreground, #0f172a)",
          }}
        >
          {inner}
        </strong>
      );
    }

    // Inline Code / ID Badge (`code`)
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.85em",
            padding: "2px 6px",
            borderRadius: "4px",
            background: isUser ? "rgba(255, 255, 255, 0.2)" : "var(--color-surface-muted, #f1f5f9)",
            border: isUser ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid var(--color-border, #e2e8f0)",
            color: "inherit",
          }}
        >
          {inner}
        </code>
      );
    }

    // Italic (*text*)
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return <em key={idx}>{inner}</em>;
    }

    // Plain text
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function FormattedMessage({ text, isUser = false }: FormattedMessageProps) {
  const rawLines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", lineHeight: 1.5 }}>
      {rawLines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={lineIdx} style={{ height: "4px" }} />;
        }

        // Horizontal Rule
        if (/^─{3,}$|^---$/.test(trimmed)) {
          return (
            <hr
              key={lineIdx}
              style={{
                border: "none",
                borderTop: isUser ? "1px solid rgba(255,255,255,0.2)" : "1px solid var(--color-border, #e2e8f0)",
                margin: "4px 0",
              }}
            />
          );
        }

        // Heading (### Heading or ## Heading)
        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          const headingText = trimmed.replace(/^#+\s*/, "");
          return (
            <div
              key={lineIdx}
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                marginTop: "4px",
                color: isUser ? "inherit" : "var(--color-foreground, #0f172a)",
              }}
            >
              {renderInlineSpans(headingText, isUser)}
            </div>
          );
        }

        // Bullet point (• item or - item or * item)
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || (trimmed.startsWith("* ") && !trimmed.startsWith("**"))) {
          const itemText = trimmed.replace(/^[•\-*]\s*/, "");
          return (
            <div
              key={lineIdx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                paddingLeft: "2px",
              }}
            >
              <span
                style={{
                  color: isUser ? "inherit" : "var(--color-primary, #0284c7)",
                  fontWeight: 700,
                  lineHeight: "1.3",
                }}
              >
                •
              </span>
              <span style={{ flex: 1 }}>{renderInlineSpans(itemText, isUser)}</span>
            </div>
          );
        }

        // Numbered list item (1. item, 2. item)
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numberMatch) {
          const num = numberMatch[1];
          const itemText = numberMatch[2];
          return (
            <div
              key={lineIdx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                paddingLeft: "2px",
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: isUser ? "inherit" : "var(--color-primary, #0284c7)",
                  minWidth: "16px",
                }}
              >
                {num}.
              </span>
              <span style={{ flex: 1 }}>{renderInlineSpans(itemText, isUser)}</span>
            </div>
          );
        }

        // Standard paragraph line
        return (
          <div key={lineIdx} style={{ margin: 0 }}>
            {renderInlineSpans(trimmed, isUser)}
          </div>
        );
      })}
    </div>
  );
}
