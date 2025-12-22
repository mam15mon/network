import { useEffect, useMemo, useRef, useState } from "react";

export type SortOrder = "ascend" | "descend";

export interface SortState {
  columnKey: string;
  order: SortOrder;
}

interface UseTwoStateSortOptions<T> {
  data: T[];
  comparators: Record<string, (a: T, b: T) => number>;
  defaultColumnKey?: string;
  defaultOrder?: SortOrder;
  initialState?: SortState | null;
  onStateChange?: (state: SortState) => void;
}

export function useTwoStateSort<T>(options: UseTwoStateSortOptions<T>) {
  const {
    data,
    comparators,
    defaultColumnKey,
    defaultOrder = "ascend",
    initialState,
    onStateChange,
  } = options;
  const comparatorKeys = useMemo(() => Object.keys(comparators), [comparators]);

  const resolveDefaultColumnKey = () => {
    if (defaultColumnKey && comparatorKeys.includes(defaultColumnKey)) {
      return defaultColumnKey;
    }
    return comparatorKeys[0] ?? "";
  };

  const resolveInitialState = (): SortState => {
    const fallbackColumn = resolveDefaultColumnKey();
    const baseState: SortState = {
      columnKey: fallbackColumn,
      order: defaultOrder,
    };
    if (initialState) {
      const candidateColumn = initialState.columnKey;
      const candidateOrder = initialState.order;
      const validColumn = candidateColumn && comparatorKeys.includes(candidateColumn)
        ? candidateColumn
        : fallbackColumn;
      const validOrder = candidateOrder === "ascend" || candidateOrder === "descend"
        ? candidateOrder
        : defaultOrder;
      return { columnKey: validColumn, order: validOrder };
    }
    return baseState;
  };

  const [state, setState] = useState<SortState>(() => resolveInitialState());

  useEffect(() => {
    setState((prev) => {
      const nextColumnKey = resolveDefaultColumnKey();
      if (!nextColumnKey) {
        return { columnKey: "", order: defaultOrder };
      }
      if (initialState) {
        const desiredColumn = comparatorKeys.includes(initialState.columnKey)
          ? initialState.columnKey
          : nextColumnKey;
        const desiredOrder =
          initialState.order === "ascend" || initialState.order === "descend"
            ? initialState.order
            : defaultOrder;
        if (prev.columnKey !== desiredColumn || prev.order !== desiredOrder) {
          return { columnKey: desiredColumn, order: desiredOrder };
        }
        return prev;
      }
      if (prev.columnKey && comparatorKeys.includes(prev.columnKey)) {
        return prev;
      }
      if (prev.columnKey !== nextColumnKey || prev.order !== defaultOrder) {
        return { columnKey: nextColumnKey, order: defaultOrder };
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparatorKeys.join("|"), defaultOrder, initialState?.columnKey, initialState?.order]);

  const sortedData = useMemo(() => {
    if (!state.columnKey) {
      return data.slice();
    }
    const comparator = comparators[state.columnKey];
    if (!comparator) {
      return data.slice();
    }
    const cloned = data.slice().sort(comparator);
    if (state.order === "descend") {
      cloned.reverse();
    }
    return cloned;
  }, [data, comparators, state]);

  const handleChange = (columnKey?: string, nextOrder?: SortOrder | undefined) => {
    setState((prev) => {
      const fallbackColumn = prev.columnKey || resolveDefaultColumnKey();
      const targetColumn = columnKey ?? fallbackColumn;
      if (!targetColumn || !comparators[targetColumn]) {
        return prev;
      }

      const sameColumn = prev.columnKey === targetColumn;
      let order: SortOrder;

      if (!nextOrder) {
        // AntD emits undefined when user clicks the third time; enforce toggle instead of clearing
        order = sameColumn ? (prev.order === "ascend" ? "descend" : "ascend") : defaultOrder;
      } else if (!sameColumn) {
        order = nextOrder;
      } else if (nextOrder === prev.order) {
        order = prev.order === "ascend" ? "descend" : "ascend";
      } else {
        order = nextOrder;
      }

      return { columnKey: targetColumn, order };
    });
  };

  const getSortOrderForColumn = (key: string): SortOrder | undefined => {
    return state.columnKey === key ? state.order : undefined;
  };

  const stateChangeRef = useRef(onStateChange);
  useEffect(() => {
    stateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    stateChangeRef.current?.(state);
  }, [state]);

  return {
    sortedData,
    sortState: state,
    setSortState: setState,
    handleChange,
    getSortOrderForColumn,
  };
}
