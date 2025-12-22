export const hexToRgba = (hex: string, alpha: number = 1): string | null => {
  if (typeof hex !== "string") {
    return null;
  }
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  const numeric = parseInt(normalized, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  const safeAlpha = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

export const adjustHex = (hex: string, amount: number): string | null => {
  if (typeof hex !== "string") {
    return null;
  }
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  const numeric = parseInt(normalized, 16);
  let r = (numeric >> 16) & 255;
  let g = (numeric >> 8) & 255;
  let b = numeric & 255;
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (typeof hex !== "string") {
    return null;
  }
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  const numeric = parseInt(normalized, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};
