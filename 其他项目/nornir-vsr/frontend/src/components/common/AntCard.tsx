import * as React from "react";
import { Card as AntdCard } from "antd";

// Lightweight wrapper to provide a JSX-compatible component type
// while delegating all props to Ant Design's Card.
// This avoids TS JSX typing issues encountered in some environments.

const Card: React.FC<Record<string, any>> = (props) => React.createElement(AntdCard as any, props);

export default Card;
