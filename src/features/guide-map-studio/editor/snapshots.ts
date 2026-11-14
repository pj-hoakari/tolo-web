// 保存ポイント（地図のスナップショット）。ユーザーが好きなときに（⌘S でも）名前を付けて残し、あとでその状態に戻せる。
// ページを開き直すと ⌘Z の履歴は消えるが、保存ポイントは残る。消すのはユーザーが削除したときだけ。
// IndexedDB に入れる（いつもの保存＝localStorage は数 MB しか無いので、そちらを圧迫しないため）。

import type { VenueMapDoc } from "./venueMap";

export type Snapshot = {
  id?: number;
  pageId: string;
  pageName: string;
  at: number;
  doc: VenueMapDoc;
  label?: string;
};

const DB = "guide-map-studio";
const STORE = "snapshots";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      s.createIndex("pageId", "pageId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

/** そのタブの保存ポイント（新しい順） */
export async function listSnapshots(pageId: string): Promise<Snapshot[]> {
  const db = await open();
  const tx = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).index("pageId").getAll(pageId);
  const rows = await new Promise<Snapshot[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as Snapshot[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => b.at - a.at);
}

/** 保存ポイントを足す */
export async function addSnapshot(s: Snapshot): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add({
    pageId: s.pageId,
    pageName: s.pageName,
    at: s.at,
    doc: s.doc,
    label: s.label || undefined,
  });
  await done(tx);
  db.close();
}

/** 保存ポイントの名前を変える（空なら名前なしに戻す） */
export async function renameSnapshot(id: number, label: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const req = store.get(id);
  req.onsuccess = () => {
    if (req.result) store.put({ ...req.result, label: label || undefined });
  };
  await done(tx);
  db.close();
}

/** 保存ポイントを消す */
export async function deleteSnapshot(id: number): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await done(tx);
  db.close();
}

/** いまの時刻（ミリ秒） */
export const nowMs = () => Date.now();
