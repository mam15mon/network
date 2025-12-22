import natsort from "natsort";

const sorter = natsort({ insensitive: true });

export const naturalCompare = (
  left?: string | number | null,
  right?: string | number | null
): number => {
  const a = left ?? "";
  const b = right ?? "";
  return sorter(String(a), String(b));
};
