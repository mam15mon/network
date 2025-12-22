import type { CommandType } from "../../api/nornir";

export const DEFAULT_COMMANDS: Record<CommandType, string> = {
  display: "display version",
  config: "sftp server enable",
  multiline: "sys\ndis interface brief",
  connectivity: "22",
  config_download: "",
};

export const STORAGE_KEYS = {
  activeTab: "commandCenter.activeTab",
  resultFilter: "commandCenter.resultFilter",
  historyFilter: "commandCenter.historyFilter",
};

