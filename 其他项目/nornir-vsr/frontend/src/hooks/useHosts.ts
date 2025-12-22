import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Host,
  HostPayload,
  fetchHosts,
  createHost,
  updateHost,
  deleteHost,
  syncAddressPools as syncAddressPoolsApi,
  AddressPoolSyncResult
} from "../api/hosts";

export interface HostFilters {
  site?: string;
}

export interface UseHostsState {
  hosts: Host[];
  allHosts: Host[];
  loading: boolean;
  syncing: boolean;
  selected: string[];
  refresh: () => Promise<void>;
  addHost: (payload: HostPayload) => Promise<void>;
  editHost: (name: string, payload: Partial<HostPayload>) => Promise<void>;
  removeHost: (name: string) => Promise<void>;
  setSelected: (names: string[]) => void;
  findHost: (name: string) => Host | undefined;
  search: string;
  filters: HostFilters;
  applySearch: (value: string) => Promise<void>;
  applyFilters: (filters: HostFilters) => Promise<void>;
  syncAddressPools: () => Promise<AddressPoolSyncResult>;
}

export const useHosts = (enabled: boolean = true): UseHostsState => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [allHosts, setAllHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<HostFilters>({});

  const loadHosts = useCallback(async (searchValue: string, filtersValue: HostFilters) => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {
        search: searchValue,
        site: filtersValue.site
      };
      const data = await fetchHosts(params);
      setHosts(data);
      setSelected([]);

      const shouldFetchAll = Boolean(searchValue.trim()) || Boolean(filtersValue.site?.trim());
      if (shouldFetchAll) {
        try {
          const allData = await fetchHosts();
          setAllHosts(allData);
        } catch (error) {
          console.error("Failed to load full hosts list", error);
        }
      } else {
        setAllHosts(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadHosts(search, filters);
  }, [loadHosts, search, filters]);

  const addHost = useCallback(async (payload: HostPayload) => {
    setLoading(true);
    try {
      await createHost(payload);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const editHost = useCallback(async (name: string, payload: Partial<HostPayload>) => {
    setLoading(true);
    try {
      await updateHost(name, payload);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const removeHost = useCallback(async (name: string) => {
    setLoading(true);
    try {
      await deleteHost(name);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const syncAddressPools = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncAddressPoolsApi();
      await refresh();
      return result;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const findHost = useCallback((name: string) => hosts.find((host) => host.name === name), [hosts]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadHosts("", {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadHosts]);

  const applySearch = useCallback(async (value: string) => {
    setSearch(value);
    await loadHosts(value, filters);
  }, [filters, loadHosts]);

  const applyFilters = useCallback(async (nextFilters: HostFilters) => {
    setFilters(nextFilters);
    await loadHosts(search, nextFilters);
  }, [search, loadHosts]);

  return useMemo(
    () => ({
      hosts,
      allHosts,
      loading,
      syncing,
      selected,
      refresh,
      addHost,
      editHost,
      removeHost,
      setSelected,
      findHost,
      search,
      filters,
      applySearch,
      applyFilters,
      syncAddressPools
    }),
    [
      hosts,
      allHosts,
      loading,
      syncing,
      selected,
      refresh,
      addHost,
      editHost,
      removeHost,
      findHost,
      search,
      filters,
      applySearch,
      applyFilters,
      syncAddressPools
    ]
  );
};
