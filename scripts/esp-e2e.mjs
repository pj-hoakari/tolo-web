// ESP のシグナリング/E2E 確認ツール。
// 使い方（tolo-web で）:
//   EDGE_URL=https://<edge-tunnel> EMULATOR_URL=https://<emulator-tunnel> \
//   ESP_URL=http://<esp-ip> HOST_IP=<this-host-lan-ip> node scripts/esp-e2e.mjs
import { chromium } from "playwright";

const EDGE =
  process.env.EDGE_URL ??
  "https://programs-timer-contracting-longer.trycloudflare.com";
const EMU =
  process.env.EMULATOR_URL ??
  "https://communication-journals-kurt-volt.trycloudflare.com";
const TENANT = process.env.TENANT_ID ?? "0123456789abcdef";
const EVENT = process.env.EVENT_ID ?? "fedcba9876543210";
const EDGE_ID = process.env.EDGE_DEVICE_ID ?? "aabbccddeeff0011";
const HOST_IP = process.env.HOST_IP ?? "192.168.1.48";
const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "demo-tolo";
const ESP = process.env.ESP_URL ?? "http://192.168.1.80";
const BASE = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const SESSION_PATH = `tenants/${TENANT}/events/${EVENT}/edgeDevices/${EDGE_ID}/sessions`;

async function postJSON(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

function must(cond, message, extra = "") {
  if (!cond) {
    console.error("FAIL:", message, extra);
    process.exit(1);
  }
}

// 1. console token + session + Firebase ID token
let r = await postJSON("http://localhost:8082/token", {
  token_use: "event_access",
  sub: "dev-console",
  client_id: "console-ui",
  scope: "events.read",
  tenant_id: TENANT,
  event_id: EVENT,
  ttl_seconds: 600,
});
must(r.status === 200, "console token", r.text);
const consoleToken = JSON.parse(r.text).access_token;

r = await postJSON(
  `${EDGE}/tolo.edgebridge.v1.SignalingService/RequestConnection`,
  { edgeDeviceId: EDGE_ID },
  {
    Authorization: `Bearer ${consoleToken}`,
    "Connect-Protocol-Version": "1",
    Accept: "application/json",
  },
);
must(r.status === 200, "RequestConnection", r.text);
const sessionId = JSON.parse(r.text).sessionId;
console.log("session", sessionId);

r = await postJSON(
  `${EDGE}/tolo.edgebridge.v1.SignalingService/IssueFirestoreToken`,
  {},
  {
    Authorization: `Bearer ${consoleToken}`,
    "Connect-Protocol-Version": "1",
    Accept: "application/json",
  },
);
must(r.status === 200, "IssueFirestoreToken", r.text);
const custom = JSON.parse(r.text).firebaseCustomToken;

r = await postJSON(
  `${EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`,
  {
    token: custom,
    returnSecureToken: true,
  },
);
must(r.status === 200, "signInWithCustomToken", r.text);
const idToken = JSON.parse(r.text).idToken;

// 2. browser offer (non-trickle, host candidates)
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-features=WebRtcHideLocalIpsWithMdns"],
});
const page = await browser.newPage();
await page.goto("about:blank");
const rawOffer = await page.evaluate(async () => {
  const pc = new RTCPeerConnection({ iceServers: [] });
  globalThis.__pc = pc;
  globalThis.__jpeg = { count: 0, acked: 0, state: "new", channel: "" };
  pc.onconnectionstatechange = () => {
    globalThis.__jpeg.state = pc.connectionState;
  };
  pc.ondatachannel = (e) => {
    if (e.channel.label !== "jpeg") return;
    const ch = e.channel;
    ch.binaryType = "arraybuffer";
    globalThis.__jpeg.channel = ch.label;
    ch.onmessage = (m) => {
      if (!(m.data instanceof ArrayBuffer) || m.data.byteLength < 20) return;
      const v = new DataView(m.data);
      if (v.getUint32(0, true) !== 0x3147504a) return;
      const id = v.getUint32(4, true);
      globalThis.__jpeg.count++;
      try {
        ch.send(`ACK:${id}`);
        globalThis.__jpeg.acked++;
      } catch {
        /* ignore */
      }
    };
  };
  pc.createDataChannel("control");
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timer = setTimeout(resolve, 15000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    };
  });
  return pc.localDescription.sdp;
});
const offer = rawOffer.replace(
  /^(a=candidate:\S+ \d+ \S+ \d+ )(\S+\.local)( \d+ typ host)/gm,
  `$1${HOST_IP}$3`,
);
console.log("offer bytes", offer.length);
for (const line of offer.split("\n"))
  if (line.startsWith("a=candidate:")) console.log("candidate", line.trim());

// 3. write the offer as the console
const signalId = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
const docName = `projects/${PROJECT}/databases/(default)/documents/${SESSION_PATH}/${sessionId}/signals/${signalId}`;
const writeBody = {
  writes: [
    {
      update: {
        name: docName,
        fields: {
          from: { stringValue: "console" },
          payload: {
            mapValue: {
              fields: {
                kind: { stringValue: "description" },
                description: {
                  mapValue: {
                    fields: {
                      type: { stringValue: "offer" },
                      sdp: { stringValue: offer },
                    },
                  },
                },
              },
            },
          },
        },
      },
      currentDocument: { exists: false },
      updateTransforms: [
        { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
      ],
    },
  ],
};
r = await postJSON(`${EMU}${BASE}:commit`, writeBody, {
  Authorization: `Bearer ${idToken}`,
});
must(r.status === 200, "offer write", r.text);
console.log("offer written", signalId);

// 4. poll for the ESP answer
let answer = null;
for (let i = 0; i < 180; i++) {
  const res = await fetch(
    `${EMU}${BASE}/${SESSION_PATH}/${sessionId}/signals?pageSize=20`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (res.status === 200) {
    const data = await res.json();
    for (const doc of data.documents ?? []) {
      const f = doc.fields ?? {};
      const from = f.from?.stringValue;
      const kind = f.payload?.mapValue?.fields?.kind?.stringValue;
      const desc = f.payload?.mapValue?.fields?.description?.mapValue?.fields;
      if (
        from === "edge" &&
        kind === "description" &&
        desc?.type?.stringValue === "answer"
      ) {
        answer = desc.sdp.stringValue;
        break;
      }
    }
  }
  if (answer) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
must(answer, "ESP answer not found");
console.log("answer bytes", answer.length);

await page.evaluate(async (sdp) => {
  await globalThis.__pc.setRemoteDescription({ type: "answer", sdp });
}, answer);

// 5. wait for the jpeg DataChannel
for (let i = 0; i < 40; i++) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const state = await page.evaluate(() => ({ ...globalThis.__jpeg }));
  console.log(
    "peer",
    state.state,
    "frames",
    state.count,
    "acks",
    state.acked,
    "channel",
    state.channel,
  );
  if (state.state === "connected" && state.count > 0) break;
}
const final = await page.evaluate(() => ({ ...globalThis.__jpeg }));
console.log("final", final);
console.log("ESP rtc", await (await fetch(`${ESP}/rtc-status`)).text());
const log = await (await fetch(`${ESP}/log`)).text();
console.log(`ESP log tail:\n${log.split("\n").slice(-12).join("\n")}`);
await browser.close();
must(final.count > 0, "no JPEG frames received");
console.log("E2E_OK");
