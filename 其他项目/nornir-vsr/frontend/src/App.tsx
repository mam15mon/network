import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import Card from "./components/common/AntCard";
import {
  Layout,
  Menu,
  Button,
  message,
  ConfigProvider,
  theme,
  Space,
  Typography,
  Segmented,
  Tooltip,
  Dropdown,
  Spin,
  Avatar,
} from "antd";
import type { SegmentedProps } from "antd";
import type { MenuProps } from "antd";
import {
  HddOutlined,
  ThunderboltOutlined,
  CloudSyncOutlined,
  SafetyCertificateOutlined,
  SlidersOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  MoonOutlined,
  DesktopOutlined,
  BgColorsOutlined,
  UserOutlined,
  KeyOutlined,
  LogoutOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import type { GlobalToken } from "antd/es/theme/interface";
import HostTable from "./components/HostTable";
import HostForm from "./components/HostForm";
import DefaultsDrawer from "./components/DefaultsDrawer";
import CommandCenter from "./components/CommandCenter";
import StatusTag from "./components/common/StatusTag";
import LoginForm from "./components/Auth/LoginForm";
import TotpSetupModal from "./components/Auth/TotpSetupModal";
import TotpSetupPage from "./components/Auth/TotpSetupPage";
import DisableTotpModal from "./components/Auth/DisableTotpModal";
import ChangePasswordModal from "./components/Auth/ChangePasswordModal";
import UserManagementCard from "./components/Settings/UserManagementCard";
import DatabaseSetupPage from "./components/Install/DatabaseSetupPage";
import { useHosts, HostFilters } from "./hooks/useHosts";
import type { SortState } from "./hooks/useTwoStateSort";
import { DefaultsConfig, fetchDefaults, updateDefaults } from "./api/defaults";
import {
  type Host,
  HostPayload,
  batchDeleteHosts,
  exportHosts,
  importHosts
} from "./api/hosts";
import { login, fetchCurrentUser, refreshToken, type AuthUser } from "./api/auth";
import { setAuthToken as setClientAuthToken, setUnauthorizedHandler } from "./api/client";
import { getInstallStatus } from "./api/install";
import { adjustHex, hexToRgba } from "./utils/colorUtils";
import { createHighlightRulesFromTerminalTheme } from "./utils/commandHighlight";
import { createAvatarStyle } from "./styles/commonStyles";
import type { ThemePalette } from "./styles/themeTypes";
import { createTerminalThemeConfig } from "./styles/terminalHighlight";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const SIDEBAR_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 80;

const THEME_STORAGE_KEY = "app.themeMode";
const THEME_VARIANT_STORAGE_KEY = "app.themeVariant";
const AUTH_TOKEN_STORAGE_KEY = "app.auth.token";
const AUTH_USER_STORAGE_KEY = "app.auth.user";
const AUTH_TOKEN_EXPIRY_STORAGE_KEY = "app.auth.expiresAt";

type ThemeVariantKey = "classic" | "catppuccin" | "nord" | "dracula" | "solarized";

interface ThemeVariantDefinition {
  key: ThemeVariantKey;
  label: string;
  colors: Record<"light" | "dark", ThemePalette>;
}

const themeVariants: ThemeVariantDefinition[] = [
  {
    key: "classic",
    label: "经典蓝",
    colors: {
      light: {
        primary: "#1677ff",
        bodyBg: "#f5f5f5",
        headerBg: "#ffffff",
        contentBg: "#f5f5f5",
        siderBg: "#f0f2f5",
        cardBg: "#ffffff",
        segmentBg: "rgba(22, 119, 255, 0.12)",
        danger: "#ff4d4f",
        success: "#52c41a",
        info: "#1677ff",
        warning: "#faad14",
      },
      dark: {
        primary: "#177ddc",
        bodyBg: "#141414",
        headerBg: "#001529",
        contentBg: "#141414",
        siderBg: "#001529",
        cardBg: "#1f1f1f",
        segmentBg: "rgba(23, 125, 220, 0.25)",
        danger: "#ff7875",
        success: "#73d13d",
        info: "#177ddc",
        warning: "#d89614",
      },
    },
  },
  {
    key: "catppuccin",
    label: "Catppuccin",
    colors: {
      light: {
        primary: "#ea76cb",
        bodyBg: "#eff1f5",
        headerBg: "#e6e9ef",
        contentBg: "#f4f6fb",
        siderBg: "#e6e9ef",
        cardBg: "#ffffff",
        segmentBg: "rgba(234, 118, 203, 0.16)",
        danger: "#d20f39",
        success: "#40a02b",
        info: "#1e66f5",
        warning: "#df8e1d",
      },
      dark: {
        primary: "#f38ba8",
        bodyBg: "#1e1e2e",
        headerBg: "#181825",
        contentBg: "#1e1e2e",
        siderBg: "#11111b",
        cardBg: "#181825",
        segmentBg: "rgba(243, 139, 168, 0.28)",
        danger: "#f38ba8",
        success: "#a6e3a1",
        info: "#8aadf4",
        warning: "#f9e2af",
      },
    },
  },
  {
    key: "nord",
    label: "Nord",
    colors: {
      light: {
        primary: "#5E81AC",
        bodyBg: "#ECEFF4",
        headerBg: "#E5E9F0",
        contentBg: "#ECEFF4",
        siderBg: "#E5E9F0",
        cardBg: "#ffffff",
        segmentBg: "rgba(94, 129, 172, 0.18)",
        danger: "#BF616A",
        success: "#8FBC8F",
        info: "#88C0D0",
        warning: "#EBCB8B",
      },
      dark: {
        primary: "#81A1C1",
        bodyBg: "#242933",
        headerBg: "#2E3440",
        contentBg: "#2B303B",
        siderBg: "#2E3440",
        cardBg: "#343B47",
        segmentBg: "rgba(129, 161, 193, 0.28)",
        danger: "#D57780",
        success: "#A3CF9F",
        info: "#8FBCBB",
        warning: "#F0D399",
      },
    },
  },
  {
    key: "dracula",
    label: "Dracula",
    colors: {
      light: {
        primary: "#BD93F9",
        bodyBg: "#F8F8F2",
        headerBg: "#FFFFFF",
        contentBg: "#F4F4ED",
        siderBg: "#EFEFE6",
        cardBg: "#ffffff",
        segmentBg: "rgba(189, 147, 249, 0.18)",
        danger: "#FF5555",
        success: "#50fa7b",
        info: "#8BE9FD",
        warning: "#F1FA8C",
      },
      dark: {
        primary: "#BD93F9",
        bodyBg: "#1E1F29",
        headerBg: "#282A36",
        contentBg: "#1E1F29",
        siderBg: "#1B1C26",
        cardBg: "#282A36",
        segmentBg: "rgba(189, 147, 249, 0.28)",
        danger: "#FF6E6E",
        success: "#69ff94",
        info: "#8BE9FD",
        warning: "#F1FA8C",
      },
    },
  },
  {
    key: "solarized",
    label: "Solarized",
    colors: {
      light: {
        primary: "#B58900",
        bodyBg: "#FDF6E3",
        headerBg: "#EEE8D5",
        contentBg: "#FDF6E3",
        siderBg: "#F3EACB",
        cardBg: "#ffffff",
        segmentBg: "rgba(181, 137, 0, 0.18)",
        danger: "#DC322F",
        success: "#859900",
        info: "#268BD2",
        warning: "#B58900",
      },
      dark: {
        primary: "#CB4B16",
        bodyBg: "#002B36",
        headerBg: "#073642",
        contentBg: "#002B36",
        siderBg: "#012029",
        cardBg: "#073642",
        segmentBg: "rgba(203, 75, 22, 0.28)",
        danger: "#CB4B16",
        success: "#9CCB19",
        info: "#2AA198",
        warning: "#CB9B16",
      },
    },
  },
];

const LicenseManagement = lazy(() => import("./components/LicenseManagement"));
const ConfigBackupCenter = lazy(() => import("./components/ConfigBackupCenter"));
const HostTerminalModal = lazy(() => import("./components/HostTerminalModal"));
const SNMPMonitorDashboard = lazy(() => import("./components/SNMP/SNMPMonitorDashboard"));

const App = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [installMode, setInstallMode] = useState<boolean | null>(null);
  const [installChecking, setInstallChecking] = useState(true);
  const refreshInFlightRef = useRef(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [disableTotpModalOpen, setDisableTotpModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const requiresTotpSetup = useMemo(
    () => Boolean(authUser?.totp_required && !authUser?.totp_enabled),
    [authUser?.totp_enabled, authUser?.totp_required],
  );

  const persistAuth = useCallback((tokenValue: string, userValue: AuthUser, expiresAt?: number | null) => {
    setClientAuthToken(tokenValue);
    setAuthTokenState(tokenValue);
    setAuthUser(userValue);
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, tokenValue);
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userValue));

    if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
      setTokenExpiry(expiresAt);
      window.localStorage.setItem(AUTH_TOKEN_EXPIRY_STORAGE_KEY, String(expiresAt));
    } else if (expiresAt === null) {
      setTokenExpiry(null);
      window.localStorage.removeItem(AUTH_TOKEN_EXPIRY_STORAGE_KEY);
    }
  }, []);

  const updateStoredUser = useCallback((updater: (user: AuthUser) => AuthUser) => {
    setAuthUser((prev) => {
      if (!prev) {
        return prev;
      }
      const next = updater(prev);
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAuth = useCallback(() => {
    setClientAuthToken(null);
    setAuthTokenState(null);
    setAuthUser(null);
    setTokenExpiry(null);
    setTotpModalOpen(false);
    setChangePasswordModalOpen(false);
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_EXPIRY_STORAGE_KEY);
  }, []);

  const loadInstallStatus = useCallback(async () => {
    setInstallChecking(true);
    try {
      const status = await getInstallStatus();
      setInstallMode(status.install_mode);
      if (status.install_mode) {
        setAuthInitializing(false);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "无法获取安装状态";
      message.error(detail);
      setInstallMode(true);
      setAuthInitializing(false);
    } finally {
      setInstallChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadInstallStatus();
  }, [loadInstallStatus]);

  const handleLogout = useCallback((showMessage: boolean = true) => {
    clearAuth();
    setAuthInitializing(false);
    if (showMessage) {
      message.success("已退出登录");
    }
  }, [clearAuth]);

  const handleInstallCompleted = useCallback(async () => {
    setAuthInitializing(true);
    await loadInstallStatus();
  }, [loadInstallStatus]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    try {
      const response = await refreshToken();
      const expiresAt = Date.now() + response.expires_in * 1000;
      persistAuth(response.access_token, response.user, expiresAt);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail ?? error?.message ?? "刷新登录状态失败";
      handleLogout(false);
      if (status === 401) {
        message.error("登录状态已过期，请重新登录");
      } else {
        message.error(detail);
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [persistAuth, handleLogout]);

  useEffect(() => {
    if (installMode !== false) {
      return;
    }
    setUnauthorizedHandler(() => {
      handleLogout(false);
      message.error("登录状态已过期，请重新登录");
      setAuthInitializing(false);
    });
    return () => setUnauthorizedHandler(null);
  }, [handleLogout, installMode]);

  useEffect(() => {
    if (!authUser || !authToken || requiresTotpSetup) {
      return;
    }
    if (installMode !== false) {
      return;
    }
    if (typeof tokenExpiry !== "number" || !Number.isFinite(tokenExpiry)) {
      return;
    }
    const leadMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const delay = tokenExpiry - leadMs - now;
    if (delay <= 0) {
      void refreshAccessToken();
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshAccessToken();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [authUser, authToken, requiresTotpSetup, tokenExpiry, installMode, refreshAccessToken]);

  useEffect(() => {
    if (installMode !== false) {
      return;
    }
    const tokenValue = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const expiryRaw = window.localStorage.getItem(AUTH_TOKEN_EXPIRY_STORAGE_KEY);
    const storedExpiry = expiryRaw ? Number(expiryRaw) : null;
    const expiryValid = typeof storedExpiry === "number" && Number.isFinite(storedExpiry);

    if (!tokenValue || !expiryValid) {
      clearAuth();
      setAuthInitializing(false);
      return;
    }

    if ((storedExpiry as number) <= Date.now()) {
      clearAuth();
      setAuthInitializing(false);
      return;
    }

    const restore = async (storedToken: string, expiresAt: number) => {
      setClientAuthToken(storedToken);
      setAuthTokenState(storedToken);
      setTokenExpiry(expiresAt);
      const storedUserRaw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (storedUserRaw) {
        try {
          const parsed: AuthUser = JSON.parse(storedUserRaw);
          setAuthUser(parsed);
        } catch (error) {
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }
      try {
        const freshUser = await fetchCurrentUser();
        persistAuth(storedToken, freshUser, expiresAt);
      } catch {
        clearAuth();
      } finally {
        setAuthInitializing(false);
      }
    };

    void restore(tokenValue, storedExpiry as number);
  }, [persistAuth, clearAuth, installMode]);

  const handleLoginSubmit = useCallback(
    async (payload: { username: string; password: string; otp?: string }) => {
      setLoggingIn(true);
      try {
        const response = await login(payload);
        const expiresAt = Date.now() + response.expires_in * 1000;
        persistAuth(response.access_token, response.user, expiresAt);
        message.success("登录成功");
        if (response.require_totp) {
          setTotpModalOpen(true);
        }
      } catch (error) {
        clearAuth();
        const status = (error as any)?.response?.status;
        if (status === 428) {
          const detail = (error as any)?.response?.data?.detail ?? "账户已启用二次认证，请输入验证码完成登录。";
          const totpError = new Error(detail);
          (totpError as any).code = "TOTP_REQUIRED";
          throw totpError;
        }
        throw error;
      } finally {
        setLoggingIn(false);
        setAuthInitializing(false);
      }
    },
    [persistAuth, clearAuth],
  );

  const handleTotpCompleted = useCallback(async (): Promise<boolean> => {
    try {
      const refreshedUser = await fetchCurrentUser();
      if (!refreshedUser.totp_enabled) {
        message.error("服务器未确认二次认证，请重新输入验证码");
        return false;
      }
      const tokenValue = authToken ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (tokenValue) {
        const fallbackExpiryRaw = window.localStorage.getItem(AUTH_TOKEN_EXPIRY_STORAGE_KEY);
        const fallbackExpiry = fallbackExpiryRaw ? Number(fallbackExpiryRaw) : undefined;
        const nextExpiry = typeof tokenExpiry === "number" && Number.isFinite(tokenExpiry)
          ? tokenExpiry
          : (typeof fallbackExpiry === "number" && Number.isFinite(fallbackExpiry) ? fallbackExpiry : undefined);
        persistAuth(tokenValue, refreshedUser, nextExpiry);
      } else {
        setAuthUser(refreshedUser);
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(refreshedUser));
      }
      setTotpModalOpen(false);
      return true;
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "刷新用户信息失败";
      message.error(detail);
      return false;
    }
  }, [authToken, persistAuth, tokenExpiry]);

  const handleTotpDisabled = useCallback(() => {
    updateStoredUser((user) => ({ ...user, totp_enabled: false }));
  }, [updateStoredUser]);

  const handleStartTotpSetup = useCallback(() => {
    setTotpModalOpen(true);
  }, []);

  const userInitials = useMemo(() => {
    if (!authUser?.username) {
      return "?";
    }
    const trimmed = authUser.username.trim();
    return trimmed ? trimmed[0].toUpperCase() : "?";
  }, [authUser?.username]);

  const handleUserMenuClick = useCallback<NonNullable<MenuProps["onClick"]>>(
    (event) => {
      if (event.key === "enable-totp") {
        handleStartTotpSetup();
        return;
      }
      if (event.key === "disable-totp") {
        setDisableTotpModalOpen(true);
        return;
      }
      if (event.key === "change-password") {
        setChangePasswordModalOpen(true);
        return;
      }
      if (event.key === "logout") {
        handleLogout();
      }
    },
    [handleLogout, handleStartTotpSetup],
  );

  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") {
      return "system";
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "system";
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [themeVariant, setThemeVariant] = useState<ThemeVariantKey>(() => {
    if (typeof window === "undefined") {
      return "catppuccin";
    }
    const storedRaw = window.localStorage.getItem(THEME_VARIANT_STORAGE_KEY);
    const legacyMap: Record<string, ThemeVariantKey> = {
      ocean: "nord",
      forest: "solarized",
      sunset: "dracula",
    };
    const normalized = storedRaw ? (legacyMap[storedRaw] ?? storedRaw) : null;
    if (normalized && themeVariants.some((variant) => variant.key === normalized)) {
      return normalized as ThemeVariantKey;
    }
    return "classic";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState("inventory");
  const [, setMobileCollapsed] = useState(false);
  const {
    hosts,
    allHosts,
    loading,
    syncing,
    selected,
    setSelected,
    addHost,
    editHost,
    removeHost,
    findHost,
    refresh,
    search,
    filters,
    applySearch,
    applyFilters,
    syncAddressPools
  } = useHosts(Boolean(authUser && !requiresTotpSetup));
  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [editingHostName, setEditingHostName] = useState<string | null>(null);
  const [defaultsVisible, setDefaultsVisible] = useState(false);
  const [defaults, setDefaults] = useState<DefaultsConfig | null>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [commandSummary, setCommandSummary] = useState({ executing: false, total: 0, success: 0, failure: 0 });
  const [terminalHost, setTerminalHost] = useState<Host | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [hostSortState, setHostSortState] = useState<SortState>({ columnKey: "name", order: "ascend" });
  const licenseModuleEnabled = useMemo(
    () => defaults?.license_module_enabled ?? true,
    [defaults?.license_module_enabled],
  );

  const editingHost = useMemo(
    () => (editingHostName ? findHost(editingHostName) : undefined),
    [editingHostName, findHost]
  );

  interface MenuMetaItem {
    key: string;
    icon: ReactNode;
    label: string;
    description: string;
  }

  const menuMeta = useMemo<Record<string, MenuMetaItem>>(
    () => ({
      inventory: {
        key: "inventory",
        icon: <HddOutlined />,
        label: "设备数据库",
        description: "集中管理所有设备清单，支持搜索、筛选与批量操作",
      },
      operations: {
        key: "operations",
        icon: <ThunderboltOutlined />,
        label: "命令执行",
        description: "按需选择设备批量下发命令，实时查看执行输出与历史记录",
      },
      backups: {
        key: "backups",
        icon: <CloudSyncOutlined />,
        label: "配置备份",
        description: "管理设备配置快照，快速预览、下载与清理历史备份",
      },
      snmp: {
        key: "snmp",
        icon: <DashboardOutlined />,
        label: "SNMP 监控",
        description: "实时监控设备状态，支持自定义指标、OID 测试与历史数据分析",
      },
      license: {
        key: "license",
        icon: <SafetyCertificateOutlined />,
        label: "许可证管理",
        description: "筛选并同步设备许可证与 DID/AK 文件，掌握授权状态",
      },
      settings: {
        key: "settings",
        icon: <SlidersOutlined />,
        label: "系统设置",
        description: "维护平台默认配置与全局参数",
      },
    }),
    []
  );

  const menuItems = useMemo(
    () => Object.values(menuMeta)
      .filter((item) => item.key !== "license" || licenseModuleEnabled)
      .map(({ key, icon, label }) => ({ key, icon, label })),
    [menuMeta, licenseModuleEnabled]
  );

  const currentMenu = useMemo<MenuMetaItem | undefined>(
    () => menuMeta[activeKey],
    [menuMeta, activeKey]
  );

  useEffect(() => {
    if (!licenseModuleEnabled && activeKey === "license") {
      setActiveKey("inventory");
    }
  }, [licenseModuleEnabled, activeKey]);

  const filterOptions = useMemo(() => {
    const sites = Array.from(
      new Set(
        allHosts
          .map((host) => host.site)
          .filter((item): item is string => Boolean(item))
      )
    );

    return { sites };
  }, [allHosts]);

  useEffect(() => {
    if (!authUser || requiresTotpSetup) {
      setDefaults(null);
      return;
    }
    const loadDefaults = async () => {
      setDefaultsLoading(true);
      try {
        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const data = await fetchDefaults();
            setDefaults(data);
            lastError = null;
            break;
          } catch (err: any) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        if (lastError) {
          const status = lastError?.response?.status;
          if (status === 401) {
            return;
          }
          const detail = lastError?.response?.data?.detail || lastError?.message || "";
          // eslint-disable-next-line no-console
          console.error("加载默认配置失败", lastError);
          message.error(`加载默认配置失败${detail ? `: ${detail}` : ""}`);
        }
      } finally {
        setDefaultsLoading(false);
      }
    };
    void loadDefaults();
  }, [authUser, requiresTotpSetup]);

  const handleHostSubmit = useCallback(
    async (values: HostPayload) => {
      try {
        if (editingHostName) {
          await editHost(editingHostName, values);
          message.success("设备已更新");
        } else {
          await addHost(values);
          message.success("设备已创建");
        }
        setHostModalVisible(false);
        setEditingHostName(null);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail ?? "操作失败";
        message.error(errorMessage);
        throw error;
      }
    },
    [editingHostName, addHost, editHost]
  );

  const handleHostDelete = useCallback(
    async (name: string) => {
      try {
        await removeHost(name);
        message.success("设备已删除");
        setSelected(selected.filter((item) => item !== name));
        if (terminalHost?.name === name) {
          setTerminalOpen(false);
          setTerminalHost(null);
        }
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail ?? "删除失败";
        message.error(errorMessage);
      }
    },
    [removeHost, terminalHost, selected, setSelected]
  );

  const handleSyncAddressPools = useCallback(async () => {
    try {
      const result = await syncAddressPools();
      if (
        result.processed === 0 &&
        result.updated === 0 &&
        result.no_data.length === 0 &&
        result.no_ppp.length === 0
      ) {
        message.warning("未检测到配置备份，请先执行配置备份后再同步地址池");
        return;
      }
      message.success(`同步完成，更新 ${result.updated} 台设备（地址池 ${result.updated_address_pool}，PPP ${result.updated_ppp}）`);
      if (result.no_data.length > 0) {
        message.info(`以下设备配置未含 ip pool 1：${result.no_data.slice(0, 5).join(', ')}${result.no_data.length > 5 ? ' 等' : ''}`);
      }
      if (result.no_ppp.length > 0) {
        message.info(`以下设备配置未检测到 PPP 认证模式：${result.no_ppp.slice(0, 5).join(', ')}${result.no_ppp.length > 5 ? ' 等' : ''}`);
      }
      if (result.missing_hosts.length > 0) {
        message.warning(`数据库中缺少对应设备记录：${result.missing_hosts.slice(0, 5).join(', ')}${result.missing_hosts.length > 5 ? ' 等' : ''}`);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail ?? "同步地址池失败";
      message.error(errorMessage);
    }
  }, [syncAddressPools]);

  const handleDefaultsSubmit = useCallback(
    async (payload: DefaultsConfig) => {
      setDefaultsLoading(true);
      try {
        const data = await updateDefaults(payload);
        setDefaults(data);
        message.success("默认配置已更新");
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail ?? "更新失败";
        message.error(errorMessage);
        throw error;
      } finally {
        setDefaultsLoading(false);
      }
    },
    []
  );

  const handleBatchDelete = useCallback(async () => {
    if (selected.length === 0) {
      return;
    }
    try {
      const { deleted } = await batchDeleteHosts(selected);
      message.success(`已删除 ${deleted} 台设备`);
      setSelected([]);
      await refresh();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail ?? "批量删除失败";
      message.error(errorMessage);
    }
  }, [selected, refresh, setSelected]);

  const handleImportHosts = useCallback(
    async (file: File) => {
      try {
        const result = await importHosts(file);
        message.success(`导入完成，新增 ${result.inserted} 台，更新 ${result.updated} 台`);
        await refresh();
      } catch (error: any) {
        const errorMessage = error?.response?.data?.detail ?? "导入失败";
        message.error(errorMessage);
      }
    },
    [refresh]
  );

  const handleExportHosts = useCallback(async () => {
    try {
      const blob = await exportHosts();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "hosts.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail ?? "导出失败";
      message.error(errorMessage);
    }
  }, []);

  const handleSearch = useCallback(
    async (value: string) => {
      await applySearch(value);
    },
    [applySearch]
  );

  const handleFiltersChange = useCallback(
    async (nextFilters: HostFilters) => {
      await applyFilters(nextFilters);
    },
    [applyFilters]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const themeMode = useMemo(
    () => (themePreference === "system" ? systemTheme : themePreference),
    [themePreference, systemTheme]
  );

  const activeVariant = useMemo(
    () => themeVariants.find((variant) => variant.key === themeVariant) ?? themeVariants[0],
    [themeVariant]
  );

  const palette = useMemo<ThemePalette>(
    () => activeVariant.colors[themeMode],
    [activeVariant, themeMode]
  );

  const primaryTextColor = themeMode === "dark" ? "rgba(255, 255, 255, 0.85)" : "rgba(0, 0, 0, 0.85)";
  const secondaryTextColor = themeMode === "dark" ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.45)";
  const subtleDividerColor = hexToRgba(palette.primary, themeMode === "dark" ? 0.38 : 0.14) ?? palette.segmentBg;
  const borderColor = hexToRgba(palette.primary, themeMode === "dark" ? 0.32 : 0.12) ?? subtleDividerColor;
  const radiusBase = 12;
  const radiusSM = 10;
  const radiusXS = 6;
  const radiusLG = 18;
  const controlHeight = 44;
  const controlHeightSM = 36;
  const controlHeightLG = 48;
  const fontFamily = `"Inter", "SF Pro SC", "PingFang SC", "HarmonyOS Sans", "Microsoft YaHei", sans-serif`;
  const surfaceShadow = themeMode === "dark"
    ? "0 28px 80px -40px rgba(6, 12, 30, 0.85)"
    : "0 34px 80px -38px rgba(15, 76, 129, 0.26)";
  const cardShadow = themeMode === "dark"
    ? "0 18px 60px -28px rgba(0, 0, 0, 0.65)"
    : "0 24px 60px -32px rgba(15, 76, 129, 0.18)";
  const tableHeaderBg = useMemo(
    () => hexToRgba(palette.primary, themeMode === "dark" ? 0.24 : 0.12) ?? palette.siderBg,
    [palette.primary, palette.siderBg, themeMode]
  );
  const tableHoverBg = useMemo(
    () => hexToRgba(palette.primary, themeMode === "dark" ? 0.16 : 0.08) ?? palette.segmentBg,
    [palette.primary, palette.segmentBg, themeMode]
  );

  const neutralFill = themeMode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)";

  const token = useMemo(() => {
    const withAlpha = (color: string, lightAlpha: number, darkAlpha: number) =>
      hexToRgba(color, themeMode === "dark" ? darkAlpha : lightAlpha) ?? color;
    const adjust = (color: string, lightDelta: number, darkDelta: number) =>
      adjustHex(color, themeMode === "dark" ? darkDelta : lightDelta) ?? color;

    const partial: Partial<GlobalToken> = {
      colorPrimary: palette.primary,
      colorPrimaryBg: withAlpha(palette.primary, 0.16, 0.32),
      colorPrimaryBgHover: withAlpha(palette.primary, 0.24, 0.38),
      colorPrimaryHover: adjust(palette.primary, -8, 6),
      colorPrimaryActive: adjust(palette.primary, -16, 12),
      colorInfo: palette.info,
      colorInfoBg: withAlpha(palette.info, 0.16, 0.28),
      colorInfoText: adjust(palette.info, -22, 10),
      colorSuccess: palette.success,
      colorSuccessBg: withAlpha(palette.success, 0.16, 0.28),
      colorSuccessText: adjust(palette.success, -24, 8),
      colorWarning: palette.warning,
      colorWarningBg: withAlpha(palette.warning, 0.2, 0.32),
      colorWarningText: adjust(palette.warning, -26, 8),
      colorError: palette.danger,
      colorErrorBg: withAlpha(palette.danger, 0.18, 0.34),
      colorErrorText: adjust(palette.danger, -25, 8),
      colorBgLayout: palette.bodyBg,
      colorBgContainer: palette.cardBg,
      colorBgElevated: palette.cardBg,
      colorFillSecondary: neutralFill,
      colorFillAlter: withAlpha(palette.primary, 0.12, 0.24),
      colorFillTertiary: withAlpha(palette.info, 0.16, 0.26),
      colorFillQuaternary: withAlpha(palette.primary, 0.08, 0.18),
      colorBorder: subtleDividerColor,
      colorBorderSecondary: subtleDividerColor,
      colorSplit: subtleDividerColor,
      colorText: primaryTextColor,
      colorTextSecondary: secondaryTextColor,
      colorWhite: "#ffffff",
      borderRadius: 12,
      borderRadiusLG: 18,
      borderRadiusSM: 10,
      fontSize: 14,
    };

    return partial as GlobalToken;
  }, [palette, themeMode, neutralFill, subtleDividerColor, primaryTextColor, secondaryTextColor]);

  const userMenuItems = useMemo<MenuProps["items"]>(() => {
    if (!authUser) {
      return [];
    }
    const items: MenuProps["items"] = [
      {
        key: "profile",
        type: "group",
        label: (
          <div style={{ minWidth: 180 }}>
            <Text strong>{authUser.username}</Text>
            <div style={{ fontSize: 12, color: secondaryTextColor, marginTop: 4 }}>
              身份：{authUser.is_superuser ? "超级管理员" : "标准用户"}
            </div>
            <div style={{ fontSize: 12, color: secondaryTextColor }}>
              二次认证：{authUser.totp_enabled ? "已启用" : "未启用"}
            </div>
          </div>
        ),
      },
      { type: "divider" },
    ];

    if (!authUser.totp_enabled) {
      items.push({
        key: "enable-totp",
        icon: <SafetyCertificateOutlined />,
        label: "启用二次认证",
      });
    } else if (!authUser.totp_required) {
      items.push({
        key: "disable-totp",
        icon: <SafetyCertificateOutlined />,
        label: "关闭二次认证",
        danger: true,
      });
    }

    items.push({
      key: "change-password",
      icon: <KeyOutlined />,
      label: "修改密码",
    });

    items.push({
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
    });

    return items;
  }, [authUser, secondaryTextColor]);

  const { style: userAvatarStyle, hoverStyle: userAvatarHoverStyle } = useMemo(
    () =>
      createAvatarStyle(token, {
        themeMode,
      }),
    [themeMode, token],
  );
  const tagNeutralBg = useMemo(
    () => hexToRgba(palette.primary, themeMode === "dark" ? 0.28 : 0.14) ?? palette.segmentBg,
    [palette.primary, palette.segmentBg, themeMode]
  );
  const terminalThemeConfig = useMemo(
    () => createTerminalThemeConfig(palette, themeMode, primaryTextColor),
    [palette, themeMode, primaryTextColor]
  );
  const terminalTextHighlightRules = useMemo(
    () => createHighlightRulesFromTerminalTheme(terminalThemeConfig, token, themeMode),
    [terminalThemeConfig, token, themeMode],
  );
  const infoBase = palette.info ?? palette.primary;
  const infoMain = infoBase;
  const infoHover = adjustHex(infoBase, themeMode === "dark" ? 16 : -16) ?? infoBase;
  const infoBorder = adjustHex(infoBase, themeMode === "dark" ? 4 : -20) ?? infoBase;
  const infoBg = hexToRgba(infoMain, themeMode === "dark" ? 0.26 : 0.14) ?? palette.segmentBg;
  const infoBorderSoft = hexToRgba(infoMain, themeMode === "dark" ? 0.45 : 0.24) ?? infoBorder;
  const infoTextColor = themeMode === "dark" ? "rgba(232, 244, 252, 0.94)" : "rgba(12, 36, 54, 0.9)";
  const warningBase = palette.warning ?? palette.primary;
  const warningMain = warningBase;
  const warningHover = adjustHex(warningBase, themeMode === "dark" ? 14 : -14) ?? warningBase;
  const warningBorder = adjustHex(warningBase, themeMode === "dark" ? 6 : -18) ?? warningBase;
  const warningBg = hexToRgba(warningMain, themeMode === "dark" ? 0.3 : 0.18) ?? palette.segmentBg;
  const warningBorderSoft = hexToRgba(warningMain, themeMode === "dark" ? 0.45 : 0.26) ?? warningBorder;
  const warningTextColor = themeMode === "dark" ? "rgba(255, 249, 229, 0.92)" : "rgba(56, 33, 5, 0.9)";
  const errorBase = palette.danger;
  const errorMain = errorBase;
  const errorHover = adjustHex(errorBase, themeMode === "dark" ? 18 : -18) ?? errorBase;
  const errorBorder = adjustHex(errorBase, themeMode === "dark" ? 6 : -20) ?? errorBase;
  const errorBg = hexToRgba(errorMain, themeMode === "dark" ? 0.28 : 0.16) ?? palette.segmentBg;
  const errorBorderSoft = hexToRgba(errorMain, themeMode === "dark" ? 0.45 : 0.24) ?? errorBorder;
  const errorTextColor = themeMode === "dark" ? "rgba(255, 255, 255, 0.92)" : "rgba(26, 33, 56, 0.92)";
  const successBase = palette.success ?? palette.primary;
  const successMain = successBase;
  const successHover = adjustHex(successBase, themeMode === "dark" ? 18 : -18) ?? successBase;
  const successBorder = adjustHex(successBase, themeMode === "dark" ? 6 : -20) ?? successBase;
  const successBg = hexToRgba(successMain, themeMode === "dark" ? 0.28 : 0.16) ?? palette.segmentBg;
  const successBorderSoft = hexToRgba(successMain, themeMode === "dark" ? 0.45 : 0.24) ?? successBorder;
  const successTextColor = themeMode === "dark" ? "rgba(245, 255, 244, 0.95)" : "rgba(15, 36, 15, 0.92)";

  const themePreferenceOptions = useMemo<SegmentedProps<'light' | 'dark' | 'system'>['options']>(
    () => [
      {
        value: "light",
        label: (
          <Tooltip title="浅色" placement="bottom">
            <BulbOutlined />
          </Tooltip>
        ),
      },
      {
        value: "system",
        label: (
          <Tooltip title="系统" placement="bottom">
            <DesktopOutlined />
          </Tooltip>
        ),
      },
      {
        value: "dark",
        label: (
          <Tooltip title="深色" placement="bottom">
            <MoonOutlined />
          </Tooltip>
        ),
      },
    ],
    []
  );

  const themeVariantMenuItems = useMemo<MenuProps["items"]>(
    () =>
      themeVariants.map((variant) => ({
        key: variant.key,
        label: (
          <Space size={8}>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: variant.colors[themeMode].primary,
                boxShadow: `0 0 0 1px ${
                  themeMode === "dark"
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(0, 0, 0, 0.15)"
                }`,
              }}
            />
            <span>{variant.label}</span>
          </Space>
        ),
      })),
    [themeMode]
  );
  const handleThemeVariantMenuClick = useCallback(
    ({ key }: { key: string }) => {
      setThemeVariant(key as ThemeVariantKey);
    },
    [setThemeVariant]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(THEME_VARIANT_STORAGE_KEY, themeVariant);
  }, [themeVariant]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.setAttribute("data-theme", themeMode);
    document.documentElement.style.setProperty("--app-bg", palette.bodyBg);
    const body = document.body;
    if (body) {
      body.style.background = palette.bodyBg;
    }
  }, [palette.bodyBg, themeMode]);

  const currentTheme = useMemo(() => ({
    algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: palette.primary,
      colorText: primaryTextColor,
      colorTextSecondary: secondaryTextColor,
      colorTextLabel: secondaryTextColor,
      colorTextPlaceholder: themeMode === "dark" ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)",
      colorBgLayout: palette.bodyBg,
      colorBgContainer: palette.cardBg,
      colorBgElevated: palette.cardBg,
      colorFillSecondary: neutralFill,
      colorBorder: borderColor,
      colorBorderSecondary: subtleDividerColor,
      colorSplit: subtleDividerColor,
      colorInfo: infoMain,
      colorInfoBg: infoBg,
      colorInfoBorder: infoBorderSoft,
      colorInfoHover: infoHover,
      colorInfoActive: infoHover,
      colorInfoText: infoTextColor,
      colorError: errorMain,
      colorErrorBg: errorBg,
      colorErrorBorder: errorBorderSoft,
      colorErrorHover: errorHover,
      colorErrorActive: errorHover,
      colorErrorText: errorTextColor,
      colorSuccess: successMain,
      colorSuccessBg: successBg,
      colorSuccessBorder: successBorderSoft,
      colorSuccessHover: successHover,
      colorSuccessActive: successHover,
      colorSuccessText: successTextColor,
      colorWarning: warningMain,
      colorWarningBg: warningBg,
      colorWarningBorder: warningBorderSoft,
      colorWarningHover: warningHover,
      colorWarningActive: warningHover,
      colorWarningText: warningTextColor,
      boxShadow: surfaceShadow,
      boxShadowSecondary: cardShadow,
      borderRadius: radiusBase,
      borderRadiusLG: radiusLG,
      borderRadiusSM: radiusSM,
      borderRadiusXS: radiusXS,
      fontSize: 14,
      fontSizeSM: 13,
      fontFamily,
      controlHeight,
      controlHeightLG,
      controlHeightSM,
    },
    components: {
      Button: {
        colorText: primaryTextColor,
        colorIcon: primaryTextColor,
        controlHeight,
        controlHeightLG,
        controlHeightSM,
        paddingInline: 18,
        paddingInlineLG: 20,
        paddingInlineSM: 14,
        borderRadius: radiusBase,
        primaryShadow: 'none',
        dangerShadow: 'none',
        dangerColor: errorTextColor,
        dangerBg: errorBg,
        dangerBorderColor: errorBorder,
        dangerOutlineColor: errorBorder,
        dangerHoverColor: errorTextColor,
        dangerHoverBg: hexToRgba(errorMain, themeMode === "dark" ? 0.42 : 0.24) ?? errorBg,
        dangerActiveBg: hexToRgba(errorMain, themeMode === "dark" ? 0.36 : 0.2) ?? errorBg,
        dangerColorDisabled: hexToRgba(errorMain, 0.45) ?? errorMain,
      },
      Segmented: {
        borderRadius: radiusBase,
        itemSelectedColor: primaryTextColor,
        itemSelectedBg: palette.segmentBg,
        colorText: secondaryTextColor,
      },
      Card: {
        borderRadiusLG: radiusLG,
        boxShadow: cardShadow,
        headerFontSize: 16,
        headerHeight: 48,
        padding: 20,
        paddingLG: 24,
      },
      Table: {
        borderRadiusLG: radiusLG,
        rowHoverBg: tableHoverBg,
        rowSelectedBg: tableHoverBg,
        headerBg: tableHeaderBg,
        headerColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(30, 41, 59, 0.85)',
        cellPaddingBlock: 14,
        cellPaddingInline: 16,
      },
      Input: {
        borderRadius: radiusBase,
        controlHeight,
        controlHeightLG,
        controlHeightSM,
        paddingBlock: 10,
      },
      Select: {
        borderRadius: radiusBase,
        controlHeight,
        controlHeightLG,
        controlHeightSM,
        optionSelectedBg: tableHoverBg,
        optionSelectedColor: primaryTextColor,
      },
      Tag: {
        borderRadiusSM: radiusSM,
        colorBg: tagNeutralBg,
        colorBorder: 'transparent',
        colorText: primaryTextColor,
        fontSizeSM: 12,
      },
      Menu: {
        itemBorderRadius: radiusSM,
        itemHoverBg: tableHoverBg,
        itemHoverColor: primaryTextColor,
        itemSelectedBg: tableHoverBg,
        itemSelectedColor: primaryTextColor,
      },
      Layout: {
        headerPadding: '0 24px',
        headerBg: 'transparent',
        siderBg: hexToRgba(palette.primary, themeMode === 'dark' ? 0.22 : 0.12) ?? palette.siderBg,
        bodyBg: palette.bodyBg,
      },
    }
  }), [
    borderColor,
    cardShadow,
    controlHeight,
    controlHeightLG,
    controlHeightSM,
    fontFamily,
    palette,
    primaryTextColor,
    radiusBase,
    radiusLG,
    radiusSM,
    radiusXS,
    secondaryTextColor,
    subtleDividerColor,
    tableHeaderBg,
    tableHoverBg,
    tagNeutralBg,
    themeMode
  ]);

  const siderWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const headerAccent = useMemo(() => {
    const accent = hexToRgba(palette.primary, themeMode === "dark" ? 0.32 : 0.18);
    return accent ?? palette.segmentBg;
  }, [palette.primary, palette.segmentBg, themeMode]);
  const headerBackground = useMemo(() => palette.headerBg, [palette.headerBg]);
  const sidebarBackground = useMemo(() => {
    const accent = hexToRgba(palette.primary, themeMode === "dark" ? 0.26 : 0.12);
    if (!accent) {
      return palette.siderBg;
    }
    return `linear-gradient(180deg, ${accent} 0%, ${palette.siderBg} 48%, ${palette.siderBg} 100%)`;
  }, [palette.primary, palette.siderBg, themeMode]);
  const headerShadowColor = hexToRgba(palette.primary, themeMode === "dark" ? 0.35 : 0.18) ?? subtleDividerColor;
  const headerShadow = `0 1px 0 ${headerShadowColor}`;
  const headerControlBg = hexToRgba(palette.primary, themeMode === "dark" ? 0.22 : 0.12) ?? neutralFill;
  const sidebarShadowColor = hexToRgba(palette.primary, themeMode === "dark" ? 0.45 : 0.2) ?? headerShadowColor;
  const sidebarShadow = themeMode === "dark"
    ? `12px 0 32px -28px ${sidebarShadowColor}`
    : `16px 0 38px -30px ${sidebarShadowColor}`;
  const headerBorderColor = subtleDividerColor;

  if (installMode === null || installChecking) {
    return (
      <ConfigProvider theme={currentTheme}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" tip="正在检测安装状态" />
        </div>
      </ConfigProvider>
    );
  }

  if (installMode) {
    return (
      <ConfigProvider theme={currentTheme}>
        <DatabaseSetupPage onConfigured={handleInstallCompleted} />
      </ConfigProvider>
    );
  }

  if (authInitializing) {
    return (
      <ConfigProvider theme={currentTheme}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" tip="正在加载" />
        </div>
      </ConfigProvider>
    );
  }

  if (!authUser) {
    return (
      <ConfigProvider theme={currentTheme}>
        <LoginForm loading={loggingIn} onSubmit={handleLoginSubmit} />
      </ConfigProvider>
    );
  }

  if (requiresTotpSetup && authUser) {
    return (
      <ConfigProvider theme={currentTheme}>
        <TotpSetupPage
          user={authUser}
          onCompleted={handleTotpCompleted}
          onLogout={() => handleLogout()}
        />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={currentTheme}>
      <Layout style={{ minHeight: '100vh', background: palette.bodyBg, transition: 'background 0.3s ease' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          width={SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: sidebarBackground,
            borderRight: `1px solid ${subtleDividerColor}`,
            boxShadow: sidebarShadow,
          }}
          onBreakpoint={(broken: boolean) => {
            if (!broken) {
              setMobileCollapsed(false);
            }
          }}
        >
          <div
            style={{
              height: 56,
              margin: 20,
              borderRadius: radiusLG,
              background: headerAccent,
              border: `1px solid ${subtleDividerColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 18px',
              color: primaryTextColor,
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
              overflow: 'hidden',
            }}
          >
            {collapsed ? (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                N
              </span>
            ) : (
              <Space direction="vertical" size={2} style={{ lineHeight: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>Nornir 控制台</span>
              </Space>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 24px' }}>
            <Menu
              theme={themeMode === 'dark' ? 'dark' : 'light'}
              mode="inline"
              selectedKeys={[activeKey]}
              items={menuItems}
              onClick={(info: Parameters<NonNullable<MenuProps["onClick"]>>[0]) => setActiveKey(String(info.key))}
              style={{ background: 'transparent', border: 'none', padding: '8px 0' }}
            />
          </div>
        </Sider>

        <Layout
          style={{
            marginLeft: siderWidth,
            height: '100vh',
            transition: 'margin-left 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Header style={{
            padding: '0 24px',
            minHeight: 64,
            background: headerBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: headerShadow,
            borderBottom: `1px solid ${headerBorderColor}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: 40,
                  height: 40,
                  borderRadius: radiusBase,
                  color: primaryTextColor,
                  background: headerControlBg,
                  border: `1px solid ${headerBorderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <Text
                  type="secondary"
                  style={{
                    margin: 0,
                    color: secondaryTextColor,
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Nornir 控制台 · {activeVariant.label}
                </Text>
                <Title level={4} style={{ margin: 0, color: currentTheme.token?.colorText, lineHeight: 1.2 }}>
                  {currentMenu?.label ?? "模块"}
                </Title>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {activeKey === 'operations' && (commandSummary.executing || commandSummary.total > 0) && (
                <StatusTag
                  variant={
                    commandSummary.executing
                      ? "warning"
                      : commandSummary.failure > 0
                        ? "error"
                        : "success"
                  }
                  style={{ paddingInline: 12 }}
                >
                  {commandSummary.executing
                    ? `执行中 ${commandSummary.total} 条`
                    : `成功 ${commandSummary.success} 失败 ${commandSummary.failure}`}
                </StatusTag>
              )}
              <Space size={8} align="center">
                <div
                  style={{
                    padding: '4px 6px',
                    borderRadius: radiusBase,
                    background: headerControlBg,
                    border: `1px solid ${headerBorderColor}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <Segmented
                    value={themePreference}
                    options={themePreferenceOptions}
                    onChange={(value: 'light' | 'dark' | 'system') => setThemePreference(value)}
                    size="small"
                    style={{ background: 'transparent' }}
                  />
                </div>
                <Tooltip title={`主题配色：${activeVariant.label}`} placement="bottom">
                  <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    arrow
                    menu={{ items: themeVariantMenuItems, onClick: handleThemeVariantMenuClick }}
                  >
                    <Button
                      type="text"
                      icon={<BgColorsOutlined />}
                      style={{
                        width: 36,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: primaryTextColor,
                      }}
                    />
                  </Dropdown>
                </Tooltip>
                {authUser ? (
                  <Dropdown
                    menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                    trigger={["click"]}
                    placement="bottomRight"
                    arrow
                  >
                    <span
                      style={{ display: "inline-flex", alignItems: "center" }}
                      onMouseEnter={(event) => {
                        const target = event.currentTarget.querySelector<HTMLSpanElement>(".app-avatar");
                        if (target) {
                          Object.entries(userAvatarHoverStyle).forEach(([key, value]) => {
                            (target.style as any)[key] = value;
                          });
                        }
                      }}
                      onMouseLeave={(event) => {
                        const target = event.currentTarget.querySelector<HTMLSpanElement>(".app-avatar");
                        if (target) {
                          Object.entries(userAvatarStyle).forEach(([key, value]) => {
                            (target.style as any)[key] = value;
                          });
                        }
                      }}
                    >
                      <Avatar
                        size={40}
                        style={{ ...userAvatarStyle, cursor: "pointer", fontWeight: 600 }}
                        className="app-avatar"
                        icon={!authUser.username ? <UserOutlined /> : undefined}
                      >
                        {authUser.username ? userInitials : null}
                      </Avatar>
                    </span>
                  </Dropdown>
                ) : (
                  <Button type="primary" onClick={() => setAuthInitializing(false)}>
                    登录
                  </Button>
                )}
              </Space>
            </div>
          </Header>

          <Content
            style={{
              margin: '16px 24px 24px',
              padding: 0,
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {activeKey === 'inventory' && (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <HostTable
                    hosts={hosts}
                    loading={loading}
                    syncing={syncing}
                    selected={selected}
                    onSelectionChange={setSelected}
                    onAdd={() => {
                      setEditingHostName(null);
                      setHostModalVisible(true);
                    }}
                    onEdit={(host) => {
                      setEditingHostName(host.name);
                      setHostModalVisible(true);
                    }}
                    onDelete={(host) => handleHostDelete(host.name)}
                    onBatchDelete={handleBatchDelete}
                    onImport={handleImportHosts}
                    onExport={handleExportHosts}
                    onSyncAddressPools={handleSyncAddressPools}
                    onOpenTerminal={(host) => {
                      setTerminalHost(host);
                      setTerminalOpen(true);
                    }}
                    filters={filters}
                    filterOptions={filterOptions}
                    search={search}
                    onSearch={handleSearch}
                    onFiltersChange={handleFiltersChange}
                    sortState={hostSortState}
                    onSortStateChange={setHostSortState}
                  />
                </Card>
              </Space>
            )}

            {activeKey === 'operations' && (
              <CommandCenter
                hosts={allHosts}
                loading={loading}
                filterOptions={filterOptions}
                onSummaryChange={setCommandSummary}
                highlightRules={terminalTextHighlightRules}
                sortState={hostSortState}
                onSortStateChange={setHostSortState}
              />
            )}

            {activeKey === 'backups' && (
              <Suspense
                fallback={(
                  <Card>
                    <Spin tip="正在加载备份中心..." />
                  </Card>
                )}
              >
                <ConfigBackupCenter
                  filterOptions={filterOptions}
                  highlightRules={terminalTextHighlightRules}
                />
              </Suspense>
            )}

            {activeKey === 'snmp' && (
              <Suspense
                fallback={(
                  <Card>
                    <Spin tip="正在加载 SNMP 监控..." />
                  </Card>
                )}
              >
                <SNMPMonitorDashboard canManageBuiltin={Boolean(authUser?.is_superuser)} />
              </Suspense>
            )}

            {activeKey === 'license' && licenseModuleEnabled && (
              <Suspense
                fallback={(
                  <Card>
                    <Spin tip="正在加载许可证管理..." />
                  </Card>
                )}
              >
                <LicenseManagement hosts={allHosts} loading={loading} />
              </Suspense>
            )}

            {activeKey === 'settings' && authUser && (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card
                  title="默认配置"
                  extra={
                    <Button type="primary" icon={<SettingOutlined />} onClick={() => setDefaultsVisible(true)}>
                      打开
                    </Button>
                  }
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>维护平台默认参数、凭证和常用命令模板。</Text>
                    <Text type="secondary">点击“打开”管理全局默认配置。</Text>
                  </Space>
                </Card>
                {authUser.is_superuser ? (
                  <UserManagementCard currentUser={authUser} />
                ) : null}
              </Space>
            )}

            {!['inventory', 'operations', 'backups', 'snmp', 'license', 'settings'].includes(activeKey) && (
              <Card>
                <Text type="secondary">
                  {currentMenu?.label ?? "功能"} 正在开发中。
                </Text>
              </Card>
            )}
          </Content>
        </Layout>
      </Layout>

      <HostForm
        visible={hostModalVisible}
        loading={loading}
        host={editingHost}
        onCancel={() => {
          setHostModalVisible(false);
          setEditingHostName(null);
        }}
        onSubmit={handleHostSubmit}
      />

      <DefaultsDrawer
        visible={defaultsVisible}
        loading={defaultsLoading}
        defaults={defaults}
        onSubmit={handleDefaultsSubmit}
        onClose={() => setDefaultsVisible(false)}
      />

      <Suspense fallback={null}>
        <HostTerminalModal
          host={terminalHost}
          open={terminalOpen && Boolean(terminalHost)}
          onClose={() => {
            setTerminalOpen(false);
            setTerminalHost(null);
          }}
          terminalThemeConfig={terminalThemeConfig}
          accessToken={authToken ?? undefined}
        />
      </Suspense>

      <TotpSetupModal
        open={Boolean(authUser) && totpModalOpen}
        onClose={() => setTotpModalOpen(false)}
        onCompleted={handleTotpCompleted}
      />
      <DisableTotpModal
        open={disableTotpModalOpen}
        onClose={() => setDisableTotpModalOpen(false)}
        onDisabled={() => {
          handleTotpDisabled();
          setDisableTotpModalOpen(false);
        }}
      />

      <ChangePasswordModal
        open={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
      />

    </ConfigProvider>
  );
};

export default App;
