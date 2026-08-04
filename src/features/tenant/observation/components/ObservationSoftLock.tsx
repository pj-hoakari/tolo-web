"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import { cn } from "@/lib/utils";

type StoredCredential = {
  version?: "sha-256" | "fallback";
  salt: string;
  hash: string;
};

export type ObservationSoftLockProps = {
  tenantId: string;
  eventId: string;
  children: ReactNode;
};

const MIN_UNLOCK_CODE_LENGTH = 4;

function credentialStorageKey(tenantId: string, eventId: string): string {
  return `tolo:observation-lock:${tenantId}:${eventId}`;
}

function readStoredCredential(key: string): StoredCredential | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredCredential>;
    if (typeof parsed.salt === "string" && typeof parsed.hash === "string") {
      return { salt: parsed.salt, hash: parsed.hash };
    }
  } catch {
    window.localStorage.removeItem(key);
  }

  return null;
}

function createSalt(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hashUnlockCode(code: string, salt: string): Promise<string> {
  if (!window.crypto.subtle) {
    return fallbackHashUnlockCode(code, salt);
  }

  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fallbackHashUnlockCode(code: string, salt: string): string {
  let hash = 0x811c9dc5;
  for (const char of `${salt}:${code}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fallback:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function verifyUnlockCode(
  code: string,
  storedCredential: StoredCredential,
): Promise<boolean> {
  const expectedFallback =
    storedCredential.version === "fallback" ||
    storedCredential.hash.startsWith("fallback:");
  const hash = expectedFallback
    ? fallbackHashUnlockCode(code, storedCredential.salt)
    : await hashUnlockCode(code, storedCredential.salt);

  return hash === storedCredential.hash;
}

export function ObservationSoftLock({
  tenantId,
  eventId,
  children,
}: ObservationSoftLockProps) {
  const storageKey = useMemo(
    () => credentialStorageKey(tenantId, eventId),
    [tenantId, eventId],
  );
  const [loaded, setLoaded] = useState(false);
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [locked, setLocked] = useState(true);
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockCodeConfirmation, setUnlockCodeConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("Observation.lock");

  useEffect(() => {
    setCredential(readStoredCredential(storageKey));
    setLocked(true);
    setLoaded(true);
  }, [storageKey]);

  const needsSetup = loaded && credential === null;
  const blocksOperation = !loaded || locked;

  const handleLock = () => {
    setUnlockCode("");
    setUnlockCodeConfirmation("");
    setError(null);
    setLocked(true);
  };

  const unlock = async () => {
    if (busy) {
      return;
    }

    const normalizedCode = unlockCode.trim();
    setError(null);

    if (normalizedCode.length < MIN_UNLOCK_CODE_LENGTH) {
      setError(t("tooShort", { min: MIN_UNLOCK_CODE_LENGTH }));
      return;
    }

    setBusy(true);
    try {
      if (needsSetup) {
        if (normalizedCode !== unlockCodeConfirmation.trim()) {
          setError(t("mismatch"));
          return;
        }

        const salt = createSalt();
        const nextCredential = {
          version: window.crypto.subtle ? "sha-256" : "fallback",
          salt,
          hash: await hashUnlockCode(normalizedCode, salt),
        } satisfies StoredCredential;
        window.localStorage.setItem(storageKey, JSON.stringify(nextCredential));
        setCredential(nextCredential);
        setLocked(false);
        setUnlockCode("");
        setUnlockCodeConfirmation("");
        return;
      }

      if (!credential) {
        setError(t("notConfigured"));
        return;
      }

      const matched = await verifyUnlockCode(normalizedCode, credential);
      if (!matched) {
        setError(t("incorrect"));
        return;
      }

      setLocked(false);
      setUnlockCode("");
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void unlock();
  };

  return (
    <div className="relative flex w-full flex-col items-center gap-4">
      {!blocksOperation && (
        <div className="flex w-full max-w-3xl justify-end px-4 sm:px-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={handleLock}
          >
            <LockKeyhole className="mr-2 size-4" />
            {t("lockButton")}
          </Button>
        </div>
      )}

      <div
        inert={blocksOperation ? true : undefined}
        className={cn(
          "flex w-full flex-col items-center gap-4",
          blocksOperation && "select-none opacity-30",
        )}
      >
        {children}
      </div>

      {blocksOperation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 px-4 backdrop-blur-sm">
          <form
            className="w-full max-w-sm rounded-md border border-border bg-background p-5 shadow-lg"
            onSubmit={handleSubmit}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold text-lg">
                  {needsSetup ? t("setupTitle") : t("lockedTitle")}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {needsSetup ? t("setupDescription") : t("lockedDescription")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <TextField
                className="flex flex-col gap-2"
                value={unlockCode}
                onChange={setUnlockCode}
                isInvalid={error !== null}
              >
                <Label>{t("codeLabel")}</Label>
                <Input
                  type="password"
                  autoComplete={
                    needsSetup ? "new-password" : "current-password"
                  }
                  autoFocus
                />
              </TextField>

              {needsSetup && (
                <TextField
                  className="flex flex-col gap-2"
                  value={unlockCodeConfirmation}
                  onChange={setUnlockCodeConfirmation}
                  isInvalid={error !== null}
                >
                  <Label>{t("codeConfirmationLabel")}</Label>
                  <Input type="password" autoComplete="new-password" />
                </TextField>
              )}

              {error && <FieldError>{error}</FieldError>}

              <Button
                type="button"
                onPress={() => void unlock()}
                isDisabled={busy || !loaded}
              >
                {needsSetup ? t("submitSetup") : t("submitUnlock")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
