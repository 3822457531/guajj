"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GuestIdentityModal } from "@/components/guest-identity-modal";
import { readGuestIdentityBackup } from "@/lib/guest-identity-storage";

function isAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    /^\/cp-[A-Za-z0-9]+/.test(pathname)
  );
}

function readRefFromUrl() {
  if (typeof window === "undefined") return null;
  const ref = new URLSearchParams(window.location.search).get("ref")?.trim();
  return ref && /^GUA-\d{6}$/.test(ref) ? ref : null;
}

export function GuestIdentityGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [needsModal, setNeedsModal] = useState(false);
  const [capturedRef, setCapturedRef] = useState<string | null>(null);

  const verifySession = useCallback(async () => {
    const res = await fetch("/api/guest/me", { cache: "no-store" });
    const data = await res.json();
    return Boolean(data?.user?.publicId);
  }, []);

  const tryRestore = useCallback(async () => {
    const backup = readGuestIdentityBackup();
    if (!backup) return false;
    const res = await fetch("/api/guest/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(backup)
    });
    return res.ok;
  }, []);

  useEffect(() => {
    if (isAdminPath(pathname)) {
      setChecking(false);
      setNeedsModal(false);
      return;
    }

    let cancelled = false;

    async function init() {
      const ref = readRefFromUrl();
      if (ref) {
        setCapturedRef(ref);
        void fetch("/api/guest/capture-ref", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref })
        });
      }

      if (await verifySession()) {
        if (!cancelled) {
          setNeedsModal(false);
          setChecking(false);
        }
        return;
      }

      if (await tryRestore()) {
        if (!cancelled) {
          setNeedsModal(false);
          setChecking(false);
        }
        return;
      }

      if (!cancelled) {
        setNeedsModal(true);
        setChecking(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [pathname, tryRestore, verifySession]);

  if (isAdminPath(pathname)) {
    return <>{children}</>;
  }

  const handleLeave = useCallback(() => {
    setNeedsModal(false);
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  }, []);

  return (
    <>
      {children}
      {!checking && needsModal ? (
        <GuestIdentityModal initialRef={capturedRef} onComplete={() => setNeedsModal(false)} onLeave={handleLeave} />
      ) : null}
    </>
  );
}
