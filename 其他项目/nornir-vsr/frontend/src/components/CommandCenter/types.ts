import type { Key } from "react";
import type { CommandResult } from "../../api/nornir";

export interface HistoryRecord extends CommandResult {
  key: Key;
}

export interface ResultSummary {
  total: number;
  success: number;
  failure: number;
}

