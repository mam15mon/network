import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Space, Tag, Typography, Button, message, Switch, InputNumber, Tooltip } from "antd";
import { LinkOutlined, ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { IDisposable } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import type { Host } from "../api/hosts";
import type { TerminalThemeConfig } from "../styles/terminalHighlight";
import { buildAnsiColor } from "../styles/terminalHighlight";

import "@xterm/xterm/css/xterm.css";

const { Text } = Typography;

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const ensureAbsoluteApiBase = (): string => {
  if (typeof window === "undefined") {
    return API_BASE;
  }
  if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
    return API_BASE;
  }
  const normalized = API_BASE.startsWith("/") ? API_BASE : `/${API_BASE}`;
  return `${window.location.origin}${normalized}`;
};

const buildTerminalUrl = (hostName: string, token?: string): string => {
  const base = ensureAbsoluteApiBase().replace(/\/$/, "");
  const path = `${base}/ws/hosts/${encodeURIComponent(hostName)}/terminal`;
  const url = new URL(path);
  url.protocol = url.protocol.replace("http", "ws");
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

interface HostTerminalModalProps {
  host: Host | null;
  open: boolean;
  onClose: () => void;
  terminalThemeConfig: TerminalThemeConfig;
  accessToken?: string;
}

interface TerminalStatusSnapshot {
  title: string;
  color: string;
}

const statusMeta: Record<ConnectionStatus, TerminalStatusSnapshot> = {
  idle: { title: "未连接", color: "default" },
  connecting: { title: "连接中", color: "processing" },
  connected: { title: "已连接", color: "success" },
  disconnected: { title: "已断开", color: "warning" },
  error: { title: "异常", color: "error" },
};

interface HighlightRuleRuntime {
  name: string;
  regex: RegExp;
  priority: number;
  open: string;
}

const ANSI_RESET_FG = "\u001b[39m";

const HostTerminalModal = ({ host, open, onClose, terminalThemeConfig, accessToken }: HostTerminalModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // ClipboardAddon 会与自定义复制逻辑重复，移除以避免重复提示
  const socketRef = useRef<WebSocket | null>(null);
  const resizeListenerRef = useRef<(() => void) | null>(null);
  const dataListenerRef = useRef<IDisposable | null>(null);
  const resizeDisposableRef = useRef<IDisposable | null>(null);
  const initializationRetryRef = useRef<number | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  // 粘贴节流设置
  const [pasteDelayEnabled, setPasteDelayEnabled] = useState<boolean>(true);
  const [pasteDelayMs, setPasteDelayMs] = useState<number>(50);
  const [pasteChunkSize, setPasteChunkSize] = useState<number>(512);

  const wsUrl = useMemo(() => (host ? buildTerminalUrl(host.name, accessToken) : ""), [host, accessToken]);

  const highlightRules = useMemo<HighlightRuleRuntime[]>(() => {
    if (!terminalThemeConfig?.rules?.length) {
      return [];
    }
    return terminalThemeConfig.rules
      .map((rule) => {
        const colorCode = buildAnsiColor(rule.color);
        if (!colorCode) {
          return null;
        }
        return {
          name: rule.name,
          regex: new RegExp(rule.regex.source, rule.regex.flags),
          priority: rule.priority,
          open: colorCode,
        };
      })
      .filter((item): item is HighlightRuleRuntime => Boolean(item))
      .sort((a, b) => b.priority - a.priority);
  }, [terminalThemeConfig]);

  const applyHighlight = useCallback(
    (input: string): string => {
      if (!input || highlightRules.length === 0) {
        return input;
      }
      if (input.includes("\u001b[")) {
        return input;
      }
      let output = input;
      for (const rule of highlightRules) {
        const regex = new RegExp(rule.regex.source, rule.regex.flags);
        output = output.replace(regex, (...args) => {
          const match = args[0] as string;
          const offset = args.length >= 2 ? (args[args.length - 2] as number | undefined) : undefined;
          const source = args.length >= 1 ? (args[args.length - 1] as string | undefined) : undefined;
          if (!match || match.includes("\u001b[")) {
            return match;
          }
          if (typeof offset === "number" && typeof source === "string") {
            const lastColorOpen = source.lastIndexOf("\u001b[38;2;", offset);
            if (lastColorOpen !== -1) {
              const lastReset = source.lastIndexOf(ANSI_RESET_FG, offset);
              if (lastReset === -1 || lastReset < lastColorOpen) {
                return match;
              }
            }
          }
          return `${rule.open}${match}${ANSI_RESET_FG}`;
        });
      }
      return output;
    },
    [highlightRules],
  );

  const cleanup = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;

    if (dataListenerRef.current) {
      dataListenerRef.current.dispose();
      dataListenerRef.current = null;
    }

    if (resizeDisposableRef.current) {
      resizeDisposableRef.current.dispose();
      resizeDisposableRef.current = null;
    }

    if (resizeListenerRef.current) {
      window.removeEventListener("resize", resizeListenerRef.current);
      resizeListenerRef.current = null;
    }

    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    fitAddonRef.current = null;
    // 无需处理 ClipboardAddon 清理（未使用）

    if (initializationRetryRef.current !== null) {
      window.clearTimeout(initializationRetryRef.current);
      initializationRetryRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const handleReconnect = useCallback(() => {
    setSessionNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!open || !host) {
      cleanup();
      setStatus("idle");
      setLastError(null);
      return;
    }

    const term = new Terminal({
      allowTransparency: false,
      cursorBlink: true,
      scrollback: 2000,
      fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: terminalThemeConfig.base,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    // 不加载 ClipboardAddon，使用自定义复制/粘贴处理，避免重复触发

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    // 无 ClipboardAddon 引用
    if (typeof window !== "undefined") {
      (window as any).__activeTerm = term;
      (window as any).__activeHostTerminal = host?.name ?? null;
    }

    setStatus("connecting");
    setLastError(null);

    const openTerminal = () => {
      const container = containerRef.current;
      if (!container) {
        initializationRetryRef.current = window.setTimeout(openTerminal, 30);
        return;
      }

      initializationRetryRef.current = null;
      container.innerHTML = "";
      term.open(container);
      setTimeout(() => {
        try {
          fitAddon.fit();
          term.focus();
        } catch (error) {
          console.warn("Terminal fit failed", error);
        }
      }, 30);
    };

    openTerminal();

    const copySelectionToClipboard = async (selection: string) => {
      const text = selection;
      if (!text) {
        return;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        message.success("已复制终端选中内容");
      } catch (error) {
        console.error("Failed to copy selection", error);
        message.error("复制失败，请重试");
      }
    };

    const customKeyHandler = (event: KeyboardEvent) => {
      // 仅在 keydown 处理，避免 keypress/keyup 触发两次
      if (event.type !== 'keydown' || (event as any).repeat) {
        return true;
      }
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      const copyPressed = isMac ? event.metaKey && event.key.toLowerCase() === "c" : event.ctrlKey && event.key.toLowerCase() === "c";
      if (copyPressed && !event.shiftKey) {
        const selection = term.getSelection();
        if (selection && selection.length > 0) {
          void copySelectionToClipboard(selection);
          return false;
        }
        return true;
      }
      return true;
    };

    term.attachCustomKeyEventHandler(customKeyHandler);

    const handlePasteEvent = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain") ?? event.clipboardData?.getData("text");
      if (!text || !term) {
        return;
      }
      // 始终阻止默认，避免一次性暴量发送
      event.preventDefault();

      const ws = socketRef.current;
      const sendInput = (payload: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "input",
              payload,
            }),
          );
        }
      };

      // 未启用延迟：保持原行为，但通过手动发送避免 xterm 一次性挤压 onData
      if (!pasteDelayEnabled || pasteDelayMs <= 0) {
        sendInput(text);
        return;
      }

      // 启用“行间延迟”：逐行发送，长行分块，行与行之间等待 pasteDelayMs
      // 1) 提取每一行（保留换行）
      const lines: string[] = [];
      const regex = /([^\r\n]*)(\r?\n|$)/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        const content = m[1] ?? "";
        const newline = m[2] ?? "";
        // 2) 对行内容进行分块（不拆分换行符）
        if (content.length === 0) {
          lines.push(newline);
        } else {
          for (let i = 0; i < content.length; i += pasteChunkSize) {
            const chunk = content.slice(i, i + pasteChunkSize);
            // 中间的块不附带换行，最后一块在末尾追加换行
            const isLast = i + pasteChunkSize >= content.length;
            lines.push(isLast ? chunk + newline : chunk);
          }
        }
        if (newline === "") {
          break;
        }
      }

      // 3) 依次发送，每行之间延迟 pasteDelayMs 毫秒
      const sendSequentially = (index: number) => {
        if (index >= lines.length) return;
        sendInput(lines[index]!);
        if (index + 1 < lines.length) {
          window.setTimeout(() => sendSequentially(index + 1), pasteDelayMs);
        }
      };

      sendSequentially(0);
    };

    const textarea = term.textarea as HTMLTextAreaElement | undefined;
    textarea?.addEventListener("paste", handlePasteEvent);

    const handleWindowResize = () => {
      window.requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          if (term.element) {
            const { cols, rows } = term;
            const ws = socketRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "resize",
                  cols,
                  rows,
                }),
              );
            }
          }
        } catch (error) {
          // Swallow fit errors caused by layout thrash
        }
      });
    };

    window.addEventListener("resize", handleWindowResize);
    resizeListenerRef.current = handleWindowResize;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    if (typeof window !== "undefined") {
      (window as any).__activeTerminalSocket = ws;
    }

    ws.onopen = () => {
      setStatus("connecting");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "data" && typeof payload.payload === "string") {
          const content = applyHighlight(payload.payload);
          term.write(content);
        } else if (payload.type === "status") {
          if (typeof payload.status === "string" && payload.status in statusMeta) {
            const nextStatus = payload.status as ConnectionStatus;
            setStatus(nextStatus);
            if (nextStatus === "connected") {
              message.success(`已连接到 ${host.hostname}`);
              // 避免连接时额外回车：不向终端写入欢迎行
              term.focus();
              handleWindowResize();
            }
          }
        } else if (payload.type === "error" && typeof payload.message === "string") {
          setLastError(payload.message);
          setStatus("error");
          message.error(payload.message);
        }
      } catch (error) {
        term.write(`\r\n解析终端消息失败: ${String(error)}\r\n`);
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setLastError("终端会话发生错误");
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === "error" ? prev : "disconnected"));
    };

    dataListenerRef.current = term.onData((data) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "input",
            payload: data,
          }),
        );
      }
    });

    resizeDisposableRef.current = term.onResize(({ cols, rows }) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "resize",
            cols,
            rows,
          }),
        );
      }
    });

    return () => {
      textarea?.removeEventListener("paste", handlePasteEvent);
      cleanup();
    };
  }, [open, host, wsUrl, sessionNonce, cleanup, terminalThemeConfig, applyHighlight]);

  const meta = statusMeta[status];
  const showReconnect = status === "error" || status === "disconnected";

  const handleContainerInteraction = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.focus();
    }
  }, []);

  return (
    <Modal
      open={open}
      onCancel={() => {
        cleanup();
        onClose();
      }}
      onOk={() => {
        cleanup();
        onClose();
      }}
      width={960}
      footer={null}
      centered
      destroyOnClose
      title={
        <Space direction="vertical" size={0} style={{ width: "100%" }}>
          <Space
            align="center"
            style={{ width: "100%", justifyContent: "space-between", paddingRight: 48 }}
          >
            <Space>
              <ThunderboltOutlined />
              <Text strong>实时终端</Text>
              {host && (
                <Text type="secondary">{host.name} · {host.hostname}:{host.port ?? 22}</Text>
              )}
            </Space>
            <Space>
              <Tag icon={<LinkOutlined />} color={meta.color}>
                {meta.title}
              </Tag>
              <Tooltip title="对大段粘贴启用行间延迟，避免冲击设备缓冲区">
                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    粘贴延迟
                  </Text>
                  <Switch
                    size="small"
                    checked={pasteDelayEnabled}
                    onChange={setPasteDelayEnabled}
                  />
                  <InputNumber
                    size="small"
                    min={0}
                    max={2000}
                    step={10}
                    value={pasteDelayMs}
                    onChange={(v) => setPasteDelayMs(Number(v ?? 0))}
                    addonAfter="ms"
                    style={{ width: 110 }}
                    disabled={!pasteDelayEnabled}
                  />
                  <InputNumber
                    size="small"
                    min={32}
                    max={4096}
                    step={32}
                    value={pasteChunkSize}
                    onChange={(v) => setPasteChunkSize(Number(v ?? 512))}
                    addonAfter="chars"
                    style={{ width: 130 }}
                    disabled={!pasteDelayEnabled}
                  />
                </Space>
              </Tooltip>
              {showReconnect && (
                <Button icon={<ReloadOutlined />} onClick={handleReconnect}>
                  重新连接
                </Button>
              )}
            </Space>
          </Space>
          {lastError && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {lastError}
            </Text>
          )}
        </Space>
      }
    >
      <div
        ref={containerRef}
        onClick={handleContainerInteraction}
        onMouseDown={handleContainerInteraction}
        style={{
          height: 520,
          width: "100%",
          background: "#0f172a",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "inset 0 0 12px rgba(15,23,42,0.45)",
        }}
      />
    </Modal>
  );
};

export default HostTerminalModal;
