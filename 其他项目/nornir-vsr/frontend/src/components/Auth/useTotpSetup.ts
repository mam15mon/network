import { useCallback, useEffect, useRef, useState } from "react";
import type { TotpSetupResponse } from "../../api/auth";
import { setupTotp, verifyTotp } from "../../api/auth";

interface UseTotpSetupOptions {
  active: boolean;
  onLoadError?: (detail: string) => void;
}

interface UseTotpSetupResult {
  secret: string | null;
  uri: string | null;
  loading: boolean;
  verifying: boolean;
  reload: () => Promise<void>;
  verify: (code: string) => Promise<void>;
  reset: () => void;
}

export const useTotpSetup = ({ active, onLoadError }: UseTotpSetupOptions): UseTotpSetupResult => {
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  const reset = useCallback(() => {
    setSecret(null);
    setUri(null);
  }, []);

  const loadSecret = useCallback(async () => {
    if (!active) {
      return;
    }
    setLoading(true);
    try {
      const data: TotpSetupResponse = await setupTotp();
      setSecret(data.secret);
      setUri(data.provisioning_uri);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.message ?? "初始化二次认证失败";
      onLoadErrorRef.current?.(detail);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      reset();
      return;
    }
    void loadSecret();
  }, [active, loadSecret, reset]);

  const verify = useCallback(async (code: string) => {
    setVerifying(true);
    try {
      await verifyTotp({ code });
    } finally {
      setVerifying(false);
    }
  }, []);

  return {
    secret,
    uri,
    loading,
    verifying,
    reload: loadSecret,
    verify,
    reset,
  };
};

export default useTotpSetup;
