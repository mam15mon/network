import { CSSProperties } from "react";
import type { ReactNode } from "react";
import type { GlobalToken } from "antd/es/theme/interface";
import type { TerminalThemeConfig, TerminalThemeMode } from "../styles/terminalHighlight";
import { hexToRgba } from "./colorUtils";

export interface HighlightRule {
  regex: RegExp;
  style: CSSProperties;
}

interface HighlightSegment {
  text: string;
  style?: CSSProperties;
}

const ensureGlobalRegex = (regex: RegExp): RegExp => {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return new RegExp(regex.source, flags);
};

const applyHighlightRules = (text: string, rules: HighlightRule[]): HighlightSegment[] => {
  let segments: HighlightSegment[] = [{ text }];

  rules.forEach((rule) => {
    const nextSegments: HighlightSegment[] = [];

    segments.forEach((segment) => {
      if (segment.style || segment.text.length === 0) {
        nextSegments.push(segment);
        return;
      }

      const regex = ensureGlobalRegex(rule.regex);
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let matched = false;

      while ((match = regex.exec(segment.text)) !== null) {
        if (match.index > lastIndex) {
          nextSegments.push({ text: segment.text.slice(lastIndex, match.index) });
        }

        const matchText = match[0];
        if (matchText.length === 0) {
          // Skip zero-length matches to avoid infinite loops
          regex.lastIndex += 1;
          continue;
        }

        matched = true;
        nextSegments.push({ text: matchText, style: rule.style });
        lastIndex = match.index + matchText.length;
      }

      if (!matched) {
        nextSegments.push(segment);
        return;
      }

      if (lastIndex < segment.text.length) {
        nextSegments.push({ text: segment.text.slice(lastIndex) });
      }
    });

    segments = nextSegments;
  });

  return segments;
};

export const highlightTextWithRules = (text: string | undefined, rules: HighlightRule[]): ReactNode[] => {
  const normalized = text && text.length > 0 ? text : "(无输出)";
  const lines = normalized.split("\n");
  const nodes: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    const segments = applyHighlightRules(line, rules);

    if (segments.length === 0) {
      nodes.push("\u00A0");
    } else {
      segments.forEach((segment, segmentIndex) => {
        if (segment.style) {
          nodes.push(
            <span key={`segment-${lineIndex}-${segmentIndex}`} style={segment.style}>
              {segment.text}
            </span>,
          );
        } else {
          nodes.push(segment.text);
        }
      });
      if (segments.length === 1 && segments[0].text.length === 0) {
        nodes.push("\u00A0");
      }
    }

    if (lineIndex < lines.length - 1) {
      nodes.push(<br key={`br-${lineIndex}`} />);
    }
  });

  return nodes;
};

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 4,
  padding: "0 4px",
  margin: "0 1px",
  fontWeight: 600,
  lineHeight: "inherit",
};

export const createHighlightRules = (token: GlobalToken): HighlightRule[] => {
  const outlineColor = token.colorBorderSecondary ?? token.colorBorder ?? token.colorText;

  const withStyle = (bg: string, color: string): CSSProperties => ({
    ...baseStyle,
    backgroundColor: bg,
    color,
    boxShadow: `inset 0 0 0 1px ${outlineColor}`,
  });

  return [
    {
      regex: /\b(down|fail(?:ed)?|error|critical|alarm|panic|reset|block|loop)\b/gi,
      style: withStyle(
        token.colorErrorBg ?? "rgba(208, 48, 80, 0.18)",
        token.colorErrorText ?? token.colorError ?? "#b71d26",
      ),
    },
    {
      regex: /\b(warn(?:ing)?|alert|degraded|flap|exceed(?:ed)?)\b/gi,
      style: withStyle(
        token.colorWarningBg ?? "rgba(250, 173, 20, 0.25)",
        token.colorWarningText ?? token.colorWarning ?? "#8c6d1f",
      ),
    },
    {
      regex: /\b(up|success|normal|ready|active)\b/gi,
      style: withStyle(
        token.colorSuccessBg ?? "rgba(56, 158, 13, 0.22)",
        token.colorSuccessText ?? token.colorSuccess ?? "#2b7a0b",
      ),
    },
    {
      regex:
        /\b(?:(?:ten-)?gigabit(?:ethernet)?|x?ge|vlan-interface|loopback|serial|bridge-aggregation)\s*\d+(?:\/\d+)*\b/gi,
      style: withStyle(
        token.colorInfoBg ?? "rgba(34, 128, 229, 0.18)",
        token.colorInfoText ?? token.colorInfo ?? "#2468c1",
      ),
    },
    {
      regex: /\b\d+(?:\.\d+)?%\b/g,
      style: withStyle(
        token.colorFillSecondary ?? token.colorFillAlter ?? "rgba(15, 76, 129, 0.16)",
        token.colorText,
      ),
    },
    {
      regex: /\b\d+(?:\.\d+)?(?:k|m|g)bps\b/gi,
      style: withStyle(
        token.colorFillSecondary ?? token.colorFillAlter ?? "rgba(15, 76, 129, 0.16)",
        token.colorText,
      ),
    },
    {
      regex: /\b\d+(?:°c)\b/gi,
      style: withStyle(
        token.colorFillSecondary ?? token.colorFillAlter ?? "rgba(15, 76, 129, 0.16)",
        token.colorText,
      ),
    },
    {
      regex: /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g,
      style: withStyle(
        token.colorFillTertiary ?? token.colorFillSecondary ?? token.colorFillAlter ?? "rgba(73, 149, 255, 0.16)",
        token.colorTextSecondary ?? token.colorText,
      ),
    },
  ];
};

const normalizeCssRule = (token: GlobalToken, background: string, foreground: string): CSSProperties => {
  const outlineColor = token.colorBorderSecondary ?? token.colorBorder ?? token.colorText;
  return {
    ...baseStyle,
    backgroundColor: background,
    color: foreground,
    boxShadow: `inset 0 0 0 1px ${outlineColor}`,
  };
};

export const createHighlightRulesFromTerminalTheme = (
  terminalThemeConfig: TerminalThemeConfig | null | undefined,
  token: GlobalToken,
  mode: TerminalThemeMode,
): HighlightRule[] => {
  if (!terminalThemeConfig?.rules?.length) {
    return createHighlightRules(token);
  }

  const backgroundAlpha = mode === "dark" ? 0.32 : 0.2;
  const fallbackBackground = mode === "dark" ? "rgba(148, 163, 184, 0.28)" : "rgba(59, 130, 246, 0.18)";

  return [...terminalThemeConfig.rules]
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => {
      const background = hexToRgba(rule.color, backgroundAlpha) ?? fallbackBackground;
      return {
        regex: rule.regex,
        style: normalizeCssRule(token, background, rule.color),
      };
    });
};
