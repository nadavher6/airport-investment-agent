import { useEffect, useState } from "react";
import { api } from "../api/client";

export type ConnectionStatus = "checking" | "online" | "offline";

const POLL_MS = 5_000;

export function useHealth(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    let controller = new AbortController();
    const check = () => {
      controller.abort();
      controller = new AbortController();
      api
        .health(controller.signal)
        .then(() => setStatus("online"))
        .catch(() => {
          if (!controller.signal.aborted) setStatus("offline");
        });
    };
    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  return status;
}
