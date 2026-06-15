"use client";

export type WebRtcRole = "sender" | "receiver";

export type WebRtcStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "negotiating"
  | "connected"
  | "disconnected"
  | "error";

export type SignalMessage =
  | { type: "offer"; data: RTCSessionDescriptionInit }
  | { type: "answer"; data: RTCSessionDescriptionInit }
  | { type: "candidate"; data: RTCIceCandidateInit };

export type SignalHandler = (message: SignalMessage) => void | Promise<void>;

export interface SignalingChannel {
  send(message: SignalMessage): Promise<void>;
  onMessage(handler: SignalHandler): void;
  close(): void;
}

type FirestoreField =
  | { stringValue: string }
  | { timestampValue: string }
  | { booleanValue: boolean };

type FirestoreDocument = {
  name: string;
  createTime?: string;
  fields?: Record<string, FirestoreField>;
};

const POLL_INTERVAL_MS = 700;

function firestoreBaseUrl(): string {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "tolo-signaling";
  const emulatorHost =
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "localhost:8080";
  return `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents`;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function docUrl(path: string): string {
  return `${firestoreBaseUrl()}/${encodePath(path)}`;
}

function collectionUrl(path: string): string {
  return `${firestoreBaseUrl()}/${encodePath(path)}`;
}

function stringField(value: string): FirestoreField {
  return { stringValue: value };
}

function timestampField(value = new Date()): FirestoreField {
  return { timestampValue: value.toISOString() };
}

async function patchDocument(
  path: string,
  fields: Record<string, FirestoreField>,
): Promise<void> {
  const response = await fetch(docUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Firestore write failed: ${response.status}`);
  }
}

async function postDocument(
  collectionPath: string,
  documentId: string,
  fields: Record<string, FirestoreField>,
): Promise<void> {
  const params = new URLSearchParams({ documentId });
  const response = await fetch(`${collectionUrl(collectionPath)}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Firestore message write failed: ${response.status}`);
  }
}

function readStringField(
  fields: Record<string, FirestoreField> | undefined,
  key: string,
): string | null {
  const field = fields?.[key];
  if (!field || !("stringValue" in field)) {
    return null;
  }
  return field.stringValue;
}

function parseSignalDocument(
  role: WebRtcRole,
  document: FirestoreDocument,
): SignalMessage | null {
  const from = readStringField(document.fields, "from");
  if (!from || from === role) {
    return null;
  }

  const type = readStringField(document.fields, "type");
  const payload = readStringField(document.fields, "payload");
  if (
    (type !== "offer" && type !== "answer" && type !== "candidate") ||
    !payload
  ) {
    return null;
  }

  return { type, data: JSON.parse(payload) } as SignalMessage;
}

export async function createFirestoreSignalingChannel(
  roomId: string,
  role: WebRtcRole,
): Promise<SignalingChannel> {
  const roomPath = `webrtcRooms/${roomId}`;
  const messagesPath = `${roomPath}/messages`;
  const seenDocumentNames = new Set<string>();
  let handler: SignalHandler | null = null;
  let closed = false;
  let polling = false;

  await patchDocument(roomPath, {
    roomId: stringField(roomId),
    updatedAt: timestampField(),
  });
  await patchDocument(`${roomPath}/peers/${role}`, {
    role: stringField(role),
    online: { booleanValue: true },
    joinedAt: timestampField(),
  });

  const poll = async () => {
    if (closed || polling) {
      return;
    }
    polling = true;
    try {
      const response = await fetch(collectionUrl(messagesPath));
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as {
        documents?: FirestoreDocument[];
      };
      const documents = [...(body.documents ?? [])].sort((a, b) =>
        (a.createTime ?? "").localeCompare(b.createTime ?? ""),
      );

      for (const document of documents) {
        if (seenDocumentNames.has(document.name)) {
          continue;
        }
        seenDocumentNames.add(document.name);

        const message = parseSignalDocument(role, document);
        if (message && handler) {
          await handler(message);
        }
      }
    } finally {
      polling = false;
    }
  };

  const intervalId = window.setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);
  void poll();

  return {
    async send(message) {
      const documentId = `${Date.now()}-${role}-${crypto.randomUUID()}`;
      await postDocument(messagesPath, documentId, {
        from: stringField(role),
        type: stringField(message.type),
        payload: stringField(JSON.stringify(message.data)),
        createdAt: timestampField(),
      });
    },
    onMessage(nextHandler) {
      handler = nextHandler;
      void poll();
    },
    close() {
      closed = true;
      window.clearInterval(intervalId);
      void patchDocument(`${roomPath}/peers/${role}`, {
        role: stringField(role),
        online: { booleanValue: false },
        leftAt: timestampField(),
      });
    },
  };
}
