import type { CSSProperties, ReactNode } from "react";
import { Spin } from "antd";

import BatchActionsBar from "../common/BatchActionsBar";

interface LicenseManagementContentProps {
  pageContainerStyle: CSSProperties;
  filtersSectionStyle: CSSProperties;
  tableSectionStyle: CSSProperties;
  loading: boolean;
  filters: ReactNode;
  actions: ReactNode;
  alert: ReactNode;
  table: ReactNode;
}

const LicenseManagementContent = ({
  pageContainerStyle,
  filtersSectionStyle,
  tableSectionStyle,
  loading,
  filters,
  actions,
  alert,
  table,
}: LicenseManagementContentProps) => (
  <div style={pageContainerStyle}>
    <Spin spinning={loading} style={{ width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={filtersSectionStyle}>
          {filters}
          <BatchActionsBar>{actions}</BatchActionsBar>
          {alert}
        </div>
        <div style={tableSectionStyle}>{table}</div>
      </div>
    </Spin>
  </div>
);

export default LicenseManagementContent;

