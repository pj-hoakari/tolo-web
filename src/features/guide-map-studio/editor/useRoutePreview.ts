// 誘導プレビュー：お客さんの画面（tolo-web）と同じ計算で、現在地から目的地への道を出し、混雑を試す

import * as React from "react";
import {
  computeFloorRoute,
  type FloorRouteResult,
  type FloorRouteStep,
} from "@/features/guest/info/guideMapFloorRoute";
import { crowdByObject } from "@/features/guest/info/guideMapLayout";
import { labelOf, toRouteLayout } from "./guideMapIO";
import { useI18n } from "./i18n";
import { PREVIEW_CROWD_CHOICES } from "./PropertyPanel";
import {
  CONNECTOR_TYPES,
  type ConnectorType,
  type CrowdState,
  type Floor,
  isConnector,
  isTwinOf,
  type MapObject,
  type PlaceObject,
  type VenueMapDoc,
} from "./venueMap";

// 階をまたぐ経路（重いので floors/objects・出発・目的地が変わった時だけ計算）。
// お客さんの画面の案内マップと同じ計算（src/features/guest/info/guideMapFloorRoute.ts）をそのまま使い、同じ道を出す。
function useFloorRoute(
  floors: Floor[],
  objects: MapObject[],
  startId: string,
  goalId: string,
  crowd: Map<string, CrowdState>,
) {
  return React.useMemo((): FloorRouteResult | null => {
    if (!startId || !goalId) return null;
    return computeFloorRoute(
      toRouteLayout({ floors, objects, north: 0, scale: 0 }),
      startId,
      goalId,
      { crowd },
    );
  }, [floors, objects, startId, goalId, crowd]);
}

export type RoutePreview = ReturnType<typeof useRoutePreview>;

/**
 * 誘導プレビューの状態と計算。出発（現在地）はマップに保存するので doc.startId を使う。
 * 名前の出し方（お客さんの画面での名前・階段・エレベーターの番号）もここで決める
 */
export function useRoutePreview(doc: VenueMapDoc, paused = false) {
  const { t, tg, lang, connectorName } = useI18n();
  const routeStart = doc.startId ?? "";
  const [routeGoal, setRouteGoal] = React.useState(""); // 誘導プレビューの目的地ピン
  // 誘導プレビューで試す混雑（保存しない）。tolo-web に届く混雑と同じく、グラフのポイント・ルートごとに付ける
  // キー：「pointId:<ID>」「routeId:<ID>」（tolo-web と同じ）、グラフと結び付いていない物は「object:<地図の物の id>」
  const [previewCrowd, setPreviewCrowd] = React.useState<
    Record<string, CrowdState>
  >({});
  const [trialLevel, setTrialLevel] = React.useState("high"); // 混雑を試すときの度合い（中・高・危険）
  const floorName = (id: string) =>
    doc.floors.find((f) => f.id === id)?.name ?? "";
  // お客さんの画面（tolo-web）での名前。グラフのポイントに結び付いていれば、ポイントの名前が出る
  const graphPointName = (pid: string | undefined) =>
    pid
      ? labelOf(doc.graph?.points.find((p) => p.id === pid)?.labels, lang)
      : "";
  const shownName = (o: MapObject) =>
    graphPointName(o.graphPointId) || o.title?.trim() || "";
  const titleOf = (id: string) => {
    const o = doc.objects.find((x) => x.id === id);
    // 階段・エレベーターが何台もあるときは、混雑を試す表と同じ番号で呼ぶ（例：「エレベーター 2」）
    if (o && isConnector(o))
      return carLabelOf(o.link) || shownName(o) || connectorName(o.connector);
    return (o && shownName(o)) || t("（無題）");
  };
  // その種類の階段・エレベーター（1台＝全部の階を通る1つの link）を、地図の上→下、左→右の順に並べる（どの階でも同じ順）
  const carLinksOf = (ct: ConnectorType) => {
    const links = [
      ...new Set(
        doc.objects.flatMap((o) =>
          isConnector(o) && o.connector === ct ? [o.link] : [],
        ),
      ),
    ];
    const posOf = (l: string) =>
      doc.objects.find((o) => isTwinOf(o, l)) as PlaceObject;
    return links.sort(
      (a, b) => posOf(a).y - posOf(b).y || posOf(a).x - posOf(b).x,
    );
  };
  // 階段・エレベーターの番号付きの名前（例：「エレベーター 2」。1台だけなら番号なし）
  const carLabelOf = (link: string) => {
    const one = doc.objects.find((o) => isTwinOf(o, link)) as
      | PlaceObject
      | undefined;
    if (!one?.connector) return "";
    const ct = one.connector;
    const links = carLinksOf(ct);
    return links.length > 1
      ? `${connectorName(ct)} ${links.indexOf(link) + 1}`
      : connectorName(ct);
  };
  // 混雑を試すときのキー（tolo-web に届く混雑と同じ ID。グラフと結び付いていなければ地図の物の id）
  const crowdKeyOf = (o: MapObject) =>
    isConnector(o)
      ? `object:${o.id}`
      : o.graphPointId
        ? `pointId:${o.graphPointId}`
        : o.graphRouteId
          ? `routeId:${o.graphRouteId}`
          : `object:${o.id}`;
  // 道の計算は重い（1 回 10〜20ms）ので、物を動かしている間（paused）は計算し直さない（混雑の割り当ても道の計算の入力なので同じ）。
  // 動かす前の地図で道を出したままにし、離したら（paused でなくなったら）いまの地図で計算する
  const [routeInput, setRouteInput] = React.useState({
    floors: doc.floors,
    objects: doc.objects,
  });
  if (
    !paused &&
    (routeInput.floors !== doc.floors || routeInput.objects !== doc.objects)
  )
    setRouteInput({ floors: doc.floors, objects: doc.objects });
  // 試している混雑を、地図の物ごとに引き直す（お客さんの画面と同じ crowdByObject。1つのポイントに結び付いた物すべてが混む）。
  // スタジオの地図は graphPointId で結び付けているので、案内マップの形（pointId）に変えてから渡す（物の id は同じ）
  const previewCrowdMap = React.useMemo(() => {
    const entries = Object.entries(previewCrowd);
    const m = crowdByObject(
      toRouteLayout({
        floors: routeInput.floors,
        objects: routeInput.objects,
        north: 0,
        scale: 0,
      }).objects,
      entries
        .filter(([k]) => !k.startsWith("object:"))
        .map(([id, st]) => ({ id, ...st })),
    );
    for (const [k, st] of entries) {
      if (k.startsWith("object:")) m.set(k.slice(7), st);
    }
    return m;
  }, [previewCrowd, routeInput]);
  // 行き先・出発に選べる場所（tolo-web と同じ：名前のある場所。階段・エレベーターは除く）
  const pins = doc.objects
    .filter(
      (o): o is PlaceObject =>
        o.kind === "place" && !isConnector(o) && Boolean(shownName(o)),
    )
    .map((o) => ({ id: o.id, label: shownName(o), floor: o.floor }));
  // 現在地を決めていないとき、tolo-web で現在地になる場所（tolo-web の GuideMap.tsx と同じ順：QR の場所 → 決めた出発 → 「現在地・入口・ゲート」などの名前 → いちばん下の階の場所）
  const toloDefaultStart =
    pins.find((p) => /現在地|入口|入場|ゲート|entrance|gate/i.test(p.label)) ??
    pins.find((p) => p.floor === doc.floors[0]?.id) ??
    pins[0];
  const routeReady =
    pins.some((p) => p.id === routeStart) &&
    pins.some((p) => p.id === routeGoal) &&
    routeStart !== routeGoal;
  const routeResult = useFloorRoute(
    routeInput.floors,
    routeInput.objects,
    routeReady ? routeStart : "",
    routeReady ? routeGoal : "",
    previewCrowdMap,
  );
  // 混雑が無いときの道（混雑を避けたかどうかを比べて見せる。tolo-web と同じ考え方）
  const noCrowd = React.useMemo(() => new Map<string, CrowdState>(), []);
  const plainResult = useFloorRoute(
    routeInput.floors,
    routeInput.objects,
    routeReady && previewCrowdMap.size > 0 ? routeStart : "",
    routeReady && previewCrowdMap.size > 0 ? routeGoal : "",
    noCrowd,
  );
  const plainSteps =
    plainResult && "steps" in plainResult ? plainResult.steps : null;
  const throughDanger = Boolean(
    routeResult && "throughDanger" in routeResult && routeResult.throughDanger,
  );
  const avoided =
    !throughDanger &&
    Boolean(plainSteps) &&
    Boolean(routeResult && "steps" in routeResult) &&
    JSON.stringify(plainSteps) !==
      JSON.stringify((routeResult as { steps: unknown }).steps);
  const routeSteps =
    routeResult && "steps" in routeResult ? routeResult.steps : null;
  // 地図上の目印（出発・目的地・乗り換え）。乗り換えの目印を押すと行き先の階を表示する
  const routeMarks: {
    floor: string;
    id: string;
    label: string;
    to?: string;
  }[] = [];
  if (routeSteps) {
    routeMarks.push({
      floor: pins.find((p) => p.id === routeStart)?.floor ?? "",
      id: routeStart,
      label: t("出発"),
    });
    for (const s of routeSteps) {
      if (s.kind !== "ride") continue;
      const up =
        doc.floors.findIndex((f) => f.id === s.toFloor) >
        doc.floors.findIndex((f) => f.id === s.fromFloor);
      routeMarks.push({
        floor: s.fromFloor,
        id: s.fromId,
        label: `${up ? "▲" : "▼"} ${tg("rideTo", { via: connectorName(s.via), floor: floorName(s.toFloor) })}`,
        to: s.toFloor,
      });
      routeMarks.push({
        floor: s.toFloor,
        id: s.toId,
        label: tg("arriveFrom", { floor: floorName(s.fromFloor) }),
        to: s.fromFloor,
      });
    }
    routeMarks.push({
      floor: pins.find((p) => p.id === routeGoal)?.floor ?? "",
      id: routeGoal,
      label: tg("goal"),
    });
  }
  const routeFloors = new Set(
    routeSteps
      ?.filter((s) => s.kind === "walk")
      .map((s) => (s as Extract<FloorRouteStep, { kind: "walk" }>).floor),
  );
  // 試している混雑の名前（グラフのポイント・ルートの名前、または地図の物の名前）と色
  // 階段・EV の数え方（1台＝全部の階を通る1つ。同じ link の分身はまとめて1つ）
  const CONNECTOR_UNIT: Record<ConnectorType, string> = {
    elevator: "台",
    escalator: "基",
    stairs: "か所",
  };
  const connectorCount = (ct: ConnectorType, objs: MapObject[] = doc.objects) =>
    new Set(
      objs
        .filter((o) => isConnector(o) && o.connector === ct)
        .map((o) => (o as PlaceObject).link),
    ).size;
  // ポイント・ルートに結び付いている地図の物のまとめ（例：「エレベーター3台」「受付」「地図に無し」）
  const linkedSummary = (objs: MapObject[]) => {
    if (objs.length === 0) return t("地図に無し");
    const cons = objs.filter(isConnector);
    if (
      cons.length === objs.length &&
      new Set(cons.map((c) => c.connector)).size === 1
    ) {
      const ct = cons[0].connector;
      return t("{type}{n}{unit}", {
        type: connectorName(ct),
        n: connectorCount(ct, cons),
        unit: t(CONNECTOR_UNIT[ct]),
      });
    }
    return objs.length === 1
      ? shownName(objs[0]) || t("（無題）")
      : t("{name} ほか{n}件", {
          name: shownName(objs[0]) || t("（無題）"),
          n: objs.length - 1,
        });
  };
  const pointObjects = (pid: string) =>
    doc.objects.filter((o) => o.graphPointId === pid);
  const routeObjects = (rid: string) =>
    doc.objects.filter((o) => o.graphRouteId === rid);
  // 試している混雑が、地図のどれに効くか
  const crowdTargets = (k: string) => {
    const id = k.slice(k.indexOf(":") + 1);
    if (k.startsWith("pointId:")) return pointObjects(id);
    if (k.startsWith("routeId:")) return routeObjects(id);
    return doc.objects.filter((o) => o.id === id);
  };
  // 試している混雑の名前（階・名前・結び付いている物。例：「1F エレベーター（エレベーター3台）」）
  const crowdTargetName = (k: string) => {
    const id = k.slice(k.indexOf(":") + 1);
    if (k.startsWith("pointId:")) {
      const p = doc.graph?.points.find((x) => x.id === id);
      const grp = labelOf(
        doc.graph?.groups.find((g) => g.id === p?.groupId)?.labels,
        lang,
      );
      return `${grp ? `${grp} ` : ""}${graphPointName(id) || id}（${linkedSummary(pointObjects(id))}）`;
    }
    if (k.startsWith("routeId:"))
      return `${labelOf(doc.graph?.routes.find((r) => r.id === id)?.labels, lang) || id}（${linkedSummary(routeObjects(id))}）`;
    const o = doc.objects.find((x) => x.id === id);
    return o ? `${floorName(o.floor)} ${shownName(o) || t("（無題）")}` : id;
  };
  // 混雑を試す：階段・エレベーターの表（1台＝1行。番号は地図の上→下、左→右の順でどの階でも同じ）
  const carRows = CONNECTOR_TYPES.flatMap((ct) =>
    carLinksOf(ct).map((link) => ({
      ct,
      link,
      label: carLabelOf(link),
      objs: doc.objects.filter((o) => isTwinOf(o, link)),
    })),
  );
  const isCarKey = (k: string) =>
    k.startsWith("object:") &&
    doc.objects.some((o) => o.id === k.slice(7) && isConnector(o));
  const trialState = PREVIEW_CROWD_CHOICES.find((c) => c.value === trialLevel)
    ?.state ?? { level: "high" as const, danger: false };
  // まとめて切り替える：全部混んでいれば外し、そうでなければ全部をいまの度合いにする
  const toggleTrials = (keys: string[]) =>
    setPreviewCrowd((m) => {
      const next = { ...m };
      const allOn = keys.every(
        (k) =>
          next[k] &&
          next[k].level === trialState.level &&
          next[k].danger === trialState.danger,
      );
      for (const k of keys) {
        if (allOn) delete next[k];
        else next[k] = trialState;
      }
      return next;
    });

  // 混雑を試す（state が無ければ外す）
  const setCrowdTrial = (key: string, state: CrowdState | undefined) =>
    setPreviewCrowd((m) => {
      const next = { ...m };
      if (state) next[key] = state;
      else delete next[key];
      return next;
    });
  // 誘導プレビューをはじめの状態に戻す。出発（＝お客さんの現在地）はマップに保存するデータなので残す
  const resetRoutePreview = () => {
    setRouteGoal("");
    setPreviewCrowd({});
  };
  return {
    routeGoal,
    setRouteGoal,
    previewCrowd,
    setPreviewCrowd,
    trialLevel,
    setTrialLevel,
    floorName,
    shownName,
    titleOf,
    crowdKeyOf,
    previewCrowdMap,
    pins,
    toloDefaultStart,
    routeResult,
    plainSteps,
    throughDanger,
    avoided,
    routeSteps,
    routeMarks,
    routeFloors,
    crowdTargets,
    crowdTargetName,
    carRows,
    isCarKey,
    trialState,
    toggleTrials,
    setCrowdTrial,
    resetRoutePreview,
  };
}
