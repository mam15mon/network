import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import { Select, Segmented, Tooltip, Typography } from "antd";

import FilterToolbar from "../common/FilterToolbar";
import StatusTag, { StatusVariant } from "../common/StatusTag";
import type { Host } from "../../api/hosts";
import type { LicenseTypeFilter } from "./types";
import "./LicenseFilters.css";


interface LicenseFiltersProps {
  sites: string[];
  hosts: Host[];
  selectedSite: string;
  onSiteChange: (value: string) => void;
  selectedHosts: string[];
  onSelectedHostsChange: (value: string[]) => void;
  onHostSelectionDirtyChange: (dirty: boolean) => void;
  licenseTypeFilter: LicenseTypeFilter;
  onLicenseTypeFilterChange: (value: LicenseTypeFilter) => void;
  selectionMode: string;
  selectionDescription: string;
  selectionModeVariant: StatusVariant;
  selectedCount: number;
  totalFilteredHosts: number;
  isMobile: boolean;
}

const LicenseFilters = memo(({
  sites,
  hosts,
  selectedSite,
  onSiteChange,
  selectedHosts,
  onSelectedHostsChange,
  onHostSelectionDirtyChange,
  licenseTypeFilter,
  onLicenseTypeFilterChange,
  selectionMode,
  selectionDescription,
  selectionModeVariant,
  selectedCount,
  totalFilteredHosts,
  isMobile,
}: LicenseFiltersProps) => {
  const labelStyle = useMemo<CSSProperties>(
    () => ({
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      flex: "0 0 auto",
    }),
    [],
  );

  const siteSelectStyle = useMemo<CSSProperties>(
    () => (isMobile ? { minWidth: 180, flex: "1 1 auto" } : { width: 220 }),
    [isMobile],
  );

  const segmentedStyle = useMemo<CSSProperties>(
    () =>
      isMobile
        ? { flex: "0 0 auto" }
        : { minWidth: 220, flex: "0 0 auto" },
    [isMobile],
  );

  const hostSelectStyle = useMemo<CSSProperties>(
    () =>
      isMobile
        ? { minWidth: 220, flex: "1 1 220px", maxWidth: "100%" }
        : { minWidth: 480, flex: "1 1 600px", maxWidth: "100%" },
    [isMobile],
  );

  return (
    <FilterToolbar
      style={{ marginBottom: 16 }}
      gap={isMobile ? 8 : 12}
      left={
        <>
          <Typography.Text type="secondary" style={labelStyle}>
            筛选条件
          </Typography.Text>
          <Tooltip
            title="选择站点"
            trigger={[]}
            open={false}
            overlayClassName="hidden"
          />
          <Select
            placeholder="选择站点"
            value={selectedSite || undefined}
            onChange={onSiteChange}
            style={siteSelectStyle}
            allowClear
            options={sites.map((site) => ({ label: site, value: site }))}
            optionFilterProp="label"
            showSearch
          />
          <Segmented
            value={licenseTypeFilter}
            onChange={(value: LicenseTypeFilter) => onLicenseTypeFilterChange(value)}
            options={[
              { label: "全部授权", value: "all" },
              { label: "永久授权", value: "permanent" },
              { label: "非永久", value: "non-permanent" },
              { label: "手动选择", value: "manual" },
            ]}
            style={segmentedStyle}
            motionName=""
            className="license-type-segmented"
          />
          <Select
            mode="multiple"
            placeholder="选择主机"
            value={selectedHosts}
            onChange={(value: string[]) => {
              if (licenseTypeFilter !== "manual") {
                onHostSelectionDirtyChange(false);
                return;
              }
              onSelectedHostsChange(value);
              onHostSelectionDirtyChange(value.length > 0);
            }}
            style={hostSelectStyle}
            allowClear
            maxTagCount={3}
            showSearch
            disabled={licenseTypeFilter !== "manual"}
            options={hosts.map((host) => ({
              label: `${host.name} (${host.hostname ?? "未知主机名"})`,
              value: host.name,
            }))}
            optionFilterProp="label"
          />
        </>
      }
      right={
        <>
          <Tooltip title={selectionDescription}>
            <StatusTag variant={selectionModeVariant}>{selectionMode}</StatusTag>
          </Tooltip>
          <StatusTag variant="info">筛选 {totalFilteredHosts} 台</StatusTag>
          <StatusTag variant={selectedCount > 0 ? "success" : "neutral"}>
            当前操作 {selectedCount} 台
          </StatusTag>
        </>
      }
    />
  );
});

export default LicenseFilters;
