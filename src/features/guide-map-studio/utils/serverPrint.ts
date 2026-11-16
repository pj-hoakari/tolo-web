// tolo-web に最後に保存した（または開いたときに確かめた）地図の指紋。イベントごとにこのブラウザに残し、
// 「tolo-web に保存していない変更」と「ほかで保存し直された地図」を見分けるのに使う
const serverPrintKey = (eventId: string) =>
  `guide-map-studio:server-print:${eventId}`;
export function readServerPrint(eventId: string) {
  try {
    return window.localStorage.getItem(serverPrintKey(eventId));
  } catch {
    return null;
  }
}
export function writeServerPrint(eventId: string, print: string | null) {
  try {
    if (print) window.localStorage.setItem(serverPrintKey(eventId), print);
    else window.localStorage.removeItem(serverPrintKey(eventId));
  } catch {
    // 残せなくても保存そのものは済んでいる
  }
}
