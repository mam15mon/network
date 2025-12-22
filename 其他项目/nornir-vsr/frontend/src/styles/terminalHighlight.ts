import type { ThemePalette } from "./themeTypes";
import { hexToRgb, hexToRgba } from "../utils/colorUtils";

export type TerminalThemeMode = "light" | "dark";

export interface TerminalThemeBase {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  selectionForeground?: string;
  selectionInactiveBackground?: string;
}

export interface TerminalHighlightRule {
  name: string;
  regex: RegExp;
  color: string; // hex string without alpha
  priority: number;
}

export interface TerminalThemeConfig {
  base: TerminalThemeBase;
  rules: TerminalHighlightRule[];
}

type HighlightRole = "primary" | "info" | "warning" | "danger" | "success" | "neutral";

interface RawHighlightGroup {
  name: string;
  role: HighlightRole;
  priority: number;
  patterns: string[];
  flags?: string;
}

const createRegExp = (pattern: string, flags: string = "g"): RegExp => {
  const normalizedFlags = flags.includes("g") ? flags : `${flags}g`;
  return new RegExp(pattern, normalizedFlags);
};

const resolveRoleColor = (role: HighlightRole, palette: ThemePalette, mode: TerminalThemeMode): string => {
  const fallbackNeutral = mode === "dark" ? "#A5B4FC" : "#334155";
  switch (role) {
    case "primary":
      return palette.primary;
    case "info":
      return palette.info ?? palette.primary;
    case "warning":
      return palette.warning ?? palette.primary;
    case "danger":
      return palette.danger ?? palette.primary;
    case "success":
      return palette.success ?? palette.primary;
    case "neutral":
    default:
      return fallbackNeutral;
  }
};

const highlightGroups: RawHighlightGroup[] = [
  {
    name: "prompt",
    role: "primary",
    priority: 70,
    flags: "gmi",
    patterns: [
      "^\\w[^\\r\\n>#]*#",
      "^\\w[^\\r\\n>#]*>",
      "\\bhostname\\b",
    ],
  },
  {
    name: "interfaces",
    role: "info",
    priority: 60,
    flags: "gmi",
    patterns: [
      "\\bBAGG[0-9]+(?:[\\/.:][0-9]+)*[,:*]?(?:\\s|$)",
      "\\bFortyGigE[0-9]+(?:[\\/.:][0-9]+)+[,:*]?(?:\\s|$)",
      "\\bXGE[0-9]+(?:[\\/.:][0-9]+)+[,:*]?(?:\\s|$)",
      "\\bHundredGigE[0-9]+(?:[\\/.:][0-9]+)*[,:*]?(?:\\s|$)",
      "\\bBridge-Aggregation[0-9]+(?:\\.[0-9]+)*[,:*]?(?:\\s|$)",
      "\\bRoute-Aggregation[0-9]+(?:\\.[0-9]+)*[,:*]?(?:\\s|$)",
      "\\bVlan-interface[0-9]+[,:*]?(?:\\s|$)",
      "\\bLAG[0-9]+(?:[\\/.:][0-9]+)*[,:*]?(?:\\s|$)",
      "\\bEmbedded-Service-Engine\\d/\\d",
      "\\b[a-zA-Z]*[eE]thernet[0-9]+(?:[\\/.:][0-9]+)+[,:*]?(?:\\s|$)",
      "\\b[a-zA-Z]*[eE]thernet[0-9]+[,:*]?(?:\\s|$)",
      "\\b[efgt][a-z]*[0-9]+(?:[\\/.:][0-9]+)+[,:*]?(?:\\s|$)",
      "\\b[fgm][aeu][0-9]+[,:*]?(?:\\s|$)",
      "\\b(?:nvi|port-channel|Serial|Po|vfc)[0-9/,:|]+[,:*]?(?:\\s|$)",
      "\\b(?:multi|lo[^c]|tun|mgmt|null)[a-z]*[0-9]+,?",
      "\\bcon[0-9]?\\b|\\bvty\\b|\\bline\\b|\\baux\\b|\\bconsole\\b",
      "\\btrunk\\b",
    ],
  },
  {
    name: "fiberWwn",
    role: "info",
    priority: 60,
    flags: "gim",
    patterns: [
      "\\bwwn\\b|\\bpwwn\\b|(?:[a-f0-9]{2}:){7}[a-f0-9]{2}",
    ],
  },
  {
    name: "ipAddresses",
    role: "info",
    priority: 65,
    flags: "gim",
    patterns: [
      // IPv4: 整词匹配，避免截断，如 10.132.7.106 -> 全匹配
      "(?<![0-9])(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?:/(?:[0-9]{1,2})|:(?:[0-9]{1,5}))?(?![0-9])",
    ],
  },
  {
    name: "macAddresses",
    role: "info",
    priority: 64,
    flags: "gim",
    patterns: [
      "(?:[a-f0-9]{2}[:-]){5}[a-f0-9]{2}",
      "[a-f0-9]{4}\\.[a-f0-9]{4}\\.[a-f0-9]{4}",
    ],
  },
  {
    name: "versions",
    role: "info",
    priority: 50,
    flags: "gim",
    patterns: [
      "\\b\\d{1,3}\\.\\d{1,3}(?:\\.\\d{1,4})?(?:\\([^)]+\\))?",
    ],
  },
  {
    name: "serialNumbers",
    role: "warning",
    priority: 55,
    flags: "gim",
    patterns: [
      "\\b[a-z]{2}.\\d{4}.{4}\\b",
    ],
  },
  {
    name: "goodStatus",
    role: "success",
    priority: 85,
    flags: "gim",
    patterns: [
      // 确保关键词前后都有 \b，防止部分匹配。移除末尾的 (?:\\b|\\s|$) 统一处理
      "\\byes\\b|\\bpermit\\b|\\[OK\\]|(?<=^|\\s)on(?=$|\\s|[,;])|(?<=^|\\s)enable(?=$|\\s|[,;])|\\benabled\\b",
      "\\bdown->up\\b", // 增加边界
      "\\brunning\\b",
      "\\bSUCCESS(?:FUL)?\\b",
      "\\bsuccess(?:ful)?\\b",
      "\\bup\\b",
      "\\bpassed\\b",
      "\\bComplete\\b",
      "\\bactive\\b",
      "\\bconnected\\b",
      "\\ballow\\b",
    ],
  },
  {
    name: "badStatus",
    role: "danger",
    priority: 95,
    flags: "gim",
    patterns: [
      "\\b\\S*_ERR:",
      "\\bfail(?:ed|ure|ing)?\\b",
      "\\binvalid\\b",
      "\\breload\\b",
      // 这些词已经是 \b 包裹的，保持不变
      "\\b(undo|no|administratively|shut\\w*|never|deny|down)\\b",
      "\\b(not|initializing\\w*|off|des(?:56)?(?!cription)\\w*)\\b",
      // 关键修正：确保 telnet, half-duplex, disabled 有 \b
      "\\btelnet\\b|\\bhalf-duplex\\b|\\(err-disabled\\)|\\bdisabled\\b",
      "\\bup->down\\b|\\binhibit\\b", // 增加边界
      "\\bon-fail\\S*\\b", // 增加末尾边界，防止匹配到下一个词的开头
    ],
  },
  {
    name: "importantPrompts",
    role: "warning",
    priority: 80,
    flags: "gim",
    patterns: [
      "Building\\s+configuration\\.\\.\\.",
      "\\berase\\b|\\bremove\\b|\\bdelete\\b",
      "\\[confirm\\]|\\(yes/no\\)|\\[yes/no\\]",
      "-more-",
      "\\busername\\b|\\bpassword\\b|\\bkey\\b",
    ],
  },
  {
    name: "accessLists",
    role: "warning",
    priority: 78,
    flags: "gim",
    patterns: [
      "\\(hitcnt=0\\)",
      "\\(hitcnt=[1-9][0-9]*\\)",
      "\\baccess-(?:list|lists|class|group)\\b|\\buse-acl\\b|\\bprefix-list\\b|\\beq\\b", // 增加 \b 确保是完整关键词
      "\\btime-range\\b|\\bobject-group\\b|\\broute-map\\b|\\bany\\b", // 增加 \b 确保是完整关键词
    ],
  },
  {
    name: "progress",
    role: "primary",
    priority: 82,
    flags: "gmi",
    patterns: [
      "\\bremark\\b|\\*+|!+|###+|@+$", // 增加 \b 确保 remark 是完整关键词
      "\\bdescription\\b",
      "\\[(?:#+)(?:\\s|$)",
      "\\[#+\\]",
    ],
  },
  {
    name: "throughput",
    role: "info",
    priority: 52,
    flags: "gim",
    patterns: [
      "\\b(?:bits|packets)/sec\\b",
      "\\[\\d{1,3}/\\d{1,12}\\]",
      "\\(\\d{1,12}/\\d{1,12}\\)",
      "\\d{3,4}d\\d{2}h",
    ],
  },
  {
    name: "services",
    role: "info",
    priority: 54,
    flags: "gim",
    patterns: [
      // 关键修正：所有协议和服务都加上 \b 确保是完整单词
      "\\bftp\\b|\\bsftp\\b|\\btcp\\b|\\budp\\b|\\btftp\\b|\\bscp\\b|\\bssh\\b|\\bntp\\b|\\bsnmp\\w*\\b|\\binspect\\b|\\bicmp\\b",
      "\\brouter\\b|\\beigrp\\b|\\bbgp\\b|\\bospf\\b|\\brip\\b|\\bgre\\b|\\bhsrp\\b",
    ],
  },
  {
    name: "syslog",
    role: "info",
    priority: 66,
    flags: "gim",
    patterns: [
      "%.+-[0-9]-.+:",
      "\\b\\S+\\.(?:bin|tar)\\b",
    ],
  },
  {
    name: "miscKeywords",
    role: "neutral",
    priority: 45,
    flags: "gim",
    patterns: [
      // 增加 \b 确保是完整关键词
      "\\b(?:class|policy|service|parameter|match)(?:-map\\w*|-policy\\w*)?\\b",
      "\b(?:PN|SN|S/N|ID|PID|VID|DESCR):\b", // 增加 \b
      "\\b(Device|ID|Local|Intrfce|Holdtme|Capability|Platform|Port)\\b",
      "\\b(Hold|Uptime|Neighbor|State/Pf\\w*)\\b",
      "\\binterface\\b|\\bIP-Address\\b|\\bStatus\\b|\\bProtocol\\b",
      "\\baaa\\b|\\bvlan\\d*\\b|\\bMTU\\b|\\bBW\\b|\\bDLY\\b|\\bVl[0-9]+\\b",
    ],
  },
];
const isValidHexColor = (color: string): boolean => /^#?[0-9a-fA-F]{6}$/.test(color);

const normalizeHex = (color: string): string => {
  if (!isValidHexColor(color)) {
    return color;
  }
  return color.startsWith("#") ? color : `#${color}`;
};

export const createTerminalThemeConfig = (
  palette: ThemePalette,
  mode: TerminalThemeMode,
  primaryTextColor: string,
): TerminalThemeConfig => {
  const backgroundCandidate = normalizeHex(palette.contentBg ?? palette.cardBg ?? palette.bodyBg);
  const fallbackBackground = mode === "dark" ? "#111827" : "#f8fafc";
  const background = isValidHexColor(backgroundCandidate) ? backgroundCandidate : fallbackBackground;
  const fallbackForeground = mode === "dark" ? "#E2E8F0" : "#1F2937";
  const foreground = primaryTextColor.startsWith("#") ? primaryTextColor : fallbackForeground;
  const selectionBackground =
    hexToRgba(palette.primary, mode === "dark" ? 0.32 : 0.78) ??
    (mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(59,130,246,0.65)");
  const selectionForeground = mode === "dark" ? "#F8FAFC" : "#0F172A";
  const selectionInactiveBackground = mode === "dark"
    ? "rgba(255,255,255,0.12)"
    : "rgba(148,163,184,0.4)";
  const cursorColor = normalizeHex(palette.warning ?? palette.primary);
  const cursor =
    isValidHexColor(cursorColor) ? cursorColor : mode === "dark" ? "#FACC15" : "#B45309";

  const rules: TerminalHighlightRule[] = highlightGroups.flatMap((group) => {
    const color = normalizeHex(resolveRoleColor(group.role, palette, mode));
    if (!isValidHexColor(color)) {
      return [];
    }
    return group.patterns.map((pattern) => ({
      name: group.name,
      regex: createRegExp(pattern, group.flags ?? "g"),
      color,
      priority: group.priority,
    }));
  });

  return {
    base: {
      background,
      foreground,
      cursor,
      selectionBackground,
      selectionForeground,
      selectionInactiveBackground,
    },
    rules,
  };
};

export const buildAnsiColor = (hexColor: string): string | null => {
  const normalized = normalizeHex(hexColor);
  if (!isValidHexColor(normalized)) {
    return null;
  }
  const rgb = hexToRgb(normalized);
  if (!rgb) {
    return null;
  }
  return `\u001b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
};
