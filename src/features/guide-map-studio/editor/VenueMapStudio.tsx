"use client";

import * as React from "react";
import "../studio-theme.css";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BookmarkPlus,
  ChevronDown,
  Circle as CircleIcon,
  Columns2,
  Copy,
  Download,
  Eye,
  FilePlus,
  ImageDown,
  Link2,
  ListChecks,
  Lock,
  LockOpen,
  Map as MapIcon,
  MapPin,
  Maximize,
  Monitor,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Pentagon,
  Plus,
  Printer,
  Redo2,
  Route,
  Ruler,
  Search,
  Smartphone,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  MiniMap,
  objFill,
  objLine,
  PinDot,
  ResizeHandles,
  Rulers,
  splitTitle,
} from "./CanvasParts";
import { CheckDialog } from "./CheckDialog";
import { ColorSwatch } from "./ColorSwatch";
import { CompareDialog, type CompareState } from "./CompareDialog";
import { useConfirm } from "./ConfirmDialog";
import { cloneObjects, twinOn, twinsOf } from "./copyObjects";
import { ExportPickerDialog } from "./ExportPickerDialog";
import { FloorNameInput, NumField } from "./Fields";
import { GraphLinkDialog, type LinkTab } from "./GraphLinkDialog";
import { GuidePanel } from "./GuidePanel";
import {
  detectFile,
  fromGuideMapLayout,
  labelOf,
  sampleVenueDoc,
  toGuideMapLayout,
} from "./guideMapIO";
import { StudioHelpButton } from "./HelpButton";
import { hitTest as hitTestObjects } from "./hitTest";
import { useI18n } from "./i18n";
import { NewMapDialog } from "./NewMapDialog";
import { type PlacesFilter, PlacesListDialog } from "./PlacesListDialog";
import { PopupMenu } from "./PopupMenu";
import { ConnectorPanel, crowdColor, PropertyPanel } from "./PropertyPanel";
import { areaLabelSize, roomLabel } from "./roomLabel";
import { SnapshotsDialog, snapshotClock } from "./SnapshotsDialog";
import { ConnectorIcon, KIND_ICON } from "./StudioIcons";
import { type Corner, GUIDE, PAN_PAD, type Tool } from "./shared";
import {
  addSnapshot,
  deleteSnapshot,
  listSnapshots,
  nowMs,
  renameSnapshot,
  type Snapshot,
} from "./snapshots";
import { ToolCard } from "./ToolCard";
import { useRoutePreview } from "./useRoutePreview";
import {
  type AreaObject,
  anchorOf,
  areaPalette,
  bboxOf,
  buildingOf,
  CONNECTOR_LABEL,
  CONNECTOR_TYPES,
  type ConnectorObject,
  type ConnectorType,
  centroidOf,
  DEFAULT_COLOR,
  emptyDoc,
  type Floor,
  floorSize,
  genId,
  hasInfo,
  isConnector,
  isTwinOf,
  MAP_FLOOR,
  MAP_WALL,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
  type MapObject,
  markBoxOf,
  markOf,
  normalizeDoc,
  PALETTE,
  PALETTE_GROUPS,
  PALETTE_KEYS,
  type PaletteKey,
  type PlaceObject,
  type Pt,
  paletteOf,
  type StudioBook,
  type StudioPage,
  shownColorOf,
  studioBookKey,
  type TextObject,
  toPointsAttr,
  type VenueGraph,
  type VenueMapDoc,
} from "./venueMap";
import { type CheckIssue, checkVenueDoc } from "./venueMapCheck";
import {
  floorBounds,
  floorSvg,
  SVG_DARK,
  SVG_LIGHT,
  svgToPngBlob,
} from "./venueMapSvg";
import {
  type Box,
  boxOf,
  type GapMark,
  type GuideLine,
  smartSnap,
  snapResize,
  unionBox,
} from "./venueSnap";

// 使い方（Q&A）の中身は大きいので、開いたときに読み込む
const StudioHelpDialog = dynamic(() =>
  import("./StudioHelp").then((m) => m.StudioHelpDialog),
);

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
const WHEEL_ZOOM_SPEED = 0.0025; // ホイール1単位あたりの拡大率（対数）
const WHEEL_DELTA_MAX = 20; // 1イベントで効く deltaY の上限（マウス1ノッチ ≒ 5%）
const GRID_SNAP = 20; // グリッドに揃える刻み（方眼 40px の半分）
// 選択中の強調（アクセント色の太いリング＋外側のハロー）
const SEL = "var(--primary)";
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
// 画面だけの設定（全体図・定規）の保存キー
const VIEW_PREFS_KEY = "venue-map:view-prefs";

// 出発（startId）の場所が消えていたら、出発も外す（消えた場所を指したまま書き出さないように）
const dropDanglingStart = (d: VenueMapDoc): VenueMapDoc =>
  d.startId && !d.objects.some((o) => o.id === d.startId)
    ? { ...d, startId: undefined }
    : d;
// まだ使われていない名前にする（「1F（コピー）」がすでにあれば「1F（コピー2）」）
function uniqueName(
  base: string,
  used: string[],
  numbered: (n: number) => string,
) {
  if (!used.includes(base)) return base;
  let n = 2;
  while (used.includes(numbered(n))) n++;
  return numbered(n);
}
const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;

type Drag =
  | {
      kind: "pan";
      cx: number;
      cy: number;
      sl: number;
      st: number;
      moved: boolean;
      tap?: string | null;
    }
  | {
      kind: "move";
      ids: string[];
      pressed: string;
      additive: boolean;
      start: Pt;
      rawStart: Pt;
      origins: Record<string, MapObject>;
      box: Box;
      others: Box[];
      moved: boolean;
    }
  | { kind: "vertex"; id: string; index: number; origin: Pt[] } // origin＝ドラッグ開始時の頂点（辺の向きの判定に使う）
  | { kind: "draw"; shape: "rect" | "circle" | "area"; start: Pt; cur: Pt }
  | {
      kind: "resize";
      id: string;
      corner: Corner;
      origin: PlaceObject;
      others: Box[];
    }
  | { kind: "marquee"; start: Pt; raw: Pt; base: string[] } // base＝Shift で足すときの元の選択、raw＝押した位置（クリック判定用）
  | null;

// 名前は「何を置く道具か」で呼ぶ（形の名前ではなく用途）。shortcut＝その道具を選ぶキー、desc＝使い方の説明（マウスを置くと出る）
const TOOLS: {
  key: Tool;
  label: string;
  short?: string;
  shortcut: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "select",
    label: "選択",
    shortcut: "V",
    desc: "地図の物を選んで、動かしたり大きさを変えたりします。何もない所をドラッグすると、まとめて選べます。",
    Icon: MousePointer2,
  },
  {
    key: "rect",
    label: "部屋・区画",
    shortcut: "R",
    desc: "ドラッグして、部屋や売り場を描きます。部屋どうしのすき間が、お客さんの通る道になります。",
    Icon: Square,
  },
  {
    key: "circle",
    label: "丸い区画",
    shortcut: "C",
    desc: "ドラッグして、丸い形の区画（ブース・広場など）を描きます。",
    Icon: CircleIcon,
  },
  {
    key: "pin",
    label: "目印（ピン）",
    short: "目印",
    shortcut: "P",
    desc: "クリックした所に目印を置きます。入口・案内所など、部屋ではない場所に使います。",
    Icon: MapPin,
  },
  {
    key: "area",
    label: "範囲",
    shortcut: "A",
    desc: "ドラッグして範囲を囲みます。待機列の場所、通行止めにする所、建物全体などを示すのに使います。",
    Icon: Pentagon,
  },
  {
    key: "text",
    label: "文字",
    shortcut: "T",
    desc: "クリックした所に文字を置きます。建物名や「本館」などの見出しに使います。",
    Icon: Type,
  },
  {
    key: "connector",
    label: "階段・EV",
    shortcut: "E",
    desc: "クリックした所に階段・エスカレーター・エレベーターを置きます。全部の階の同じ位置に置かれます。",
    Icon: ArrowUpDown,
  },
];

// 階移動ポイント（階段・エスカレーター・エレベーター）はどの階でも同じ位置・同じ大きさ。
// movedIds のうち階移動ポイントがあれば、同じ link の分身（他の階）の位置・大きさ・形をそろえる。
function syncLinkedPositions(
  objs: MapObject[],
  movedIds: Set<string>,
): MapObject[] {
  const geo = new Map<
    string,
    Pick<PlaceObject, "x" | "y" | "w" | "h" | "shape" | "markW" | "markH">
  >();
  for (const o of objs)
    if (movedIds.has(o.id) && isConnector(o))
      geo.set(o.link, {
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        shape: o.shape,
        markW: o.markW,
        markH: o.markH,
      });
  if (geo.size === 0) return objs;
  return objs.map((o) => {
    const g = isConnector(o) ? geo.get(o.link) : undefined;
    return g ? ({ ...o, ...g } as MapObject) : o;
  });
}
// 削除・選択の対象を、階移動ポイントなら同じ link の全フロア分に広げる
function withLinkedTwins(objs: MapObject[], ids: Set<string>): Set<string> {
  const links = new Set(
    objs
      .filter((o) => ids.has(o.id) && isConnector(o))
      .map((o) => (o as ConnectorObject).link),
  );
  if (links.size === 0) return ids;
  return new Set([
    ...ids,
    ...objs.filter((o) => isConnector(o) && links.has(o.link)).map((o) => o.id),
  ]);
}

function guessConnector(title?: string): ConnectorType | null {
  if (!title) return null;
  if (/エレベ|ＥＶ|\bEV\b|elevator/i.test(title)) return "elevator";
  if (/エスカ|escalator/i.test(title)) return "escalator";
  if (/階段|stairs?/i.test(title)) return "stairs";
  return null;
}

// eventId＝このイベントの案内マップ（ブラウザへの保存もイベントごとに分ける）。
// leading / trailing＝上の帯の左端・右端に置く物（ページの戻るリンク・見出し・言語やテーマの切り替えなど）。
// 帯を 1 段にまとめて、地図を広く使えるようにする
type VenueMapStudioProps = {
  eventId: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export function VenueMapStudio({
  eventId,
  leading,
  trailing,
}: VenueMapStudioProps) {
  const { t, tg, lang, connectorName } = useI18n();
  // 確かめる・知らせる小さな画面（window.confirm / alert の代わり）
  const {
    confirm,
    notify,
    dialog: confirmDialog,
    open: confirmOpen,
  } = useConfirm();
  const { resolvedTheme } = useTheme();
  const [doc, setDoc] = React.useState<VenueMapDoc>(() => emptyDoc());
  // エクセルのシートのようなタブ（別々のマップ）。表示中のタブの中身は doc にあり、pages 側の doc は切り替えたときに更新する
  const [pages, setPages] = React.useState<StudioPage[]>(() => [
    { id: "p1", name: "", doc: emptyDoc() },
  ]);
  const [activePageId, setActivePageId] = React.useState("p1");
  const [pageMenu, setPageMenu] = React.useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null); // マップタブの右クリックメニュー
  const [editingPage, setEditingPage] = React.useState<string | null>(null); // 名前を編集中のマップタブ
  const [pageDrag, setPageDrag] = React.useState<{
    id: string;
    to: number | null;
  } | null>(null); // マップタブの並べ替え（ドラッグ中）
  const [exportPicker, setExportPicker] = React.useState(false); // タブが2つ以上のとき、書き出すマップを選ぶ
  const [deletedPage, setDeletedPage] = React.useState<{
    page: StudioPage;
    index: number;
    wasActive: boolean;
  } | null>(null); // 消したタブ（数秒だけ「元に戻す」を出す）
  const [saveFailed, setSaveFailed] = React.useState(false); // ブラウザに保存できなかった（容量がいっぱいなど）
  const [check, setCheck] = React.useState<{
    pageId: string;
    issues: CheckIssue[] | null;
    forExport: boolean;
  } | null>(null); // 書き出す前のチェック（issues=null は確認中）
  const [compare, setCompare] = React.useState<CompareState | null>(null); // 2つのタブを見比べる（階は名前でそろえる）
  const [phone, setPhone] = React.useState(false); // プレビューをスマホの画面で見る
  const [query, setQuery] = React.useState(""); // 名前で探す
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const searchBlurRef = React.useRef(0);
  const [historyList, setHistoryList] = React.useState<
    Snapshot[] | null | "loading"
  >(null); // 保存ポイントの一覧（null＝閉じている）
  const [shareMenu, setShareMenu] = React.useState(false); // 「確かめる・共有」のメニュー
  const [sideOpen, setSideOpen] = React.useState(true); // 右の設定を出しているか
  const [sideTab, setSideTab] = React.useState<"settings" | "guide">(
    "settings",
  ); // 右の設定のタブ
  const [colorMenu, setColorMenu] = React.useState(false); // 道具の列の色えらび
  // 道具の説明のカード（動画つき）。1枚だけ出して、マウスを置いた道具の横へ動かす。
  // ・開く：少し置いてから。閉じた直後に隣の道具へ移ったときは待たずに開く
  // ・移る：開いたまま隣の道具へ移ったら、出し直さずにすべって移る（中身だけ入れ替える）
  // ・閉じる：すき間を通っただけでちらつかないよう少し待ち、短くフェードして消す
  const [toolCard, setToolCard] = React.useState<{
    tool: Tool;
    top: number;
    left: number;
    notch: number;
    phase: "in" | "swap" | "out";
  } | null>(null);
  const toolCardRef = React.useRef<HTMLDivElement>(null);
  const toolCardOpenTimer = React.useRef<number | undefined>(undefined);
  const toolCardCloseTimer = React.useRef<number | undefined>(undefined);
  const toolCardWarmUntil = React.useRef(0);
  const openToolCard = (key: Tool, el: HTMLElement, now = false) => {
    window.clearTimeout(toolCardOpenTimer.current);
    window.clearTimeout(toolCardCloseTimer.current);
    // 道具の上端にそろえる。下にはみ出すときは上へずらす（三角はいつも道具の真ん中を指す）
    const r = el.getBoundingClientRect();
    const h = toolCardRef.current?.offsetHeight ?? 300;
    const top = Math.max(8, Math.min(r.top - 6, window.innerHeight - h - 12));
    const place = {
      tool: key,
      top,
      left: r.right + 12,
      notch: r.top + r.height / 2 - top - 5,
    };
    if (toolCard) setToolCard({ ...place, phase: "swap" });
    else if (now || nowMs() < toolCardWarmUntil.current)
      setToolCard({ ...place, phase: "in" });
    else
      toolCardOpenTimer.current = window.setTimeout(
        () => setToolCard({ ...place, phase: "in" }),
        380,
      );
  };
  const closeToolCard = (wait = 90) => {
    window.clearTimeout(toolCardOpenTimer.current);
    window.clearTimeout(toolCardCloseTimer.current);
    if (!toolCard) return;
    toolCardCloseTimer.current = window.setTimeout(() => {
      toolCardWarmUntil.current = nowMs() + 700;
      setToolCard((c) => (c ? { ...c, phase: "out" } : c));
      toolCardCloseTimer.current = window.setTimeout(
        () => setToolCard(null),
        130,
      );
    }, wait);
  };
  const [historyNow, setHistoryNow] = React.useState(0); // 保存ポイントを開いた時刻（「〇分前」の基準）
  const [tool, setTool] = React.useState<Tool>("select");
  const [color, setColor] = React.useState<PaletteKey>(DEFAULT_COLOR);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [marquee, setMarquee] = React.useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [floorMenu, setFloorMenu] = React.useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null); // フロアタブの右クリックメニュー
  const [editingFloor, setEditingFloor] = React.useState<string | null>(null); // 名前を編集中のフロア
  const [floorDrag, setFloorDrag] = React.useState<{
    id: string;
    to: number | null;
  } | null>(null); // タブの並べ替え（ドラッグ中）
  const [drawBox, setDrawBox] = React.useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null); // 四角/丸/エリア ドラッグ中のプレビュー
  const [zoom, setZoom] = React.useState(1);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showMini, setShowMini] = React.useState(true); // 全体図（ミニマップ）
  const [showRulers, setShowRulers] = React.useState(true); // 定規（座標）を表示
  const [advancedOpen, setAdvancedOpen] = React.useState(false); // 右の設定の「くわしい設定」を開いているか
  const [linkOpen, setLinkOpen] = React.useState(false); // tolo-web のグラフとのつなぎ（一覧）
  const [linkTab, setLinkTab] = React.useState<LinkTab>("points");
  const [linkUnlinkedOnly, setLinkUnlinkedOnly] = React.useState(false);
  const [newMapOpen, setNewMapOpen] = React.useState(false); // 新規作成で、建物（階あり）か会場（階なし）かを選ぶ
  const [listOpen, setListOpen] = React.useState(false); // 場所の一覧表
  const [listFilter, setListFilter] = React.useState<PlacesFilter>({
    floor: "",
    query: "",
    unnamed: false,
  }); // 一覧の絞り込み（閉じても残す）
  const [view, setView] = React.useState({ sl: 0, st: 0, cw: 0, ch: 0 }); // 地図の見えている範囲（全体図の枠に使う）
  const [showInfo, setShowInfo] = React.useState(false); // 選択中の情報カードを表示
  const [spaceDown, setSpaceDown] = React.useState(false); // Space押下中はパン
  const [notice, setNotice] = React.useState<string | null>(null); // 画面下に少しだけ出すお知らせ
  const [helpOpen, setHelpOpen] = React.useState(false); // 使い方（Q&A）
  const [exportDone, setExportDone] = React.useState(false); // 書き出した直後の「完了」表示（1.5 秒）
  const [guides, setGuides] = React.useState<{
    lines: GuideLine[];
    gaps: GapMark[];
  } | null>(null); // ドラッグ中のスマートガイド
  const [metaDown, setMetaDown] = React.useState(false); // ⌘（Command）押下中もパン（掴んで移動）
  const [preview, setPreview] = React.useState(false); // プレビュー（閲覧）モード：タップで説明を表示
  const [connectorType, setConnectorType] =
    React.useState<ConnectorType>("elevator"); // 「階移動」ツールで置く種類

  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const worldRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Drag>(null);
  // 元に戻す／やり直しの履歴と、コピーした項目（⌘Z・⌘C・⌘V）
  const pastRef = React.useRef<VenueMapDoc[]>([]);
  const futureRef = React.useRef<VenueMapDoc[]>([]);
  const committedRef = React.useRef<VenueMapDoc | null>(null);
  const skipHistoryRef = React.useRef(false);
  const lastChangeRef = React.useRef(0);
  // コピーした項目。階段・エレベーター等は、ほかの階の分身（どの階につながるか・各階の設定）も一緒に覚える
  const clipboardRef = React.useRef<{
    items: MapObject[];
    twins: ConnectorObject[];
  }>({ items: [], twins: [] });
  const pasteCountRef = React.useRef(new Map<string, number>()); // 貼り付け先の階ごとの回数
  const importRef = React.useRef<HTMLInputElement>(null);
  // ブラウザの保存から読み戻し終えたか。読み戻す前の空の地図で保存を上書きしないよう、次の描画から保存を始める
  const [hydrated, setHydrated] = React.useState(false);
  const pageHistoryRef = React.useRef(
    new Map<string, { past: VenueMapDoc[]; future: VenueMapDoc[] }>(),
  ); // 元に戻すの履歴はタブごと

  const floor =
    doc.floors.find((f) => f.id === doc.activeFloorId) ?? doc.floors[0];
  const { w: worldW, h: worldH } = floorSize(floor);
  const objects = doc.objects.filter((o) => o.floor === doc.activeFloorId);
  // お客さんの画面で壁として描く建物の外枠（範囲の描き分けに使う）
  const building = buildingOf(objects);
  const lockedIds = new Set(objects.filter((o) => o.locked).map((o) => o.id));
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected = objects.find((o) => o.id === selectedId) ?? null;
  // 選んでいる物の色（全部が同じ色のときだけ。色えらびでその色を光らせる）
  const selectedColors = new Set(
    objects.filter((o) => selectedIds.includes(o.id)).map(shownColorOf),
  );
  const selectedColor =
    selectedColors.size === 1 ? [...selectedColors][0] : null;
  const select = React.useCallback(
    (id: string | null) => setSelectedIds(id ? [id] : []),
    [],
  );
  // 誘導プレビューの出発ピン＝現在地。マップに保存され、書き出した JSON の startId として tolo-web の出発点になる
  // 物を動かしている最中（移動・大きさ変え・頂点）。この間は誘導の道を計算し直さない（離したときに 1 回だけ）
  const [editing, setEditing] = React.useState(false);
  const route = useRoutePreview(doc, editing);
  const {
    setRouteGoal,
    previewCrowd,
    setPreviewCrowd,
    floorName,
    shownName,
    crowdKeyOf,
    previewCrowdMap,
    plainSteps,
    avoided,
    routeSteps,
    routeMarks,
    routeFloors,
    setCrowdTrial,
  } = route;
  const setRouteStart = React.useCallback(
    (id: string) => setDoc((d) => ({ ...d, startId: id || undefined })),
    [],
  );

  // --- スマホの画面で見る（プレビュー）---
  const phoneView = preview && phone;
  const PHONE_W = 390; // 画面の幅（一般的なスマホ）
  const PHONE_H = 844;
  const phoneZoomRef = React.useRef<number | null>(null); // スマホで見る前の拡大率（戻すときに使う）
  // スマホの形は本物と同じ大きさ（390×844）で作り、置き場所に収まるよう全体を縮めて見せる（縦横の比はそのまま）
  const PHONE_BEZEL = 11;
  const phoneStageRef = React.useRef<HTMLDivElement>(null);
  const [phoneScale, setPhoneScale] = React.useState(1);
  React.useEffect(() => {
    const el = phoneStageRef.current;
    if (!phoneView || !el) return;
    const fitToBox = () =>
      setPhoneScale(
        Math.min(
          1,
          (el.clientHeight - 48) / (PHONE_H + PHONE_BEZEL * 2),
          (el.clientWidth - 32) / (PHONE_W + PHONE_BEZEL * 2),
        ),
      );
    fitToBox();
    const ro = new ResizeObserver(fitToBox);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phoneView]);
  const viewScale = phoneView ? phoneScale : 1; // 画面の上での縮み（マウスの位置を地図の座標に直すときに使う）
  // 地図の中身が画面の幅に収まる大きさにして、左上から見せる
  const fitPhone = (d: VenueMapDoc = doc, floorId = d.activeFloorId) => {
    const objs = d.objects.filter((o) => o.floor === floorId);
    if (objs.length === 0) return;
    if (phoneZoomRef.current === null) phoneZoomRef.current = zoom;
    const u = unionBox(objs.map(boxOf));
    const z = clampZoom(Math.min(1, (PHONE_W - 24) / Math.max(1, u.r - u.l)));
    setZoom(z);
    window.requestAnimationFrame(() => {
      const sc = scrollerRef.current;
      if (sc)
        sc.scrollTo({
          left: PAN_PAD + u.l * z - 12,
          top: PAN_PAD + u.t * z - 12,
        });
    });
  };
  // --- 表示する範囲 ---
  // 地図の中身（何も無ければ左上）が見えるようにする。keepZoom＝拡大率はそのままで、中身を真ん中に寄せるだけ
  const fitView = (
    d: VenueMapDoc,
    floorId = d.activeFloorId,
    keepZoom = false,
  ) => {
    const f = d.floors.find((x) => x.id === floorId) ?? d.floors[0];
    if (!f) return;
    if (preview && phone) {
      fitPhone(d, f.id);
      return;
    }
    const empty = !f.image && !d.objects.some((o) => o.floor === f.id);
    const b = floorBounds(d, f, 24);
    window.requestAnimationFrame(() => {
      const sc = scrollerRef.current;
      if (!sc) return;
      const cw = sc.clientWidth;
      const ch = sc.clientHeight;
      const z = keepZoom
        ? zoom
        : empty
          ? 1
          : clampZoom(Math.min(1, cw / b.w, ch / b.h));
      setZoom(z);
      // 拡大率が変わって中の大きさが変わってから動かす
      window.requestAnimationFrame(() => {
        if (empty) {
          sc.scrollTo({ left: PAN_PAD - 24, top: PAN_PAD - 24 });
          return;
        }
        sc.scrollTo({
          left: PAN_PAD + b.x * z - Math.max(0, (cw - b.w * z) / 2),
          top: PAN_PAD + b.y * z - Math.max(0, (ch - b.h * z) / 2),
        });
      });
    });
  };

  // --- 保存・復元 ---
  // 全部のタブをまとめて、このブラウザに保存する（イベントごと）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 復元するのはイベントが変わったときだけ（fitView は毎回作り直す関数なので入れない）
  React.useEffect(() => {
    try {
      const rawBook = window.localStorage.getItem(studioBookKey(eventId));
      const book = rawBook ? (JSON.parse(rawBook) as StudioBook) : null;
      const okPages = (
        book?.pages?.filter((p) => p?.id && p.doc?.floors?.length) ?? []
      ).map((p) => ({ ...p, doc: normalizeDoc(p.doc) }));
      if (okPages.length) {
        const active =
          okPages.find((p) => p.id === book?.activePageId) ?? okPages[0];
        skipHistoryRef.current = true; // 復元は「元に戻す」の対象にしない
        setPages(okPages);
        setActivePageId(active.id);
        setDoc(active.doc);
        fitView(active.doc);
      }
    } catch {
      // 壊れた保存は無視
    }
    setHydrated(true);
  }, [eventId]);
  // 変えるたびに保存すると、ドラッグ中はマウスが動くたびに全部のタブを書き込んで重くなるので、
  // 最後の変更から少し待って 1 回だけ保存する。待っている間にページを閉じる・ほかの画面へ移るときは、その場で保存する
  const pendingSaveRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    if (!hydrated) return;
    const save = () => {
      pendingSaveRef.current = null;
      try {
        const book: StudioBook = {
          activePageId,
          pages: pages.map((p) => (p.id === activePageId ? { ...p, doc } : p)),
        };
        window.localStorage.setItem(
          studioBookKey(eventId),
          JSON.stringify(book),
        );
        setSaveFailed(false);
      } catch {
        // 容量がいっぱいなど。黙っていると閉じたときに消えるので、画面に出して知らせる
        setSaveFailed(true);
      }
    };
    pendingSaveRef.current = save;
    const timer = window.setTimeout(save, 400);
    return () => window.clearTimeout(timer);
  }, [doc, pages, activePageId, eventId, hydrated]);
  React.useEffect(() => {
    const flush = () => pendingSaveRef.current?.();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  React.useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.scrollLeft = PAN_PAD;
    sc.scrollTop = PAN_PAD;
  }, []);

  // --- 座標変換（グリッドにスナップ） ---
  const rawPoint = (e: { clientX: number; clientY: number }): Pt => {
    const r = worldRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return {
      x: (e.clientX - r.left) / (zoom * viewScale),
      y: (e.clientY - r.top) / (zoom * viewScale),
    };
  };
  const worldPoint = (e: { clientX: number; clientY: number }): Pt => {
    const p = rawPoint(e);
    return { x: snap(p.x), y: snap(p.y) };
  };

  // --- doc 更新ヘルパー ---
  const updateObject = (id: string, patch: Partial<MapObject>) =>
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        o.id === id ? ({ ...o, ...patch } as MapObject) : o,
      ),
    }));
  const addObject = (o: MapObject) =>
    setDoc((d) => ({ ...d, objects: [...d.objects, o] }));
  const deleteObject = (id: string) => {
    if (lockedIds.has(id)) return;
    setDoc((d) => {
      const gone = withLinkedTwins(d.objects, new Set([id]));
      return dropDanglingStart({
        ...d,
        objects: d.objects.filter((o) => !gone.has(o.id)),
      });
    });
    setSelectedIds((s) => s.filter((x) => x !== id));
  };
  // --- 選択（複数可）に対する一括操作 ---
  const deleteSelected = (ids0: string[]) => {
    const ids = ids0.filter((id) => !lockedIds.has(id)); // 固定したものは消さない
    if (ids.length === 0) {
      if (ids0.length)
        setNotice(t("固定しているので消せません。固定を外してください"));
      setMenu(null);
      return;
    }
    setDoc((d) => {
      const gone = withLinkedTwins(d.objects, new Set(ids));
      return dropDanglingStart({
        ...d,
        objects: d.objects.filter((o) => !gone.has(o.id)),
      });
    });
    setSelectedIds([]);
    setMenu(null);
  };
  const colorSelected = (ids: string[], k: PaletteKey) => {
    const set = new Set(ids);
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        set.has(o.id) ? ({ ...o, color: k } as MapObject) : o,
      ),
    }));
    setMenu(null);
  };
  // 位置・大きさを数字で変える（X・Y は左上。ピン・文字は点の位置）。階段などは全部の階の分身もそろえる
  const setGeometry = (
    o: MapObject,
    next: { left?: number; top?: number; w?: number; h?: number },
  ) => {
    setDoc((d) => ({
      ...d,
      objects: syncLinkedPositions(
        d.objects.map((x) => {
          if (x.id !== o.id) return x;
          if (x.kind === "area" || x.kind === "route") {
            const bb = bboxOf(x.points);
            const dx = next.left !== undefined ? next.left - bb.x : 0;
            const dy = next.top !== undefined ? next.top - bb.y : 0;
            return {
              ...x,
              points: x.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            } as MapObject;
          }
          if (x.kind === "text" || (x.kind === "place" && x.shape === "pin"))
            return {
              ...x,
              x: next.left ?? x.x,
              y: next.top ?? x.y,
            } as MapObject;
          const w = next.w ?? x.w;
          const h = next.h ?? x.h;
          const left = next.left ?? x.x - x.w / 2;
          const top = next.top ?? x.y - x.h / 2;
          return { ...x, w, h, x: left + w / 2, y: top + h / 2 } as MapObject;
        }),
        new Set([o.id]),
      ),
    }));
  };

  // 固定する／固定を外す（階段・エレベーターは全部の階の分身もまとめて）
  const lockSelected = (ids: string[], locked: boolean) => {
    setDoc((d) => {
      const set = withLinkedTwins(d.objects, new Set(ids));
      return {
        ...d,
        objects: d.objects.map((o) =>
          set.has(o.id)
            ? ({ ...o, locked: locked || undefined } as MapObject)
            : o,
        ),
      };
    });
    setMenu(null);
  };
  // 選択中の route/area をまとめて通行止め/解除
  const closedSelected = (ids: string[], closed: boolean) => {
    const set = new Set(ids);
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        set.has(o.id) && o.kind === "area"
          ? ({ ...o, closed } as MapObject)
          : o,
      ),
    }));
    setMenu(null);
  };
  // 選択中をまとめて移動（グリッド刻み）
  const nudgeSelected = (ids: string[], dx: number, dy: number) => {
    const set = new Set(ids.filter((id) => !lockedIds.has(id)));
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) => {
        if (!set.has(o.id)) return o;
        if (o.kind === "place" || o.kind === "text")
          return { ...o, x: o.x + dx, y: o.y + dy } as MapObject;
        return {
          ...o,
          points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        } as MapObject;
      }),
    }));
    setDoc((d) => ({ ...d, objects: syncLinkedPositions(d.objects, set) }));
  };
  // --- 四角などのサイズの均等補正 ---
  const sizeSelected = (ids: string[], dim: "w" | "h" | "both") => {
    const set = new Set(ids);
    const sel = objects.filter(
      (o): o is PlaceObject =>
        set.has(o.id) && o.kind === "place" && o.shape !== "pin",
    );
    if (sel.length < 2) return;
    const w = Math.max(...sel.map((o) => o.w));
    const h = Math.max(...sel.map((o) => o.h));
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) => {
        if (!set.has(o.id) || o.kind !== "place" || o.shape === "pin") return o;
        return {
          ...o,
          w: dim === "h" ? o.w : w,
          h: dim === "w" ? o.h : h,
        } as MapObject;
      }),
    }));
  };
  const duplicateSelected = (ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    const items = doc.objects.filter((o) => set.has(o.id));
    const clones = cloneObjects(
      doc.floors,
      items,
      twinsOf(doc.objects, items),
      doc.activeFloorId,
      24,
    );
    setDoc((d) => ({ ...d, objects: [...d.objects, ...clones.all] }));
    setSelectedIds(clones.shown.map((c) => c.id));
    setMenu(null);
  };

  // --- 階移動ポイント（同じ link のものが各階にあり、まとめて1つの階段/エスカレーター/エレベーター） ---
  const setConnectorGroup = (
    link: string,
    patch: (o: ConnectorObject) => Partial<ConnectorObject>,
  ) =>
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        isTwinOf(o, link) ? ({ ...o, ...patch(o) } as MapObject) : o,
      ),
    }));
  // 名前が既定の名前（日本語・英語どちらでも）のままなら、新しい種類の名前に付け替える
  const isDefaultName = (title: string | undefined, ct: ConnectorType) =>
    title === CONNECTOR_LABEL[ct] || title === connectorName(ct);
  const changeConnectorType = (link: string, ct: ConnectorType) =>
    setConnectorGroup(link, (o) => ({
      connector: ct,
      title: isDefaultName(o.title, o.connector) ? connectorName(ct) : o.title,
      direction: ct === "escalator" ? o.direction : "both",
    }));
  // 既存の四角/丸を「階移動（エレベーター等）」にする：全フロアの同じ位置に分身を置く
  const makeConnector = (id: string, ct: ConnectorType) =>
    setDoc((d) => {
      const o = d.objects.find((x) => x.id === id);
      if (o?.kind !== "place" || isConnector(o)) return d;
      const c: ConnectorObject = {
        ...o,
        connector: ct,
        link: genId("l"),
        direction: "both",
        pin: false,
        title: o.title || connectorName(ct),
      };
      const twins = d.floors
        .filter((f) => f.id !== o.floor)
        .map((f) => twinOn(c, f));
      return {
        ...d,
        objects: [...d.objects.map((x) => (x.id === id ? c : x)), ...twins],
      };
    });
  // 階移動をやめて普通の四角/丸に戻す（他の階の分身は消す）
  const unmakeConnector = (c: ConnectorObject) =>
    setDoc((d) => ({
      ...d,
      objects: d.objects
        .filter((x) => !(isTwinOf(x, c.link) && x.id !== c.id))
        .map((x) =>
          x.id === c.id
            ? ({
                ...x,
                connector: undefined,
                link: undefined,
                direction: undefined,
              } as MapObject)
            : x,
        ),
    }));
  // --- 元に戻す／やり直し（⌘Z／⌘⇧Z）---
  // ドラッグは離した時点で1回、続けて打った文字などは 0.6 秒以内ならまとめて1回にする。階の切り替えは履歴に積まない。
  const [historyCount, setHistoryCount] = React.useState({
    past: 0,
    future: 0,
  }); // ボタンの有効/無効用
  const syncHistoryCount = () =>
    setHistoryCount({
      past: pastRef.current.length,
      future: futureRef.current.length,
    });
  const sameContent = (a: VenueMapDoc, b: VenueMapDoc) =>
    a.objects === b.objects &&
    a.floors === b.floors &&
    a.north === b.north &&
    a.scale === b.scale;
  const commitHistory = (current: VenueMapDoc, force = false) => {
    const prev = committedRef.current;
    committedRef.current = current;
    if (!prev || sameContent(prev, current)) return;
    const now = Date.now();
    if (force || now - lastChangeRef.current > 600) {
      pastRef.current = [...pastRef.current.slice(-99), prev];
    }
    lastChangeRef.current = force ? 0 : now;
    futureRef.current = [];
    syncHistoryCount();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 地図が変わったときだけ履歴に積む（commitHistory は毎回作り直す関数なので入れない）
  React.useEffect(() => {
    // 最初の表示：基準にするだけ（保存からの復元フラグはそのまま残す）
    if (committedRef.current === null) {
      committedRef.current = doc;
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      committedRef.current = doc;
      return;
    }
    if (dragRef.current) return; // ドラッグ中は離したときにまとめて記録
    commitHistory(doc);
  }, [doc]);
  const jumpHistory = (from: VenueMapDoc[], to: VenueMapDoc[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(doc);
    // 表示中の階はそのまま（無くなった階なら記録の階へ）
    const next = {
      ...target,
      activeFloorId: target.floors.some((f) => f.id === doc.activeFloorId)
        ? doc.activeFloorId
        : target.activeFloorId,
    };
    skipHistoryRef.current = true;
    lastChangeRef.current = 0;
    setDoc(next);
    setSelectedIds((ids) =>
      ids.filter((id) => next.objects.some((o) => o.id === id)),
    );
    setMenu(null);
    setGuides(null);
    syncHistoryCount();
  };
  const undo = () => jumpHistory(pastRef.current, futureRef.current);
  const redo = () => jumpHistory(futureRef.current, pastRef.current);

  // --- コピー／貼り付け（⌘C／⌘V／⌘X）---
  const copySelected = (ids: string[]) => {
    const set = new Set(ids);
    const items = doc.objects.filter((o) => set.has(o.id));
    if (items.length === 0) return;
    clipboardRef.current = structuredClone({
      items,
      twins: twinsOf(doc.objects, items),
    });
    pasteCountRef.current = new Map();
    setMenu(null);
  };
  // 選んだ項目を別の階の同じ位置へコピーする（階段・エレベーター等は、その階にまだ無ければ同じ組の分身を置く）
  const copyToFloor = (ids: string[], floorId: string) => {
    const target = doc.floors.find((f) => f.id === floorId);
    if (!target) return;
    const set = new Set(ids);
    const clones: MapObject[] = [];
    for (const o of doc.objects) {
      if (!set.has(o.id)) continue;
      if (isConnector(o)) {
        if (
          !doc.objects.some((x) => isTwinOf(x, o.link) && x.floor === floorId)
        )
          clones.push(twinOn(o, target));
        continue;
      }
      const c = structuredClone(o);
      c.id = genId(o.kind[0]);
      c.floor = floorId;
      clones.push(c);
    }
    setMenu(null);
    if (clones.length === 0) {
      setNotice(t("{floor}にはすでにあります", { floor: target.name }));
      return;
    }
    setDoc((d) => ({ ...d, objects: [...d.objects, ...clones] }));
    setNotice(
      t("{floor}にコピーしました（{n}件）", {
        floor: target.name,
        n: clones.length,
      }),
    );
  };
  const pasteClipboard = () => {
    const { items, twins } = clipboardRef.current;
    if (items.length === 0) return;
    const k = (pasteCountRef.current.get(doc.activeFloorId) ?? 0) + 1;
    pasteCountRef.current.set(doc.activeFloorId, k);
    // 同じ階に貼るときは少しずつずらす。別の階に貼るときは1回目は同じ位置、2回目からずらす
    const n = items[0].floor === doc.activeFloorId ? k : k - 1;
    const clones = cloneObjects(
      doc.floors,
      items,
      twins,
      doc.activeFloorId,
      24 * n,
    );
    setDoc((d) => ({ ...d, objects: [...d.objects, ...clones.all] }));
    setSelectedIds(clones.shown.map((c) => c.id));
    setMenu(null);
  };

  // つながる階を足す（同じ位置に分身を置く）／外す（その階の分身を消す）
  const toggleConnectorFloor = (
    c: ConnectorObject,
    floorId: string,
    on: boolean,
  ) =>
    setDoc((d) => {
      const has = d.objects.some(
        (o) => isTwinOf(o, c.link) && o.floor === floorId,
      );
      if (!on)
        return {
          ...d,
          objects: d.objects.filter(
            (o) => !(isTwinOf(o, c.link) && o.floor === floorId),
          ),
        };
      const f = d.floors.find((x) => x.id === floorId);
      return has || !f ? d : { ...d, objects: [...d.objects, twinOn(c, f)] };
    });

  // --- フロア操作 ---
  const goFloor = (id: string, d0: VenueMapDoc = doc) => {
    setDoc((d) => ({ ...d, activeFloorId: id }));
    setSelectedIds([]);
    setShowInfo(false);
    // 階ごとに中身の位置が違っても見えるよう、拡大率はそのままで中身を真ん中に寄せる
    fitView(d0, id, true);
  };
  const addFloor = () => {
    // いちばん上の「〇F」の次の番号にする（階の数から決めると、途中の階を消したあとで名前がかぶる）
    const top = Math.max(
      0,
      ...doc.floors.map((x) =>
        Number(/^(\d+)F$/i.exec(x.name.normalize("NFKC"))?.[1] ?? 0),
      ),
    );
    const f: Floor = {
      id: genId("f"),
      name: uniqueName(
        `${Math.max(top, doc.floors.length) + 1}F`,
        doc.floors.map((x) => x.name),
        (n) => `${Math.max(top, doc.floors.length) + n}F`,
      ),
    };
    setDoc((d) => {
      // 既存の階移動ポイント（link ごとに1つ）を新しい階の同じ位置にも置く
      const seen = new Set<string>();
      const twins: MapObject[] = [];
      for (const o of d.objects) {
        if (!isConnector(o) || seen.has(o.link)) continue;
        seen.add(o.link);
        twins.push(twinOn(o, f));
      }
      return {
        ...d,
        floors: [...d.floors, f],
        activeFloorId: f.id,
        objects: [...d.objects, ...twins],
      };
    });
    setSelectedIds([]);
  };
  const renameFloor = (id: string, name: string) =>
    setDoc((d) => ({
      ...d,
      floors: d.floors.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  // フロアを複製：上にある項目もまるごとコピーして、元の階のすぐ後ろ（右）に入れる。
  // 階段・エレベーター等は全フロア共通なので、同じ link の分身として置く（新しい階ともつながる）。
  const duplicateFloor = (id: string) => {
    const src = doc.floors.find((f) => f.id === id);
    if (!src) return;
    const used = doc.floors.map((f) => f.name);
    const copy: Floor = {
      ...src,
      id: genId("f"),
      name: uniqueName(t("{name}（コピー）", { name: src.name }), used, (n) =>
        t("{name}（コピー{n}）", { name: src.name, n }),
      ),
    };
    const clones: MapObject[] = doc.objects
      .filter((o) => o.floor === id)
      .map((o) => ({
        ...structuredClone(o),
        id: genId(isConnector(o) ? "c" : o.kind[0]),
        floor: copy.id,
      }));
    setDoc((d) => {
      const i = d.floors.findIndex((f) => f.id === id);
      const floors = [
        ...d.floors.slice(0, i + 1),
        copy,
        ...d.floors.slice(i + 1),
      ];
      return {
        ...d,
        floors,
        activeFloorId: copy.id,
        objects: [...d.objects, ...clones],
      };
    });
    setSelectedIds([]);
    setFloorMenu(null);
  };
  // フロアの順番を変える（to＝入れたい位置。並びはタブの左→右）
  const moveFloor = (id: string, to: number) => {
    setDoc((d) => {
      const from = d.floors.findIndex((f) => f.id === id);
      if (from < 0) return d;
      const floors = [...d.floors];
      const [f] = floors.splice(from, 1);
      floors.splice(
        Math.max(0, Math.min(floors.length, to > from ? to - 1 : to)),
        0,
        f,
      );
      return floors.every((x, i) => x === d.floors[i]) ? d : { ...d, floors };
    });
    setFloorMenu(null);
    // エスカレーターの上り・下りは「タブの右＝上の階」で決まるので、並びを変えたら向きが逆になることがある
    if (
      doc.objects.some(
        (o) =>
          isConnector(o) &&
          o.connector === "escalator" &&
          o.direction &&
          o.direction !== "both",
      )
    ) {
      setNotice(
        t(
          "階の並びを変えました。エスカレーターの上り・下りは並びで決まるので、向きを確かめてください",
        ),
      );
    }
  };
  const deleteFloor = async (id: string) => {
    setFloorMenu(null);
    if (doc.floors.length <= 1) return;
    const name = doc.floors.find((f) => f.id === id)?.name ?? "";
    if (
      !(await confirm(
        t("「{name}」と、その階の項目を削除します。よろしいですか？", { name }),
        { confirmLabel: t("削除する"), destructive: true },
      ))
    )
      return;
    setDoc((d) => {
      const floors = d.floors.filter((f) => f.id !== id);
      return dropDanglingStart({
        ...d,
        floors,
        activeFloorId: d.activeFloorId === id ? floors[0].id : d.activeFloorId,
        objects: d.objects.filter((o) => o.floor !== id),
      });
    });
    setSelectedIds([]);
  };

  // --- 書き出し・読み込み（グリッドは含まれない＝tolo-web には出ない） ---
  // ファイル名の日付は、この端末の日付（toISOString は世界標準時なので、日本の朝だと前の日になってしまう）
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  // 書き出すのは1つのマップ（VenueMapDoc）だけ。タブが2つ以上のときは、どれを書き出すか先に選んでもらう
  // tolo-web の案内マップの形（groups・groupId・pointId・言語ごとの名前）で書き出す。末尾の改行まで付け、整形チェックが通るようにする
  const exportDoc = (d: VenueMapDoc, name?: string) => {
    const out = toGuideMapLayout(dropDanglingStart(d));
    const blob = new Blob([`${JSON.stringify(out, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = name?.replace(/[\\/:*?"<>|\s]+/g, "_");
    a.download = `guide-map-layout-${safe ? `${safe}-` : ""}${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
  };
  // 書き出す前に、行けない場所などが無いかチェックする（問題が無ければそのまま書き出す）
  const handleExport = () => {
    if (pages.length <= 1) runCheck(activePageId, true);
    else setExportPicker(true);
  };
  const exportPage = (id: string) => {
    setExportPicker(false);
    runCheck(id, true);
  };
  const exportAnyway = () => {
    if (!check) return;
    const i = pages.findIndex((p) => p.id === check.pageId);
    if (i >= 0)
      exportDoc(
        check.pageId === activePageId ? doc : pages[i].doc,
        pages.length > 1 ? pageName(pages[i], i) : undefined,
      );
    setCheck(null);
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const f = detectFile(JSON.parse(await file.text()));
      if (f.kind === "graph") {
        // グラフ（tolo-web のグラフ編集の JSON）は、いまのタブの地図に結び付ける
        attachGraph(f.graph);
        return;
      }
      const d =
        f.kind === "guideMap"
          ? fromGuideMapLayout(f.layout, doc.graph)
          : normalizeDoc(f.doc);
      // いまのタブが空ならそこへ、何か描いてあれば新しいタブで開く（作りかけのマップは消さない）
      openDoc(linkFloorsByName(d), file.name.replace(/\.json$/i, ""));
    } catch {
      void notify(
        t(
          "ファイルを読み込めませんでした。この画面で書き出した案内マップか、グラフ（.json）を選んでください。",
        ),
      );
    }
  };
  // --- tolo-web のグラフとの結び付け ---
  // グラフのグループ（階）を、名前が同じ階に結び付ける（まだ結び付いていない階だけ）
  const linkFloorsByName = (
    d: VenueMapDoc,
    g: VenueGraph | undefined = d.graph,
  ): VenueMapDoc => {
    if (!g) return d;
    const norm = (v: string) =>
      v.normalize("NFKC").replace(/\s/g, "").toLowerCase();
    return {
      ...d,
      floors: d.floors.map((f) =>
        f.groupId
          ? f
          : {
              ...f,
              groupId: g.groups.find((x) =>
                Object.values(x.labels).some((l) => norm(l) === norm(f.name)),
              )?.id,
            },
      ),
    };
  };
  // グラフのファイルを読み込んで、いまのタブの地図に結び付ける
  const loadGraphFile = async (file: File) => {
    try {
      const f = detectFile(JSON.parse(await file.text()));
      if (f.kind !== "graph") throw new Error("not graph");
      attachGraph(f.graph);
    } catch {
      void notify(
        t(
          "グラフを読み込めませんでした。グラフ編集で作ったグラフ（.json）を選んでください。",
        ),
      );
    }
  };
  const attachGraph = (g: VenueGraph) => {
    // すでにグループに結び付いている階は、tolo-web と同じくグループの名前にそろえる（tolo-web の形で読み込んだ地図は、ここで階の名前が付く）
    const named = (d: VenueMapDoc): VenueMapDoc => ({
      ...d,
      floors: d.floors.map((f) => {
        const grp = g.groups.find((x) => x.id === f.groupId);
        return grp && labelOf(grp.labels)
          ? { ...f, name: labelOf(grp.labels) }
          : f;
      }),
    });
    setDoc((d) => linkFloorsByName(named({ ...d, graph: g }), g));
    setNotice(
      t("グラフを読み込みました（グループ {g}・ポイント {p}・ルート {r}）", {
        g: g.groups.length,
        p: g.points.length,
        r: g.routes.length,
      }),
    );
  };
  // 階をグラフのグループに結び付ける。tolo-web では階の名前にグループの名前が出るので、階の名前もそろえる
  const setFloorGroup = (floorId: string, groupId: string) =>
    setDoc((d) => ({
      ...d,
      floors: d.floors.map((f) => {
        if (f.id !== floorId) return f;
        const g = d.graph?.groups.find((x) => x.id === groupId);
        return {
          ...f,
          groupId: groupId || undefined,
          name: g ? labelOf(g.labels) || f.name : f.name,
        };
      }),
    }));

  // 編集 ⇄ プレビュー 切り替え（作業中の状態はリセット）
  const switchPreview = (on: boolean) => {
    if (phone) {
      if (on) fitPhone(doc);
      else leavePhone();
    }
    setPreview(on);
    setSelectedIds([]);
    setShowInfo(false);
    setDrawBox(null);
    setMarquee(null);
    setMenu(null);
    setTool("select");
    dragRef.current = null;
    setEditing(false);
  };
  // 見本はタブを増やさず、いまのタブの中身を置き換える（⌘Z で戻せる）
  // 見本の地図とグラフは、押したときに読み込む
  const loadSample = async () => {
    if (
      !isBlank(doc) &&
      !(await confirm(
        t(
          "見本の会場マップを読み込みます。いまのタブの内容は置き換わります。よろしいですか？",
        ),
        { confirmLabel: t("見本を読み込む") },
      ))
    )
      return;
    const d = await sampleVenueDoc(); // 見本は tolo-web のモックのグラフに結び付いている
    setDoc(d);
    resetWork();
    fitView(d);
  };

  // --- マップのタブ（エクセルのシートのように、別々のマップを並べて作れる） ---
  const pageName = (p: StudioPage, i: number) =>
    p.name || t("マップ{n}", { n: i + 1 });
  // 全部のタブ（表示中のタブは、いま編集している中身にする）
  const livePages = pages.map((p) =>
    p.id === activePageId ? { ...p, doc } : p,
  );
  // 名前の無いタブ（最初の「マップ1」など）は、並びの番号で名前を出している。
  // 並べ替え・削除・複製で番号がずれて名前が変わらないよう、その前にいまの名前で決めておく
  const withNames = (ps: StudioPage[]) =>
    ps.some((p) => !p.name)
      ? ps.map((p, i) => (p.name ? p : { ...p, name: pageName(p, i) }))
      : ps;
  const isBlank = (d: VenueMapDoc) =>
    d.objects.length === 0 && d.floors.length <= 1 && !d.floors[0]?.image;
  // 作業中の状態（選択・メニュー・道案内の選択など）を片付ける
  const resetWork = () => {
    setSelectedIds([]);
    setShowInfo(false);
    setDrawBox(null);
    setMarquee(null);
    setMenu(null);
    setFloorMenu(null);
    setGuides(null);
    setRouteGoal("");
    setPreviewCrowd({});
    dragRef.current = null;
    setEditing(false);
  };
  // タブを切り替える（list＝追加・削除したあとのタブ一覧）。表示中のマップは pages に書き戻し、履歴はタブごとに入れ替える
  const goPage = (id: string, list: StudioPage[] = pages) => {
    const base = list.map((p) => (p.id === activePageId ? { ...p, doc } : p));
    const target = base.find((p) => p.id === id);
    if (!target) return;
    setPages(base);
    setPageMenu(null);
    if (id === activePageId) return;
    pageHistoryRef.current.set(activePageId, {
      past: pastRef.current,
      future: futureRef.current,
    });
    const h = pageHistoryRef.current.get(id) ?? { past: [], future: [] };
    pastRef.current = h.past;
    futureRef.current = h.future;
    skipHistoryRef.current = true; // 切り替えは「元に戻す」の対象にしない
    lastChangeRef.current = 0;
    setActivePageId(id);
    setDoc(target.doc);
    resetWork();
    syncHistoryCount();
    fitView(target.doc);
  };
  // 「マップ3」のように、まだ使っていない番号の名前
  const nextPageName = () => {
    const used = new Set(pages.map((p, i) => pageName(p, i)));
    let n = pages.length + 1;
    while (used.has(t("マップ{n}", { n }))) n++;
    return t("マップ{n}", { n });
  };
  // 新しいマップ。kind＝"building"（建物：1F から階を増やしていく）／"venue"（会場：階の無い屋外などを1枚で作る）
  // どちらも書き出す形は同じで、「会場」は階が1つだけで名前が「会場」のマップ（tolo-web にはこの名前が出る）
  const newPage = (kind: "building" | "venue") => {
    setNewMapOpen(false);
    const id = genId("p");
    const d = emptyDoc();
    if (kind === "venue")
      d.floors = d.floors.map((f) => ({ ...f, name: t("会場") }));
    goPage(id, [...pages, { id, name: nextPageName(), doc: d }]);
  };
  // 見本・読み込んだファイルを開く。いまのタブが白紙ならそこへ入れ、何かあれば新しいタブにする
  const openDoc = (d: VenueMapDoc, name: string) => {
    if (isBlank(doc)) {
      setDoc(d); // 白紙からの置き換えは ⌘Z で戻せる
      resetWork();
      fitView(d);
      return;
    }
    const id = genId("p");
    const unique = uniqueName(
      name,
      pages.map((p, k) => pageName(p, k)),
      (n) => `${name} (${n})`,
    );
    goPage(id, [...pages, { id, name: unique, doc: d }]);
    setNotice(t("新しいタブ「{name}」で開きました", { name: unique }));
  };
  const duplicatePage = (id: string) => {
    const i = pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const src = id === activePageId ? doc : pages[i].doc;
    const used = pages.map((p, k) => pageName(p, k));
    const base0 = pageName(pages[i], i);
    const copy: StudioPage = {
      id: genId("p"),
      name: uniqueName(t("{name}（コピー）", { name: base0 }), used, (n) =>
        t("{name}（コピー{n}）", { name: base0, n }),
      ),
      doc: structuredClone(src),
    };
    const base = withNames(pages);
    goPage(copy.id, [...base.slice(0, i + 1), copy, ...base.slice(i + 1)]);
  };
  const renamePage = (id: string, name: string) =>
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
  const movePage = (id: string, to: number) => {
    setPages((ps) => {
      const from = ps.findIndex((p) => p.id === id);
      if (from < 0) return ps;
      const next = [...withNames(ps)];
      const [p] = next.splice(from, 1);
      next.splice(
        Math.max(0, Math.min(next.length, to > from ? to - 1 : to)),
        0,
        p,
      );
      return next.every((x, i) => x === ps[i]) ? ps : next;
    });
    setPageMenu(null);
  };
  const deletePage = (id: string) => {
    setPageMenu(null);
    if (pages.length <= 1) return;
    const i = pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const d = id === activePageId ? doc : pages[i].doc;
    // 確認は出さず、消したあと数秒だけ「元に戻す」を出す
    setDeletedPage({
      page: { ...pages[i], name: pageName(pages[i], i), doc: d },
      index: i,
      wasActive: id === activePageId,
    });
    const rest = withNames(pages).filter((p) => p.id !== id);
    pageHistoryRef.current.delete(id);
    if (id === activePageId) {
      // 消したタブの右（無ければ左）を表示する。消すタブの履歴は持ち越さない
      pastRef.current = [];
      futureRef.current = [];
      const target = rest[Math.min(i, rest.length - 1)];
      const nextId = target.id;
      const h = pageHistoryRef.current.get(nextId) ?? { past: [], future: [] };
      pastRef.current = h.past;
      futureRef.current = h.future;
      skipHistoryRef.current = true;
      lastChangeRef.current = 0;
      setPages(rest);
      setActivePageId(nextId);
      setDoc(target.doc);
      resetWork();
      syncHistoryCount();
      fitView(target.doc);
    } else setPages(rest);
  };
  // --- 名前で探す・その場所を表示する ---
  // 階を切り替えて選び、地図の真ん中に来るようにスクロールする
  const focusObject = (id: string, d0: VenueMapDoc = doc) => {
    const o = d0.objects.find((x) => x.id === id);
    if (!o) return;
    setDoc((d) =>
      d.activeFloorId === o.floor ? d : { ...d, activeFloorId: o.floor },
    );
    setSelectedIds([o.id]);
    setShowInfo(false);
    setMenu(null);
    const c =
      o.kind === "place" || o.kind === "text"
        ? { x: o.x, y: o.y }
        : centroidOf(o.points);
    window.requestAnimationFrame(() => {
      const sc = scrollerRef.current;
      if (!sc) return;
      sc.scrollTo({
        left: PAN_PAD + c.x * zoom - sc.clientWidth / 2,
        top: PAN_PAD + c.y * zoom - sc.clientHeight / 2,
        behavior: "smooth",
      });
    });
  };
  const norm = (v: string) => v.normalize("NFKC").toLowerCase();
  const searchHits = query.trim()
    ? doc.objects
        // 全角・半角、大文字・小文字の違いは気にせず探す（「５０５」も「505」で見つかる）
        .filter((o) => norm(o.title ?? "").includes(norm(query.trim())))
        // 階段などは全部の階に同じものがあるので、表示中の階の分を先に
        .sort(
          (a, b) =>
            Number(b.floor === doc.activeFloorId) -
            Number(a.floor === doc.activeFloorId),
        )
        .slice(0, 12)
    : [];

  // --- 書き出す前のチェック ---
  // 重い（道案内を全部の場所で試す）ので、「確認中」を出してから少し後で計算する
  const runCheck = (pageId: string, forExport: boolean) => {
    const i = pages.findIndex((p) => p.id === pageId);
    const d = pageId === activePageId ? doc : pages[i]?.doc;
    if (!d) return;
    setCheck({ pageId, issues: null, forExport });
    window.setTimeout(() => {
      const issues = checkVenueDoc(d, t("（無題）"));
      if (forExport && !issues.some((is) => is.level === "warn")) {
        // 「要確認」が無ければそのまま書き出す（「念のため」の項目は「チェック」ボタンで見られる）
        setCheck(null);
        exportDoc(d, pages.length > 1 ? pageName(pages[i], i) : undefined);
        return;
      }
      setCheck((c) => (c && c.pageId === pageId ? { ...c, issues } : c));
    }, 30);
  };
  // チェックの項目の文：何が問題か（title）・どうすればいいか（hint）・押すとどこへ移るか（go）
  const checkMessage = (
    is: CheckIssue,
  ): { title: string; hint: string; go: string } => {
    const v = is.vars ?? {};
    switch (is.kind) {
      case "unreachable":
        return {
          title: t("「{name}」（{floor}）へたどり着けません", v),
          hint: t(
            "現在地「{from}」から行ける道がありません。部屋・区画どうしのすき間が狭すぎないか、通路がふさがれていないか確かめてください。",
            v,
          ),
          go: t("その場所を表示"),
        };
      case "no-start":
        return {
          title: t("お客さんの現在地が決まっていません"),
          hint: t(
            "QR コードの場所が分からないとき、どこから案内を始めるかを「誘導」の「現在地」で選んでください。",
          ),
          go: t("「現在地」を開く"),
        };
      case "unnamed":
        return {
          title: t("名前のない目印があります（{floor}）", v),
          hint: t(
            "名前が無いと、お客さんが目的地として選べません。名前を入れるか、要らなければ消してください。",
          ),
          go: t("その目印を表示"),
        };
      case "connector-unlinked":
        return {
          title: t("「{name}」（{floor}）が、ほかの階とつながっていません", v),
          hint: t(
            "この階段・エレベーターでは別の階へ移れません。右の「つながる階」で、行き来できる階に印を付けてください。",
          ),
          go: t("その場所を表示"),
        };
      case "floor-isolated":
        return {
          title: t("{floor}へ行ける階段・エレベーターがありません", v),
          hint: t(
            "ほかの階からこの階へ案内できません。道具の「階段・EV」で置いてください。",
          ),
          go: t("その階を表示"),
        };
      case "overlap":
        return {
          title: t("「{a}」と「{b}」が重なっています（{floor}）", v),
          hint: t(
            "重なっていると、その間を通る道が作れません。少し離してください。",
          ),
          go: t("2つを選んで表示"),
        };
      case "empty-floor":
        return {
          title: t("{floor}には、まだ何も置かれていません", v),
          hint: t("使わない階なら、消してもかまいません。"),
          go: t("その階を表示"),
        };
      case "no-graph":
        return {
          title: t("混雑の情報と、まだつながっていません"),
          hint: t(
            "グラフ（グラフ編集で作ったもの）を読み込むと、混んでいる所を避けた案内を確かめられます。",
          ),
          go: t("「つなぎ」を開く"),
        };
      case "floor-no-group":
        return {
          title: t("{floor}が、グラフのどの階か決まっていません", v),
          hint: t(
            "決めないと、お客さんの画面でこの階が正しく出ません。「つなぎ」の「階」で選んでください。",
          ),
          go: t("「つなぎ」の階を開く"),
        };
      case "bad-point":
        return {
          title: t("「{name}」の結び付け先が、グラフに見つかりません", v),
          hint: t(
            "グラフが作り直された可能性があります。右の「くわしい設定」→「混雑とのつなぎ」で、ポイントを選び直してください。",
          ),
          go: t("その場所を表示"),
        };
      case "bad-route":
        return {
          title: t("「{name}」の結び付け先が、グラフに見つかりません", v),
          hint: t(
            "グラフが作り直された可能性があります。右の「くわしい設定」→「混雑とのつなぎ」で、ルートを選び直してください。",
          ),
          go: t("その場所を表示"),
        };
      case "unlinked-points":
        return {
          title: t("混雑の情報を受け取れない場所が{n}か所あります", v),
          hint: t(
            "グラフの「{names}」などが、地図のどれとも結び付いていないため、そこが混んでも避けて案内できません。",
            v,
          ),
          go: t("結び付いていない場所の一覧を開く"),
        };
      case "unlinked-routes":
        return {
          title: t("混雑の情報を受け取れない通路が{n}本あります", v),
          hint: t(
            "グラフの「{names}」などの通路が、地図と結び付いていません。廊下に沿って範囲を描き、「つなぎ」でルートに結び付けると、混んだときに避けられます。",
            v,
          ),
          go: t("結び付いていない通路の一覧を開く"),
        };
    }
  };
  // チェックの項目を押したら、そのタブ・階・場所を表示する
  const openIssue = (is: CheckIssue) => {
    if (!check) return;
    // 別のタブの項目なら、そのタブに切り替えてから、そのタブの地図で場所を探す
    const target =
      check.pageId === activePageId
        ? doc
        : pages.find((p) => p.id === check.pageId)?.doc;
    if (!target) return;
    if (check.pageId !== activePageId) goPage(check.pageId);
    setCheck(null);
    window.setTimeout(() => {
      switch (is.kind) {
        case "no-start":
          // 右の「誘導」の「現在地」を開いて、選べるようにする
          setSelectedIds([]);
          setSideOpen(true);
          setSideTab("guide");
          window.setTimeout(() => {
            const el = document.getElementById("route-start");
            el?.scrollIntoView({ block: "center", behavior: "smooth" });
            el?.focus();
          }, 80);
          return;
        case "no-graph":
          setLinkOpen(true);
          return;
        case "floor-no-group":
          if (is.floorId) goFloor(is.floorId, target);
          setLinkTab("floors");
          setLinkOpen(true);
          return;
        case "unlinked-points":
        case "unlinked-routes":
          setLinkTab(is.kind === "unlinked-points" ? "points" : "routes");
          setLinkUnlinkedOnly(true);
          setLinkOpen(true);
          return;
      }
      if (is.objectId) {
        setSideOpen(true);
        focusObject(is.objectId, target);
        // 重なっているものは、2つとも選ぶ
        if (is.otherId) setSelectedIds([is.objectId, is.otherId]);
        // 結び付け先の直しは「くわしい設定」の中なので開いておく
        if (is.kind === "bad-point" || is.kind === "bad-route")
          setAdvancedOpen(true);
      } else if (is.floorId) {
        setSelectedIds([]);
        goFloor(is.floorId, target);
        fitView(target, is.floorId);
      }
    }, 0);
  };

  // --- 画像（PNG）で保存・印刷 ---
  const svgLabels = { untitled: t("（無題）"), closedLabel: tg("closed") };
  // all=false：表示中の階だけ／all=true：全部の階を1枚ずつ（階ごとのファイル）
  const savePng = async (all: boolean) => {
    setShareMenu(false);
    const i = pages.findIndex((p) => p.id === activePageId);
    const name = pageName(pages[i], i);
    const targets = all
      ? doc.floors
      : doc.floors.filter((f) => f.id === doc.activeFloorId);
    try {
      for (const [k, f] of targets.entries()) {
        const { svg, width, height } = floorSvg(doc, f.id, {
          ...svgLabels,
          title: `${name}　${f.name}`,
        });
        const blob = await svgToPngBlob(svg, width, height, 2);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // 全部の階のときは、ファイル名の頭に階の順番を付けて並びやすくする
        a.download = `venue-map-${`${name}-${all ? `${String(k + 1).padStart(2, "0")}_` : ""}${f.name}`.replace(/[\\/:*?"<>|\s]+/g, "_")}.png`;
        a.click();
        URL.revokeObjectURL(url);
        // 続けてダウンロードすると取りこぼすブラウザがあるので、少し間をあける
        if (k < targets.length - 1)
          await new Promise((r) => window.setTimeout(r, 400));
      }
      setNotice(
        all
          ? t("全部の階（{n}枚）を画像で保存しました", { n: targets.length })
          : t("{floor}を画像で保存しました", { floor: targets[0]?.name ?? "" }),
      );
    } catch {
      void notify(
        t("画像を作れませんでした。地図が大きすぎる可能性があります。"),
      );
    }
  };
  // 全部の階を1ページずつ印刷する（印刷画面で「PDF に保存」も選べる）
  const printFloors = () => {
    const i = pages.findIndex((p) => p.id === activePageId);
    const name = pageName(pages[i], i);
    const parts = doc.floors.map(
      (f) =>
        floorSvg(doc, f.id, { ...svgLabels, title: `${name}　${f.name}` }).svg,
    );
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const w = frame.contentWindow;
    if (!w) return;
    w.document.open();
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${name.replace(/</g, "&lt;")}</title><style>@page{margin:12mm}body{margin:0}section{break-after:page;display:flex;align-items:center;justify-content:center;height:100vh}section:last-child{break-after:auto}svg{max-width:100%;max-height:100%;width:auto;height:auto}</style></head><body>${parts.map((p) => `<section>${p}</section>`).join("")}</body></html>`,
    );
    w.document.close();
    window.setTimeout(() => {
      w.focus();
      w.print();
      window.setTimeout(() => frame.remove(), 1000);
    }, 200);
  };

  // スマホの表示をやめたら、元の拡大率に戻す
  const leavePhone = () => {
    if (phoneZoomRef.current !== null) setZoom(phoneZoomRef.current);
    phoneZoomRef.current = null;
  };
  const switchPhone = (on: boolean) => {
    setPhone(on);
    if (on) fitPhone(doc);
    else leavePhone();
  };

  // --- 保存ポイント（好きなときに、いまの地図を名前を付けて残し、あとでその状態に戻せる）---
  // 保存ポイントはタブごと（どのイベントのタブかも含めて分ける）
  const snapshotKey = `${eventId}:${activePageId}`;
  // 一覧を開く・読み直す
  const refreshHistory = async () => {
    const all = await listSnapshots(snapshotKey).catch(() => [] as Snapshot[]);
    setHistoryList(all.map((x) => ({ ...x, doc: normalizeDoc(x.doc) })));
  };
  const openHistory = async () => {
    setHistoryNow(Date.now());
    setHistoryList("loading");
    await refreshHistory();
  };
  // いまの状態を保存ポイントにする（⌘S でも）
  // できたら true（名前の欄を空にするのに使う）
  const saveManualSnapshot = async (
    label: string,
    quiet = false,
  ): Promise<boolean> => {
    const i = pages.findIndex((p) => p.id === activePageId);
    const at = nowMs();
    try {
      await addSnapshot({
        pageId: snapshotKey,
        pageName: i >= 0 ? pageName(pages[i], i) : "",
        at,
        doc,
        label: label.trim(),
      });
    } catch {
      void notify(t("保存ポイントを作れませんでした。"));
      return false;
    }
    if (!quiet)
      setNotice(
        label.trim()
          ? t("保存ポイント「{name}」を作りました", { name: label.trim() })
          : t(
              "保存ポイントを作りました（名前は「保存ポイント」の一覧で付けられます）",
            ),
      );
    if (historyList) {
      setHistoryNow(nowMs());
      await refreshHistory();
    }
    return true;
  };
  // 保存ポイントの名前を変える（⌘S で名前なしのまま作ったものにも、あとから付けられる）
  const renameSnapshotTo = async (id: number, label: string) => {
    await renameSnapshot(id, label).catch(
      () => void notify(t("名前を変えられませんでした。")),
    );
    await refreshHistory();
  };
  const removeSnapshot = async (id: number) => {
    await deleteSnapshot(id).catch(() => {});
    await refreshHistory();
  };
  // 保存ポイントの状態に戻す（⌘Z で取り消せる）。saveFirst＝戻す前に、いまの地図も保存ポイントにしておく
  const restoreSnapshot = async (snap: Snapshot, saveFirst: boolean) => {
    if (saveFirst)
      await saveManualSnapshot(
        t("「{name}」に戻す前", { name: snap.label || snapshotClock(snap.at) }),
        true,
      );
    const d = {
      ...snap.doc,
      activeFloorId: snap.doc.floors.some((f) => f.id === doc.activeFloorId)
        ? doc.activeFloorId
        : snap.doc.activeFloorId,
    };
    lastChangeRef.current = 0;
    setDoc(d);
    resetWork();
    fitView(d);
    setHistoryList(null);
    setNotice(
      t("{time}の状態に戻しました（⌘Z で取り消せます）", {
        time: snap.label || snapshotClock(snap.at),
      }),
    );
  };
  const openSnapshotInTab = (snap: Snapshot) => {
    const id = genId("p");
    const i = pages.findIndex((p) => p.id === activePageId);
    setHistoryList(null);
    goPage(id, [
      ...pages,
      {
        id,
        name: t("{name}（{time}）", {
          name: pageName(pages[i], i),
          time: snap.label || snapshotClock(snap.at),
        }),
        doc: structuredClone(snap.doc),
      },
    ]);
  };

  // 消したタブを元の位置に戻す
  const restorePage = () => {
    if (!deletedPage) return;
    const { page, index, wasActive } = deletedPage;
    setDeletedPage(null);
    const base = withNames(pages);
    const list = [...base.slice(0, index), page, ...base.slice(index)];
    if (wasActive) goPage(page.id, list);
    else setPages(list);
  };

  // --- 当たり判定（hitTest.ts）。いま表示している階の物から探す ---
  const hitTest = (p: Pt, areaInterior = false) =>
    hitTestObjects(objects, p, zoom, areaInterior);

  // --- ポインタ操作 ---
  const onWorldDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    // ⌘ or Space を押しながら（または中ボタン）＝掴んで地図を移動。どの道具を選んでいても優先する
    if (!preview && (spaceDown || metaDown || e.metaKey || e.button === 1)) {
      setMenu(null);
      const sc = scrollerRef.current;
      if (sc) {
        dragRef.current = {
          kind: "pan",
          cx: e.clientX,
          cy: e.clientY,
          sl: sc.scrollLeft,
          st: sc.scrollTop,
          moved: false,
        };
        worldRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
    // プレビュー：ドラッグ＝地図移動、動かさずに離したら「タップ」として説明を表示（onUp で処理）
    if (preview) {
      setMenu(null);
      const sc = scrollerRef.current;
      if (sc) {
        dragRef.current = {
          kind: "pan",
          cx: e.clientX,
          cy: e.clientY,
          sl: sc.scrollLeft,
          st: sc.scrollTop,
          moved: false,
          tap: hitTest(rawPoint(e), true),
        };
        worldRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
    const p = worldPoint(e);
    if (tool === "rect" || tool === "circle" || tool === "area") {
      dragRef.current = { kind: "draw", shape: tool, start: p, cur: p };
      setDrawBox({ x: p.x, y: p.y, w: 0, h: 0 });
      worldRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "pin") {
      const o: PlaceObject = {
        id: genId("p"),
        kind: "place",
        floor: doc.activeFloorId,
        color,
        x: p.x,
        y: p.y,
        shape: "pin",
        w: 120,
        h: 48,
        title: t("新しい場所"),
      };
      addObject(o);
      select(o.id);
      setTool("select");
      return;
    }
    if (tool === "connector") {
      const o: ConnectorObject = {
        id: genId("c"),
        kind: "place",
        floor: doc.activeFloorId,
        color,
        x: p.x,
        y: p.y,
        shape: "pin",
        w: 120,
        h: 48,
        title: connectorName(connectorType),
        connector: connectorType,
        link: genId("l"),
        direction: "both",
      };
      // 階段・エスカレーター・エレベーターは、どの階でも同じ位置にある → 全フロアに分身を置く
      const targets = doc.floors.filter((f) => f.id !== doc.activeFloorId);
      setDoc((d) => ({
        ...d,
        objects: [...d.objects, o, ...targets.map((f) => twinOn(o, f))],
      }));
      select(o.id);
      setTool("select");
      return;
    }
    if (tool === "text") {
      const o: TextObject = {
        id: genId("t"),
        kind: "text",
        floor: doc.activeFloorId,
        color,
        x: p.x,
        y: p.y,
        size: 18,
        title: t("テキスト"),
      };
      addObject(o);
      select(o.id);
      setTool("select");
      return;
    }
    // select ツール
    setMenu(null);
    const rawHit = hitTest(rawPoint(e));
    // 固定したものは掴まない（その上からの範囲選択はできる。クリックだけなら選んで設定を出す）
    const hit = rawHit && !lockedIds.has(rawHit) ? rawHit : null;
    if (hit) {
      let ids: string[];
      if (e.shiftKey) {
        // Shift＋クリック：選択に足す（もう選ばれていれば外す）。足したものはそのまま一緒にドラッグできる
        if (selectedIds.includes(hit)) {
          setSelectedIds(selectedIds.filter((x) => x !== hit));
          return;
        }
        ids = [...selectedIds, hit];
        setSelectedIds(ids);
      } else {
        // すでに複数選択に含まれていればまとめて移動、違えば単独選択
        ids =
          selectedIds.includes(hit) && selectedIds.length > 1
            ? selectedIds
            : [hit];
        if (ids.length === 1) setSelectedIds([hit]);
      }
      setShowInfo(false); // 編集中は情報カードを自動で出さない（プレビューでタップすると表示）
      const origins: Record<string, MapObject> = {};
      for (const id of ids) {
        if (lockedIds.has(id)) continue;
        const obj = objects.find((x) => x.id === id);
        if (obj) origins[id] = structuredClone(obj);
      }
      // スマートガイド用：動かす項目まとめての外接矩形と、そろえる相手（同じ階のほかの四角・ピン・文字）
      const box = unionBox(Object.values(origins).map(boxOf));
      const others = objects
        .filter(
          (o) => !origins[o.id] && (o.kind === "place" || o.kind === "text"),
        )
        .map(boxOf);
      dragRef.current = {
        kind: "move",
        ids: Object.keys(origins),
        pressed: hit,
        additive: e.shiftKey,
        start: p,
        rawStart: rawPoint(e),
        origins,
        box,
        others,
        moved: false,
      };
      setEditing(true);
      worldRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    // 空白ドラッグ＝範囲選択（マーキー）。Shift を押していれば今の選択に足す
    const base = e.shiftKey ? selectedIds : [];
    if (!e.shiftKey) setSelectedIds([]);
    setShowInfo(false);
    dragRef.current = { kind: "marquee", start: p, raw: rawPoint(e), base };
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    worldRef.current?.setPointerCapture(e.pointerId);
  };

  // 右クリック＝コンテキストメニュー（対象が未選択ならそれを単独選択）
  const onWorldContextMenu = (e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    if (preview || tool !== "select") return;
    // 左クリックと同じく、範囲は内側を押しても選ぶ（上に重なる部屋などが先）
    const hit = hitTest(rawPoint(e), true);
    if (!hit) {
      setMenu(null);
      return;
    }
    if (!selectedIds.includes(hit)) setSelectedIds([hit]);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const onVertexDown = (e: React.PointerEvent, id: string, index: number) => {
    e.stopPropagation();
    select(id);
    const o = doc.objects.find((x) => x.id === id);
    const origin =
      o && (o.kind === "area" || o.kind === "route")
        ? o.points.map((pt) => ({ ...pt }))
        : [];
    dragRef.current = { kind: "vertex", id, index, origin };
    setEditing(true);
    worldRef.current?.setPointerCapture(e.pointerId);
  };
  const onResizeDown = (e: React.PointerEvent, id: string, corner: Corner) => {
    e.stopPropagation();
    const o = doc.objects.find((x) => x.id === id);
    if (o?.kind !== "place") return;
    select(id);
    // 大きさ・端をそろえる相手（同じ階のほかの四角・ピン・階移動マーク・文字）
    const others = objects
      .filter((x) => x.id !== id && (x.kind === "place" || x.kind === "text"))
      .map(boxOf);
    dragRef.current = {
      kind: "resize",
      id,
      corner,
      origin: structuredClone(o),
      others,
    };
    setEditing(true);
    worldRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (rulersOn)
      showCursor(
        e,
        d?.kind === "draw"
          ? {
              w: Math.abs(d.cur.x - d.start.x),
              h: Math.abs(d.cur.y - d.start.y),
            }
          : undefined,
      );
    if (!d) return;
    if (d.kind === "pan") {
      const sc = scrollerRef.current;
      if (!sc) return;
      sc.scrollLeft = d.sl - (e.clientX - d.cx) / viewScale;
      sc.scrollTop = d.st - (e.clientY - d.cy) / viewScale;
      if (Math.abs(e.clientX - d.cx) + Math.abs(e.clientY - d.cy) > 3)
        d.moved = true;
      return;
    }
    const p = worldPoint(e);
    if (d.kind === "draw") {
      d.cur = p;
      setDrawBox({
        x: Math.min(d.start.x, p.x),
        y: Math.min(d.start.y, p.y),
        w: Math.abs(p.x - d.start.x),
        h: Math.abs(p.y - d.start.y),
      });
      return;
    }
    if (d.kind === "vertex") {
      setDoc((doc0) => ({
        ...doc0,
        objects: doc0.objects.map((o) => {
          if (o.id !== d.id || (o.kind !== "route" && o.kind !== "area"))
            return o;
          if (o.kind !== "area" || d.origin.length < 3)
            return {
              ...o,
              points: o.points.map((pt, i) => (i === d.index ? p : pt)),
            } as MapObject;
          // エリアの角：その角につながる辺ごと動かす（縦の辺は左右へ、横の辺は上下へ）。四角なら四角のまま大きさが変わる
          const src = d.origin;
          const n = src.length;
          const me = src[d.index];
          const points = src.map((pt) => ({ ...pt }));
          points[d.index] = p;
          for (const nb of [(d.index - 1 + n) % n, (d.index + 1) % n]) {
            if (Math.abs(src[nb].x - me.x) < 0.5)
              points[nb] = { ...points[nb], x: p.x }; // 縦の辺
            else if (Math.abs(src[nb].y - me.y) < 0.5)
              points[nb] = { ...points[nb], y: p.y }; // 横の辺
          }
          return { ...o, points } as MapObject;
        }),
      }));
      return;
    }
    if (d.kind === "resize") {
      const o = d.origin;
      // ピン型の階移動マークは「マークの大きさ」を、四角/丸は本体の大きさを変える（どちらも縦長・横長OK）
      const isMark = o.shape === "pin";
      const box = isMark ? markBoxOf(o) : { w: o.w, h: o.h };
      const min = isMark ? MARKER_SIZE_MIN : GRID_SNAP;
      const fixed = {
        x:
          d.corner === "nw" || d.corner === "sw"
            ? o.x + box.w / 2
            : o.x - box.w / 2,
        y:
          d.corner === "nw" || d.corner === "ne"
            ? o.y + box.h / 2
            : o.y - box.h / 2,
      };
      // ほかの項目の端・中央や、同じ幅／高さに吸着（Option/Alt を押している間は吸着せずグリッドだけ）
      const res = snapResize(
        fixed,
        rawPoint(e),
        e.altKey ? [] : d.others,
        10 / zoom,
        isMark ? (v) => Math.round(v / 4) * 4 : snap,
      );
      setGuides(
        res.lines.length || res.gaps.length
          ? { lines: res.lines, gaps: res.gaps }
          : null,
      );
      const q = { x: res.x, y: res.y };
      const w = Math.min(
        isMark ? MARKER_SIZE_MAX : Infinity,
        Math.max(min, Math.abs(q.x - fixed.x)),
      );
      const h = Math.min(
        isMark ? MARKER_SIZE_MAX : Infinity,
        Math.max(min, Math.abs(q.y - fixed.y)),
      );
      const cx = fixed.x + (q.x >= fixed.x ? w / 2 : -w / 2);
      const cy = fixed.y + (q.y >= fixed.y ? h / 2 : -h / 2);
      const patch = isMark
        ? { x: cx, y: cy, markW: w, markH: h }
        : { x: cx, y: cy, w, h };
      setDoc((doc0) => ({
        ...doc0,
        objects: syncLinkedPositions(
          doc0.objects.map((x) =>
            x.id === d.id ? ({ ...x, ...patch } as MapObject) : x,
          ),
          new Set([d.id]),
        ),
      }));
      return;
    }
    if (d.kind === "marquee") {
      setMarquee({ x0: d.start.x, y0: d.start.y, x1: p.x, y1: p.y });
      return;
    }
    if (d.kind === "move") {
      const raw = rawPoint(e);
      if (
        !d.moved &&
        Math.hypot(raw.x - d.rawStart.x, raw.y - d.rawStart.y) < 3
      )
        return;
      d.moved = true;
      // ほかの項目の端・中央や、等しいすき間に吸着（Option/Alt を押している間は吸着せずグリッドだけ）
      const snapped = smartSnap(
        d.box,
        e.altKey ? [] : d.others,
        raw.x - d.rawStart.x,
        raw.y - d.rawStart.y,
        10 / zoom,
        GRID_SNAP,
      );
      const { dx, dy } = snapped;
      setGuides(
        snapped.lines.length || snapped.gaps.length
          ? { lines: snapped.lines, gaps: snapped.gaps }
          : null,
      );
      const origins = d.origins;
      setDoc((doc0) => ({
        ...doc0,
        objects: syncLinkedPositions(
          doc0.objects.map((o) => {
            const base = origins[o.id];
            if (!base) return o;
            if (base.kind === "place" || base.kind === "text")
              return { ...o, x: base.x + dx, y: base.y + dy } as MapObject;
            return {
              ...o,
              points: base.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            } as MapObject;
          }),
          new Set(d.ids),
        ),
      }));
    }
  };

  // マーキー矩形に“触れた”項目を選ぶ（囲まなくても重なれば選択）
  const marqueeHits = (box: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }): string[] => {
    const mx0 = Math.min(box.x0, box.x1);
    const mx1 = Math.max(box.x0, box.x1);
    const my0 = Math.min(box.y0, box.y1);
    const my1 = Math.max(box.y0, box.y1);
    const overlaps = (bx0: number, by0: number, bx1: number, by1: number) =>
      !(bx1 < mx0 || bx0 > mx1 || by1 < my0 || by0 > my1);
    const ids: string[] = [];
    for (const o of objects) {
      if (o.locked) continue; // 固定したものは範囲選択に入れない
      if (o.kind === "place") {
        if (o.shape === "pin" && isConnector(o)) {
          const { w, h } = markBoxOf(o);
          if (overlaps(o.x - w / 2, o.y - h / 2, o.x + w / 2, o.y + h / 2))
            ids.push(o.id);
        } else if (o.shape === "pin") {
          if (overlaps(o.x - 10, o.y - 34, o.x + 10, o.y + 10)) ids.push(o.id);
        } else if (
          overlaps(o.x - o.w / 2, o.y - o.h / 2, o.x + o.w / 2, o.y + o.h / 2)
        )
          ids.push(o.id);
      } else if (o.kind === "text") {
        if (overlaps(o.x - 50, o.y - o.size, o.x + 50, o.y + o.size))
          ids.push(o.id);
      } else {
        // ゾーンは背景なので「枠ごと囲んだ時だけ」選ぶ（中で囲んだだけで大きなゾーンが選ばれないように）
        const b = bboxOf(o.points);
        if (b.x >= mx0 && b.x + b.w <= mx1 && b.y >= my0 && b.y + b.h <= my1)
          ids.push(o.id);
      }
    }
    return ids;
  };

  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    setGuides(null);
    // プレビューのタップ：説明がある項目だけ情報カードを出す（無ければ閉じる）
    if (preview && d?.kind === "pan" && !d.moved) {
      const o = d.tap ? objects.find((x) => x.id === d.tap) : undefined;
      if (o && hasInfo(o)) {
        setSelectedIds([o.id]);
        setShowInfo(true);
      } else {
        setSelectedIds([]);
        setShowInfo(false);
      }
    }
    if (d?.kind === "draw" && d.shape === "area") {
      // 範囲選択と同じくドラッグした矩形をエリアにする（クリックだけなら作らない）
      const box = drawBox;
      if (box && box.w >= GRID_SNAP && box.h >= GRID_SNAP) {
        const { x, y, w, h } = box;
        const o: AreaObject = {
          id: genId("a"),
          kind: "area",
          floor: doc.activeFloorId,
          color,
          points: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ],
          title: t("エリア"),
        };
        addObject(o);
        setSelectedIds([o.id]);
        setShowInfo(false);
      }
      setDrawBox(null);
      setTool("select");
    } else if (d?.kind === "draw" && d.shape !== "area") {
      const box = drawBox;
      // ドラッグが小さい（＝クリック）ときは既定サイズ
      const w = box && box.w >= GRID_SNAP ? box.w : 200;
      const h = box && box.h >= GRID_SNAP ? box.h : 120;
      const cx = box && box.w >= GRID_SNAP ? box.x + box.w / 2 : d.start.x;
      const cy = box && box.h >= GRID_SNAP ? box.y + box.h / 2 : d.start.y;
      const o: PlaceObject = {
        id: genId("s"),
        kind: "place",
        floor: doc.activeFloorId,
        color,
        x: snap(cx),
        y: snap(cy),
        shape: d.shape,
        w: snap(w),
        h: snap(h),
        title: "",
        pin: true,
      }; // 描いた部屋・区画には真ん中に目印を付ける（道案内の出発・目的地に選べるように。右の設定で外せる）
      addObject(o);
      setSelectedIds([o.id]);
      setShowInfo(false);
      setDrawBox(null);
      setTool("select");
    }
    if (d?.kind === "marquee" && marquee) {
      const end = rawPoint(e);
      if (Math.hypot(end.x - d.raw.x, end.y - d.raw.y) < 4 / zoom) {
        // ドラッグせずにクリックしただけ → エリアの内側ならそのエリアを選ぶ（Shift なら足す／外す）
        const hit = hitTest(d.raw, true);
        setSelectedIds(
          hit
            ? d.base.includes(hit)
              ? d.base.filter((x) => x !== hit)
              : [...d.base, hit]
            : d.base,
        );
      } else setSelectedIds([...new Set([...d.base, ...marqueeHits(marquee)])]);
      setMarquee(null);
    }
    // 複数選択中の1つを、動かさずにクリックしただけ → その1つだけを選び直す
    if (d?.kind === "move" && !d.moved && !d.additive && d.ids.length > 1)
      setSelectedIds([d.pressed]);
    if (dragRef.current) worldRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setEditing(false);
    if (d && (d.kind === "move" || d.kind === "resize" || d.kind === "vertex"))
      commitHistory(doc, true);
  };

  // --- ズーム ---
  const zoomBy = (factor: number) => setZoom((z) => clampZoom(z * factor));

  // --- 画面だけの設定（全体図・定規）を、このブラウザに覚えておく ---
  React.useEffect(() => {
    try {
      const v = JSON.parse(
        window.localStorage.getItem(VIEW_PREFS_KEY) || "{}",
      ) as {
        showMini?: boolean;
        rulers?: boolean;
        advanced?: boolean;
        side?: boolean;
      };
      if (typeof v.showMini === "boolean") setShowMini(v.showMini);
      if (typeof v.rulers === "boolean") setShowRulers(v.rulers);
      if (typeof v.advanced === "boolean") setAdvancedOpen(v.advanced);
      if (typeof v.side === "boolean") setSideOpen(v.side);
    } catch {
      // 読めなければ、はじめの表示のまま
    }
  }, []);
  const saveViewPrefs = (next: {
    showMini?: boolean;
    rulers?: boolean;
    advanced?: boolean;
    side?: boolean;
  }) => {
    try {
      window.localStorage.setItem(
        VIEW_PREFS_KEY,
        JSON.stringify({
          showMini,
          rulers: showRulers,
          advanced: advancedOpen,
          side: sideOpen,
          ...next,
        }),
      );
    } catch {
      // 覚えられなくても切り替えはできる
    }
  };
  // 地図の物を選んだら、右の設定を「設定」のタブにする（誘導のタブを見ていても、選んだ物の設定がすぐ出るように）
  const selectedCount = selectedIds.length;
  React.useEffect(() => {
    if (selectedCount > 0) setSideTab("settings");
  }, [selectedCount]);
  // 右の設定を出す・しまう（地図を広く使いたいとき）
  const toggleSide = (open: boolean = !sideOpen) => {
    setSideOpen(open);
    saveViewPrefs({ side: open });
  };

  // --- 定規（座標）---
  // マウスを動かすたびに画面全体を描き直すと重いので、目印と数字は直接書き換える
  const rulersOn = showRulers && !preview;
  const rulerXRef = React.useRef<HTMLDivElement>(null);
  const rulerYRef = React.useRef<HTMLDivElement>(null);
  const coordRef = React.useRef<HTMLSpanElement>(null);
  const showCursor = (
    e: { clientX: number; clientY: number } | null,
    size?: { w: number; h: number },
  ) => {
    const sc = scrollerRef.current;
    const xm = rulerXRef.current;
    const ym = rulerYRef.current;
    const label = coordRef.current;
    if (!sc || !xm || !ym || !label || !worldRef.current) return;
    if (!e) {
      xm.style.opacity = "0";
      ym.style.opacity = "0";
      label.textContent = "";
      return;
    }
    const r = sc.getBoundingClientRect();
    const p = rawPoint(e);
    xm.style.opacity = "1";
    ym.style.opacity = "1";
    xm.style.transform = `translateX(${e.clientX - r.left}px)`;
    ym.style.transform = `translateY(${e.clientY - r.top}px)`;
    label.textContent = size
      ? `W ${Math.round(size.w)}  H ${Math.round(size.h)}`
      : `X ${Math.round(p.x)}  Y ${Math.round(p.y)}`;
  };

  // 見えている範囲を覚える（スクロール・拡大・大きさが変わったとき）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 拡大率が変わったら、見えている範囲を読み直す（中では zoom を読まない）
  React.useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let raf = 0;
    const read = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setView({
          sl: sc.scrollLeft,
          st: sc.scrollTop,
          cw: sc.clientWidth,
          ch: sc.clientHeight,
        }),
      );
    };
    read();
    sc.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(sc);
    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, [zoom]);
  React.useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onWheel = (ev: WheelEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      // 1イベントあたりの変化量を deltaY に比例させて小さく抑える（トラックパッドで暴れないように）
      const delta = Math.max(
        -WHEEL_DELTA_MAX,
        Math.min(WHEEL_DELTA_MAX, ev.deltaY),
      );
      setZoom((z) => clampZoom(z * Math.exp(-delta * WHEEL_ZOOM_SPEED)));
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => sc.removeEventListener("wheel", onWheel);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        // 右の設定で名前などを入力中でも、Esc で入力を終えて選択を外せる
        if (
          e.key === "Escape" &&
          el.closest("aside") &&
          selectedIds.length > 0
        ) {
          el.blur();
          setSelectedIds([]);
          setShowInfo(false);
          setMenu(null);
        }
        return;
      }
      if (
        helpOpen ||
        confirmOpen ||
        exportPicker ||
        check ||
        compare ||
        historyList ||
        listOpen ||
        newMapOpen ||
        linkOpen
      )
        return; // 使い方（Q&A）や書き出す選択などを開いている間は地図を操作しない
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        // ⌘S＝いまの状態を保存ポイントにする（ブラウザの「ページを保存」は出さない）
        e.preventDefault();
        void saveManualSnapshot("");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        // ⌘F＝名前で探す
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      // プレビュー中は編集キーを無効化（Esc で情報カードを閉じるだけ）
      if (preview) {
        if (e.key === "Escape") {
          setShowInfo(false);
          setSelectedIds([]);
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && (k === "z" || k === "y")) {
        e.preventDefault();
        if (k === "y" || e.shiftKey) redo();
        else undo();
      } else if (mod && k === "c") {
        if (selectedIds.length) {
          e.preventDefault();
          copySelected(selectedIds);
        }
      } else if (mod && k === "x") {
        if (selectedIds.length) {
          e.preventDefault();
          copySelected(selectedIds);
          deleteSelected(selectedIds);
        }
      } else if (mod && k === "v") {
        e.preventDefault();
        pasteClipboard();
      } else if (mod && k === "d") {
        e.preventDefault(); // ブラウザのブックマーク追加を止める
        if (selectedIds.length) duplicateSelected(selectedIds);
      } else if (mod && k === "a") {
        e.preventDefault();
        setSelectedIds(objects.filter((o) => !o.locked).map((o) => o.id));
      } else if (!mod && e.key === "\\") {
        // \ キーで右の設定を出す・しまう
        toggleSide();
      } else if (
        !mod &&
        !e.altKey &&
        TOOLS.some((x) => x.shortcut.toLowerCase() === k)
      ) {
        // 1文字のキーで道具を選ぶ（V＝選択、R＝部屋・区画、A＝範囲 など）
        const next = TOOLS.find((x) => x.shortcut.toLowerCase() === k);
        if (next) setTool(next.key);
      } else if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      } else if (e.key === "Escape") {
        setDrawBox(null);
        setSelectedIds([]);
        setMenu(null);
        setTool("select");
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        deleteSelected(selectedIds);
      } else if (
        selectedIds.length > 0 &&
        (e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const step = (e.shiftKey ? 2 : 1) * GRID_SNAP;
        nudgeSelected(
          selectedIds,
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // 選択中に、キャンバスの外の「何もない所」を触ったら選択を外す。
  // ボタン・入力欄・右の設定パネル・メニューは選択中の項目を操作するので外さない。
  React.useEffect(() => {
    if (selectedIds.length === 0) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (
        !t ||
        t.closest(
          "[data-keep-selection], button, input, select, textarea, label, a",
        )
      )
        return;
      setSelectedIds([]);
      setShowInfo(false);
      setMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selectedIds.length]);

  React.useEffect(() => {
    if (!exportDone) return;
    const t = window.setTimeout(() => setExportDone(false), 1500);
    return () => window.clearTimeout(t);
  }, [exportDone]);
  React.useEffect(() => {
    if (!deletedPage) return;
    const timer = window.setTimeout(() => setDeletedPage(null), 8000);
    return () => window.clearTimeout(timer);
  }, [deletedPage]);
  React.useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ⌘ の押下状態（入力欄にフォーカスがあっても・プレビュー中も追う）
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Meta") setMetaDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Meta" || !e.metaKey) setMetaDown(false);
    };
    // ⌘+Tab などでウィンドウを離れると keyup が来ないので、離れた時点で解除する
    const reset = () => {
      setMetaDown(false);
      setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);
  const worldCursor =
    preview || spaceDown || metaDown
      ? "cursor-grab active:cursor-grabbing"
      : tool === "select"
        ? "cursor-default"
        : "cursor-crosshair";
  // リサイズできる矩形：四角/丸はその大きさ、ピン型の階移動マークはマークの大きさ
  const resizable =
    !preview &&
    selected &&
    !selected.locked &&
    selected.kind === "place" &&
    (selected.shape !== "pin" || isConnector(selected))
      ? {
          id: selected.id,
          x: selected.x,
          y: selected.y,
          ...(selected.shape === "pin"
            ? markBoxOf(selected)
            : { w: selected.w, h: selected.h }),
        }
      : null;

  return (
    <div className="guide-map-studio flex h-full min-h-[560px] flex-col overflow-hidden bg-muted">
      {confirmDialog}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 上の帯（1段目）：（ページから渡された見出しなど）・マップのタブ・ファイルの操作・確かめる・書き出す・（言語やテーマなど） */}
        <header className="z-30 flex h-14 shrink-0 border-b bg-card">
          <div className="mx-auto flex w-full max-w-[1760px] min-w-0 items-center gap-2.5 px-4">
            {leading && (
              <>
                <div className="flex shrink-0 items-center gap-2">
                  {leading}
                </div>
                <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
              </>
            )}
            {/* マップのタブ（エクセルのシートのように、別々のマップを切り替える） */}
            <div
              role="tablist"
              aria-label={t("マップのタブ")}
              className="studio-thin-scroll flex min-w-0 items-center gap-1 overflow-x-auto"
            >
              {pages.map((p, i) =>
                editingPage === p.id ? (
                  <FloorNameInput
                    key={p.id}
                    name={pageName(p, i)}
                    label={t("マップ名")}
                    maxLength={30}
                    autoFocus
                    onCommit={(name) => renamePage(p.id, name)}
                    onDone={() => setEditingPage(null)}
                    className="h-8 w-36 shrink-0 rounded-md border-2 border-primary bg-transparent px-3 text-xs font-medium"
                  />
                ) : (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={p.id === activePageId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", p.id);
                      e.dataTransfer.effectAllowed = "move";
                      setPageDrag({ id: p.id, to: null });
                    }}
                    onDragOver={(e) => {
                      if (!pageDrag) return;
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      const to = e.clientX < r.left + r.width / 2 ? i : i + 1;
                      if (pageDrag.to !== to) setPageDrag({ ...pageDrag, to });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (pageDrag && pageDrag.to !== null)
                        movePage(pageDrag.id, pageDrag.to);
                      setPageDrag(null);
                    }}
                    onDragEnd={() => setPageDrag(null)}
                    onClick={() => goPage(p.id)}
                    onDoubleClick={() => setEditingPage(p.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      goPage(p.id);
                      setPageMenu({ x: e.clientX, y: e.clientY, id: p.id });
                    }}
                    title={t(
                      "ドラッグで並べ替え／ダブルクリックで名前を変更／右クリックでメニュー",
                    )}
                    className={cn(
                      "relative flex h-8 max-w-44 shrink-0 items-center truncate rounded-md px-3 text-xs",
                      p.id === activePageId
                        ? "bg-accent font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent/60",
                      pageDrag?.id === p.id && "opacity-40",
                      pageDrag &&
                        pageDrag.to === i &&
                        "before:absolute before:top-0 before:-left-1 before:h-full before:w-0.5 before:rounded before:bg-primary",
                      pageDrag &&
                        pageDrag.to === i + 1 &&
                        i === pages.length - 1 &&
                        "after:absolute after:top-0 after:-right-1 after:h-full after:w-0.5 after:rounded after:bg-primary",
                    )}
                  >
                    <span className="truncate">{pageName(p, i)}</span>
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setNewMapOpen(true)}
                title={t("新しいマップのタブを追加")}
                aria-label={t("新しいマップのタブを追加")}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            <span className="flex-1" />
            {/* マップの出し入れ（作る・開く・残す）をひとまとめに。名前が折り返さないよう縮めない */}
            <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border p-0.5 text-xs font-medium whitespace-nowrap">
              <button
                type="button"
                onClick={() => setNewMapOpen(true)}
                aria-label={t("新規作成")}
                title={t(
                  "白紙のマップを新しいタブで作ります（いまのマップはそのまま残ります）",
                )}
                className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
              >
                <FilePlus className="size-4" />
                <span className="hidden min-[1360px]:inline">
                  {t("新規作成")}
                </span>
              </button>
              <button
                type="button"
                onClick={loadSample}
                aria-label={t("見本")}
                title={t("整列済みの見本会場マップを読み込む")}
                className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
              >
                <Sparkles className="size-4" />
                <span className="hidden min-[1360px]:inline">{t("見本")}</span>
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                aria-label={t("読み込む")}
                title={t("読み込む")}
                className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
              >
                <Upload className="size-4" />
                <span className="hidden min-[1360px]:inline">
                  {t("読み込む")}
                </span>
              </button>
              <button
                type="button"
                onClick={openHistory}
                title={t(
                  "いまの地図を保存ポイントにしたり、保存ポイントの状態に戻したりします（⌘S で保存）",
                )}
                aria-label={t("保存ポイント")}
                className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
              >
                <BookmarkPlus className="size-4" />
                <span className="hidden min-[1360px]:inline">
                  {t("保存ポイント")}
                </span>
              </button>
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
            {/* 確かめる・共有（つなぎ・一覧・チェック・見比べる・画像・印刷）を1つのメニューに */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShareMenu((v) => !v)}
                aria-expanded={shareMenu}
                aria-haspopup="menu"
                aria-label={t("確かめる・共有")}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap hover:bg-accent",
                  shareMenu && "bg-accent",
                )}
              >
                <ListChecks className="size-4" />
                <span className="hidden min-[1200px]:inline">
                  {t("確かめる・共有")}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
              {shareMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onPointerDown={() => setShareMenu(false)}
                  />
                  <div
                    role="menu"
                    className="studio-fade absolute top-full right-0 z-50 mt-1.5 w-72 rounded-lg border bg-card p-1.5 text-xs shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
                  >
                    {(
                      [
                        {
                          icon: Link2,
                          label: t("つなぎ"),
                          sub: t("グラフと地図を結び付ける"),
                          run: () => setLinkOpen(true),
                        },
                        {
                          icon: Table2,
                          label: t("一覧"),
                          sub: t("部屋・目印を表で見て、名前や色を直す"),
                          run: () => setListOpen(true),
                        },
                        {
                          icon: ListChecks,
                          label: t("チェック"),
                          sub: t("行けない場所などが無いか調べる"),
                          run: () => runCheck(activePageId, false),
                        },
                        {
                          icon: Columns2,
                          label: t("見比べる"),
                          sub:
                            pages.length < 2
                              ? t("タブが2つ以上あると使えます")
                              : t("2つのタブを並べて比べる"),
                          run: () =>
                            setCompare({
                              left: activePageId,
                              right:
                                pages.find((p) => p.id !== activePageId)?.id ??
                                activePageId,
                              floor: Math.max(
                                0,
                                doc.floors.findIndex(
                                  (f) => f.id === doc.activeFloorId,
                                ),
                              ),
                              floorName: floor?.name ?? "",
                            }),
                          disabled: pages.length < 2,
                        },
                        {
                          icon: ImageDown,
                          label: t("この階だけ（{floor}）", {
                            floor: floor?.name ?? "",
                          }),
                          sub: t("表示中の階を1枚の画像にします"),
                          run: () => void savePng(false),
                          group: t("画像で保存"),
                        },
                        {
                          icon: ImageDown,
                          label: t("全部の階（{n}枚）", {
                            n: doc.floors.length,
                          }),
                          sub: t("階ごとに1枚ずつ、続けて保存します"),
                          run: () => void savePng(true),
                        },
                        {
                          icon: Printer,
                          label: t("印刷"),
                          sub: t(
                            "全部の階を1ページずつ印刷します（PDF にも保存できます）",
                          ),
                          run: printFloors,
                          group: "",
                        },
                      ] as {
                        icon: React.ComponentType<{ className?: string }>;
                        label: string;
                        sub: string;
                        run: () => void;
                        disabled?: boolean;
                        group?: string;
                      }[]
                    ).map((m, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: メニューの項目は決まった並びで、並べ替えない
                      <React.Fragment key={i}>
                        {m.group !== undefined && (
                          <div className="my-1 border-t">
                            {m.group && (
                              <span className="block px-2.5 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                                {m.group}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={m.disabled}
                          onClick={() => {
                            setShareMenu(false);
                            m.run();
                          }}
                          className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent disabled:opacity-40"
                        >
                          <m.icon className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block font-medium">{m.label}</span>
                            <span className="block text-muted-foreground">
                              {m.sub}
                            </span>
                          </span>
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
            <StudioHelpButton onClick={() => setHelpOpen(true)} compact />
            <div className="flex items-center">
              <button
                type="button"
                onClick={undo}
                disabled={historyCount.past === 0}
                title={t("元に戻す（⌘Z）")}
                aria-label={t("元に戻す")}
                className="flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-35"
              >
                <Undo2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={historyCount.future === 0}
                title={t("やり直し（⌘⇧Z）")}
                aria-label={t("やり直し")}
                className="flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-35"
              >
                <Redo2 className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-8 min-w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium tracking-[0.04em] text-primary-foreground"
            >
              {exportDone ? (
                <>
                  {/* 細い線のチェックマークを描く（stroke-dashoffset） */}
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path
                      className="studio-check-draw"
                      d="M5 12.5l4.5 4.5L19 7.5"
                    />
                  </svg>
                  {t("完了")}
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  {t("書き出す")}
                </>
              )}
            </button>
            {trailing && (
              <div className="flex shrink-0 items-center gap-1.5">
                {trailing}
              </div>
            )}
          </div>
        </header>
        {saveFailed && (
          <div
            role="alert"
            className="flex shrink-0 flex-wrap items-center gap-3 border-b border-primary bg-card px-4 py-2 text-sm"
          >
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: GUIDE }}
            />
            <span className="min-w-0 flex-1">
              <b className="font-medium">
                {t("ブラウザに保存できませんでした。")}
              </b>
              {t(
                "保存できる量を超えています。このまま閉じると最後の変更が消えます。「書き出す」でファイルに保存するか、使っていないタブを減らしてください。",
              )}
            </span>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              <Download className="size-3.5" />
              {t("書き出す")}
            </button>
          </div>
        )}
        {/* 作業場：道具・地図・右の設定。画面いっぱいに広げるが、大きな画面では広がりすぎないよう最大幅を決める */}
        <div className="mx-auto flex min-h-0 w-full max-w-[1760px] flex-1 gap-3 p-3">
          {/* 道具の列（細め：アイコン＋小さな名前。使い方とキーはマウスを置くと出る） */}
          <nav
            aria-label={t("道具")}
            className={cn(
              "z-40 flex w-[68px] shrink-0 flex-col items-stretch gap-0.5 self-start rounded-xl border bg-card p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(0,0,0,0.25)]",
              preview && "pointer-events-none opacity-40",
            )}
          >
            {TOOLS.map(({ key, label, short, shortcut, desc, Icon }) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: マウスを置いた・フォーカスした道具の説明カードを出すだけ（操作は中のボタン）
              <div
                key={key}
                className="relative"
                onPointerEnter={(e) => openToolCard(key, e.currentTarget)}
                onPointerLeave={() => closeToolCard()}
                onFocus={(e) => openToolCard(key, e.currentTarget, true)}
                onBlur={() => closeToolCard()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTool(key);
                    closeToolCard(0);
                  }}
                  aria-pressed={tool === key}
                  aria-label={t(label)}
                  aria-keyshortcuts={shortcut}
                  aria-describedby={`tool-desc-${key}`}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-[10px] leading-none font-medium whitespace-nowrap",
                    tool === key
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="text-center">{t(short ?? label)}</span>
                </button>
                <span id={`tool-desc-${key}`} className="sr-only">
                  {t(desc)}
                </span>
              </div>
            ))}
            {/* 使い方のカード（マウスを置く・キーボードで移ると出る）。上に、その道具を使っている短い動画が流れる */}
            {toolCard &&
              (() => {
                const def = TOOLS.find((x) => x.key === toolCard.tool);
                if (!def) return null;
                return (
                  <ToolCard
                    ref={toolCardRef}
                    {...toolCard}
                    label={t(def.label)}
                    desc={t(def.desc)}
                    shortcut={def.shortcut}
                    Icon={def.Icon}
                  />
                );
              })()}
            <span className="mx-1.5 my-1 h-px bg-border" />
            {/* 色：いまの色の1つのボタン。押すと色を選べる */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setColorMenu((v) => !v)}
                aria-expanded={colorMenu}
                aria-haspopup="menu"
                title={t("色")}
                className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium hover:bg-accent"
              >
                <span
                  className="size-[18px] rounded-md border"
                  style={{ background: PALETTE[color].fill }}
                />
                {t("色")}
              </button>
              {colorMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onPointerDown={() => setColorMenu(false)}
                  />
                  <div
                    role="menu"
                    className="studio-fade absolute bottom-0 left-full z-50 ml-2 max-h-[80vh] w-max overflow-y-auto rounded-lg border bg-card p-2 text-xs shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
                  >
                    {selectedIds.length > 0 && (
                      <p className="mb-1.5 leading-relaxed text-muted-foreground">
                        {t("選んでいる物の色も変わります")}
                      </p>
                    )}
                    {PALETTE_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <p className="mb-1 font-medium text-muted-foreground">
                          {t(group.label)}
                        </p>
                        {/* 見出しごとに 1 行に並べる（折り返さない） */}
                        <div className="flex flex-nowrap gap-1.5">
                          {group.keys.map((k) => (
                            <ColorSwatch
                              key={k}
                              k={k}
                              role="menuitemradio"
                              aria-checked={color === k}
                              selected={color === k}
                              onClick={() => {
                                setColor(k);
                                if (selectedIds.length)
                                  colorSelected(selectedIds, k);
                                setColorMenu(false);
                              }}
                              className="size-8 shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(0,0,0,0.25)]">
            {/* 地図の上の帯（2段目）：階・グリッド・名前で探す・編集／プレビュー */}
            <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
              <div className="flex items-center gap-1">
                {doc.floors.map((f, i) =>
                  editingFloor === f.id ? (
                    <FloorNameInput
                      key={f.id}
                      name={f.name}
                      autoFocus
                      onCommit={(name) => renameFloor(f.id, name)}
                      onDone={() => setEditingFloor(null)}
                      className="h-7 w-24 rounded-md border-2 border-primary bg-transparent px-3 text-xs font-medium"
                    />
                  ) : (
                    <button
                      key={f.id}
                      type="button"
                      draggable={!preview}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", f.id);
                        e.dataTransfer.effectAllowed = "move";
                        setFloorDrag({ id: f.id, to: null });
                      }}
                      onDragOver={(e) => {
                        if (!floorDrag) return;
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        const to = e.clientX < r.left + r.width / 2 ? i : i + 1;
                        if (floorDrag.to !== to)
                          setFloorDrag({ ...floorDrag, to });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (floorDrag && floorDrag.to !== null)
                          moveFloor(floorDrag.id, floorDrag.to);
                        setFloorDrag(null);
                      }}
                      onDragEnd={() => setFloorDrag(null)}
                      onClick={() => goFloor(f.id)}
                      onDoubleClick={() => !preview && setEditingFloor(f.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (preview) return;
                        goFloor(f.id);
                        setFloorMenu({ x: e.clientX, y: e.clientY, id: f.id });
                      }}
                      title={
                        preview
                          ? undefined
                          : t(
                              "ドラッグで並べ替え／ダブルクリックで名前を変更／右クリックでメニュー",
                            )
                      }
                      className={cn(
                        "relative flex items-center gap-1 rounded-md border px-3 py-1 font-mono text-xs",
                        f.id === doc.activeFloorId
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent",
                        floorDrag?.id === f.id && "opacity-40",
                        // 入れる位置の目印（タブの左／右に縦線）
                        floorDrag &&
                          floorDrag.to === i &&
                          "before:absolute before:top-0 before:-left-1.5 before:h-full before:w-0.5 before:rounded before:bg-primary",
                        floorDrag &&
                          floorDrag.to === i + 1 &&
                          i === doc.floors.length - 1 &&
                          "after:absolute after:top-0 after:-right-1.5 after:h-full after:w-0.5 after:rounded after:bg-primary",
                      )}
                    >
                      {f.name}
                      {routeFloors.has(f.id) && (
                        <span
                          title={t("道案内の経路が通る階")}
                          className="size-1.5 rounded-sm"
                          style={{ background: GUIDE }}
                        />
                      )}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={addFloor}
                  title={t("フロアを追加")}
                  className="flex size-7 items-center justify-center rounded-md border hover:bg-accent"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              {!preview && (
                <>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <label
                    className="ml-1 flex items-center gap-1 text-xs text-muted-foreground"
                    title={t(
                      "グリッドは作るときの目安です（お客さんの画面には出ません）",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                    />
                    {t("グリッド")}
                  </label>
                  {tool === "connector" && (
                    <>
                      <span className="mx-1 h-5 w-px bg-border" />
                      <div className="flex items-center rounded-md border p-0.5">
                        {CONNECTOR_TYPES.map((ct) => (
                          <button
                            key={ct}
                            type="button"
                            onClick={() => setConnectorType(ct)}
                            className={cn(
                              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                              connectorType === ct
                                ? "bg-accent text-primary"
                                : "text-muted-foreground hover:bg-accent/60",
                            )}
                          >
                            <ConnectorIcon type={ct} className="size-3.5" />
                            {connectorName(ct)}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t(
                          "地図をクリックして置く（全部の階の同じ位置に置かれます）",
                        )}
                      </span>
                    </>
                  )}
                </>
              )}
              {/* 名前で探す（⌘F） */}
              <div className="relative ml-auto" data-keep-selection>
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    window.clearTimeout(searchBlurRef.current);
                    setSearchOpen(true);
                  }}
                  onBlur={() => {
                    searchBlurRef.current = window.setTimeout(
                      () => setSearchOpen(false),
                      150,
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchHits[0]) {
                      focusObject(searchHits[0].id);
                      setSearchOpen(false);
                    } else if (e.key === "Escape") {
                      setQuery("");
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={t("名前で探す")}
                  title={t("名前で探す（⌘F）")}
                  aria-label={t("名前で探す")}
                  className="h-8 w-36 rounded-md border border-input bg-card pr-2 pl-8 text-xs min-[1500px]:w-52"
                />
                {searchOpen && query.trim() && (
                  <div className="studio-fade absolute right-0 z-50 mt-1 max-h-80 w-72 overflow-auto rounded-md border bg-card p-1 text-xs">
                    {searchHits.length === 0 ? (
                      <p className="px-2 py-2 text-muted-foreground">
                        {t("見つかりませんでした")}
                      </p>
                    ) : (
                      searchHits.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            focusObject(o.id);
                            setSearchOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <span
                            className="size-2 shrink-0 rounded-sm"
                            style={{
                              background: paletteOf(shownColorOf(o)).fill,
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {o.title}
                          </span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {floorName(o.floor)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* 編集 ⇄ プレビュー 切り替え。プレビュー中はパソコン／スマホの見え方も選べる */}
              <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                <button
                  type="button"
                  onClick={() => switchPreview(false)}
                  aria-pressed={!preview}
                  aria-label={t("編集")}
                  title={t("編集")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium",
                    !preview
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden min-[1400px]:inline">
                    {t("編集")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => switchPreview(true)}
                  aria-pressed={preview}
                  aria-label={t("プレビュー")}
                  title={t("お客さんから見た表示（プレビュー）")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium",
                    preview
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Eye className="size-3.5" />
                  <span className="hidden min-[1400px]:inline">
                    {t("プレビュー")}
                  </span>
                </button>
                {preview && (
                  <>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <button
                      type="button"
                      onClick={() => switchPhone(false)}
                      aria-pressed={!phone}
                      aria-label={t("パソコン")}
                      title={t("パソコンの画面で見る")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
                        !phone
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Monitor className="size-3.5" />
                      <span className="hidden min-[1400px]:inline">
                        {t("パソコン")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchPhone(true)}
                      aria-pressed={phone}
                      aria-label={t("スマホ")}
                      title={t("スマホの画面で見る")}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
                        phone
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Smartphone className="size-3.5" />
                      <span className="hidden min-[1400px]:inline">
                        {t("スマホ")}
                      </span>
                    </button>
                  </>
                )}
              </div>
              {!sideOpen && (
                <button
                  type="button"
                  onClick={() => toggleSide(true)}
                  title={t("右の設定を出す（\\）")}
                  aria-label={t("右の設定を出す")}
                  className="flex size-8 items-center justify-center rounded-md border hover:bg-accent"
                >
                  <PanelRightOpen className="size-4" />
                </button>
              )}
            </div>
            <div className="relative min-h-0 flex-1">
              {/* スマホで見るとき：スマホの形（枠・画面上の時計・階の切り替え）の中に地図を出す。地図の要素は作り直さない */}
              <div
                ref={phoneStageRef}
                className={
                  phoneView
                    ? "absolute inset-0 flex justify-center overflow-hidden bg-[var(--studio-map)] px-4 py-6"
                    : "contents"
                }
              >
                <div
                  className={
                    phoneView
                      ? "relative h-fit origin-top rounded-[54px] border-[11px] border-[#1d1b19] bg-[#1d1b19] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
                      : "contents"
                  }
                  style={
                    phoneView
                      ? { transform: `scale(${phoneScale})` }
                      : undefined
                  }
                >
                  {phoneView && (
                    <span
                      aria-hidden
                      className="absolute top-[11px] left-1/2 z-10 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-[#1d1b19]"
                    />
                  )}
                  <div
                    className={
                      phoneView
                        ? "flex flex-col overflow-hidden rounded-[43px] bg-card"
                        : "contents"
                    }
                    style={
                      phoneView
                        ? { width: PHONE_W, height: PHONE_H }
                        : undefined
                    }
                  >
                    {phoneView && (
                      <div
                        aria-hidden
                        className="flex h-[52px] shrink-0 items-end justify-between px-8 pb-1.5 text-[13px] font-medium"
                      >
                        <span className="font-mono">9:41</span>
                        <span className="flex items-center gap-1.5">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 18 12"
                            className="h-2.5 w-4"
                            fill="currentColor"
                          >
                            <rect x="0" y="8" width="3" height="4" rx="1" />
                            <rect x="5" y="5" width="3" height="7" rx="1" />
                            <rect
                              x="10"
                              y="2.5"
                              width="3"
                              height="9.5"
                              rx="1"
                            />
                            <rect x="15" y="0" width="3" height="12" rx="1" />
                          </svg>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 26 12"
                            className="h-3 w-6"
                            fill="none"
                            stroke="currentColor"
                          >
                            <rect
                              x="0.5"
                              y="0.5"
                              width="22"
                              height="11"
                              rx="3"
                            />
                            <rect
                              x="2.5"
                              y="2.5"
                              width="15"
                              height="7"
                              rx="1.5"
                              fill="currentColor"
                              stroke="none"
                            />
                            <path d="M24.5 4v4" strokeLinecap="round" />
                          </svg>
                        </span>
                      </div>
                    )}
                    {phoneView && (
                      <div className="studio-thin-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-4 py-2">
                        {doc.floors.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => goFloor(f.id)}
                            className={cn(
                              "shrink-0 rounded-full border px-3 py-1 font-mono text-xs",
                              f.id === doc.activeFloorId
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "",
                            )}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      ref={scrollerRef}
                      className={
                        phoneView
                          ? "studio-thin-scroll min-h-0 flex-1 overflow-auto bg-[var(--studio-map)]"
                          : "studio-thin-scroll absolute inset-0 overflow-auto bg-[var(--studio-map)]"
                      }
                    >
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: 地図の上で描く・動かす操作（マウス・ペン）。キーボードでは道具のキーと矢印キーで操作する */}
                      <div
                        style={{
                          width: worldW * zoom + PAN_PAD * 2,
                          height: worldH * zoom + PAN_PAD * 2,
                          ...(showGrid && !preview
                            ? {
                                backgroundImage:
                                  "linear-gradient(to right, color-mix(in srgb, var(--foreground) 16%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 16%, transparent) 1px, transparent 1px), linear-gradient(to right, color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 1px)",
                                backgroundSize: `${200 * zoom}px ${200 * zoom}px, ${200 * zoom}px ${200 * zoom}px, ${40 * zoom}px ${40 * zoom}px, ${40 * zoom}px ${40 * zoom}px`,
                                backgroundPosition: `${PAN_PAD}px ${PAN_PAD}px`,
                              }
                            : {}),
                        }}
                        // 地図の外側の余白（グリッドが見えている所）でも、置く・選ぶ・動かすができるように、操作はこの広い面で受ける。
                        // 座標は地図（worldRef）の左上を基準に計算するので、余白ではマイナスの位置になる
                        data-keep-selection
                        onPointerDown={onWorldDown}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        onPointerCancel={onUp}
                        onPointerLeave={() => rulersOn && showCursor(null)}
                        onContextMenu={onWorldContextMenu}
                        className={cn("touch-none select-none", worldCursor)}
                      >
                        <div
                          ref={worldRef}
                          data-keep-selection
                          className="relative"
                          style={{
                            width: worldW,
                            height: worldH,
                            transform: `translate(${PAN_PAD}px, ${PAN_PAD}px) scale(${zoom})`,
                            transformOrigin: "0 0",
                          }}
                        >
                          {/* 下敷き画像（いまは追加できないが、前に入れた地図ではそのまま表示する） */}
                          {floor?.image && (
                            // biome-ignore lint/performance/noImgElement: SVG の data URL をそのまま出す（画像の最適化は要らない）
                            <img
                              src={floor.image.src}
                              alt=""
                              className="pointer-events-none absolute top-0 left-0 select-none"
                              style={{ width: worldW, height: worldH }}
                              draggable={false}
                            />
                          )}

                          {/* エリア＝ゾーン（最背面レイヤー。範囲を囲んでラベルで分かりやすく） */}
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 overflow-visible"
                            width={worldW}
                            height={worldH}
                          >
                            {/* 色と描き方はお客さんの案内マップと同じ（venueMap.ts の buildingOf・areaPalette） */}
                            {building && (
                              <polygon
                                points={toPointsAttr(building.points)}
                                fill={MAP_FLOOR}
                              />
                            )}
                            {objects.map((o) => {
                              if (o.kind !== "area" || o.points.length < 3)
                                return null;
                              const isBuilding = o === building;
                              const pal = areaPalette(o.color);
                              const sel =
                                !preview && selectedIds.includes(o.id);
                              const c = centroidOf(o.points);
                              const bb = bboxOf(o.points);
                              const top = bb.y;
                              return (
                                <g key={o.id}>
                                  {/* 建物の外枠は床をいちばん下に塗ってあるので、ここでは壁の線だけ。通行止めだけ点線で区別する */}
                                  <polygon
                                    points={toPointsAttr(o.points)}
                                    fill={isBuilding ? "none" : pal.fill}
                                    fillOpacity={o.closed ? 0.7 : 0.55}
                                    stroke={
                                      sel
                                        ? SEL
                                        : isBuilding
                                          ? MAP_WALL
                                          : pal.stroke
                                    }
                                    strokeWidth={
                                      sel ? 1.5 : isBuilding ? 3 : 1.5
                                    }
                                    strokeDasharray={
                                      sel
                                        ? undefined
                                        : o.closed
                                          ? "6 3"
                                          : undefined
                                    }
                                    strokeLinejoin="round"
                                  />
                                  {o.title && (
                                    <text
                                      x={c.x}
                                      y={top + areaLabelSize(bb.w, bb.h) + 8}
                                      textAnchor="middle"
                                      fontSize={areaLabelSize(bb.w, bb.h)}
                                      fontFamily="var(--font-mono)"
                                      letterSpacing="0.06em"
                                      fill={
                                        o.closed
                                          ? "var(--studio-accent)"
                                          : isBuilding
                                            ? "var(--guest-map-room-ink)"
                                            : pal.ink
                                      }
                                      style={{ paintOrder: "stroke" }}
                                      stroke={MAP_FLOOR}
                                      strokeWidth={3}
                                      strokeLinejoin="round"
                                    >
                                      {o.title}
                                      {o.closed ? tg("closed") : ""}
                                      {!preview && o.locked ? " 🔒" : ""}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                            {/* 混雑を試している所（お客さんの画面と同じ広さ：範囲はその中、通路の線はまわり、場所はまわり） */}
                            {objects.map((o) => {
                              const st = previewCrowdMap.get(o.id);
                              if (!st) return null;
                              const c = crowdColor(st);
                              const common = {
                                fill: c,
                                fillOpacity: st.danger ? 0.28 : 0.2,
                                stroke: c,
                                strokeWidth: 1.5,
                                strokeDasharray: st.danger ? "6 4" : undefined,
                              };
                              if (o.kind === "area")
                                return (
                                  <polygon
                                    key={`cz-${o.id}`}
                                    points={toPointsAttr(o.points)}
                                    {...common}
                                  />
                                );
                              if (o.kind === "route")
                                return (
                                  <polyline
                                    key={`cz-${o.id}`}
                                    points={toPointsAttr(o.points)}
                                    fill="none"
                                    stroke={c}
                                    strokeOpacity={0.35}
                                    strokeWidth={o.width + 64}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                );
                              if (o.kind !== "place") return null;
                              if (o.shape === "pin" && !isConnector(o))
                                return (
                                  <circle
                                    key={`cz-${o.id}`}
                                    cx={o.x}
                                    cy={o.y}
                                    r={64}
                                    {...common}
                                  />
                                );
                              const b =
                                isConnector(o) && o.shape === "pin"
                                  ? markBoxOf(o)
                                  : { w: o.w, h: o.h };
                              return (
                                <rect
                                  key={`cz-${o.id}`}
                                  x={o.x - b.w / 2 - 32}
                                  y={o.y - b.h / 2 - 32}
                                  width={b.w + 64}
                                  height={b.h + 64}
                                  rx={12}
                                  {...common}
                                />
                              );
                            })}
                            {/* 混雑が無いときの道（混雑を避けて道が変わったときだけ、灰色の点線で） */}
                            {avoided &&
                              plainSteps?.map((s, i) =>
                                s.kind === "walk" &&
                                s.floor === doc.activeFloorId &&
                                s.points.length >= 2 ? (
                                  <polyline
                                    // biome-ignore lint/suspicious/noArrayIndexKey: 道の区間は順番そのものが意味で、並べ替えない
                                    key={`plain-${i}`}
                                    points={toPointsAttr(s.points)}
                                    fill="none"
                                    stroke="var(--studio-text-secondary)"
                                    strokeOpacity={0.6}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="1 8"
                                  />
                                ) : null,
                              )}
                            {/* 誘導プレビュー経路（壁を避けた道なり） */}
                            {routeSteps?.map((s, i) =>
                              s.kind === "walk" &&
                              s.floor === doc.activeFloorId &&
                              s.points.length >= 2 ? (
                                // tolo-web の案内マップと同じ見た目：縁取り＋太い線＋進む向きに流れる白い点
                                // biome-ignore lint/suspicious/noArrayIndexKey: 道の区間は順番そのものが意味で、並べ替えない
                                <g key={i}>
                                  <polyline
                                    points={toPointsAttr(s.points)}
                                    fill="none"
                                    stroke="var(--studio-background)"
                                    strokeWidth={10}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <polyline
                                    points={toPointsAttr(s.points)}
                                    fill="none"
                                    stroke={GUIDE}
                                    strokeWidth={5.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <polyline
                                    points={toPointsAttr(s.points)}
                                    fill="none"
                                    stroke="#ffffff"
                                    strokeOpacity={0.9}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeDasharray="0.01 11"
                                    className="studio-route-anim"
                                  />
                                </g>
                              ) : null,
                            )}
                            {/* 範囲選択（マーキー） */}
                            {marquee && (
                              <rect
                                x={Math.min(marquee.x0, marquee.x1)}
                                y={Math.min(marquee.y0, marquee.y1)}
                                width={Math.abs(marquee.x1 - marquee.x0)}
                                height={Math.abs(marquee.y1 - marquee.y0)}
                                className="fill-primary stroke-primary"
                                fillOpacity={0.08}
                                strokeWidth={1 / zoom}
                                strokeDasharray="5 4"
                              />
                            )}
                            {/* 四角/丸/エリア ドラッグ中プレビュー */}
                            {drawBox && (
                              <rect
                                x={drawBox.x}
                                y={drawBox.y}
                                width={drawBox.w}
                                height={drawBox.h}
                                rx={
                                  tool === "circle"
                                    ? Math.min(drawBox.w, drawBox.h) / 2
                                    : tool === "area"
                                      ? 0
                                      : 4
                                }
                                ry={
                                  tool === "circle"
                                    ? Math.min(drawBox.w, drawBox.h) / 2
                                    : tool === "area"
                                      ? 0
                                      : 4
                                }
                                fill={paletteOf(color).fill}
                                fillOpacity={0.2}
                                stroke={paletteOf(color).stroke}
                                strokeWidth={2}
                                strokeDasharray="6 5"
                              />
                            )}
                            {/* 選択中 route/area の頂点マーカー */}
                            {!preview &&
                              selected &&
                              !selected.locked &&
                              (selected.kind === "route" ||
                                selected.kind === "area") &&
                              selected.points.map((pt, i) => (
                                <circle
                                  // biome-ignore lint/suspicious/noArrayIndexKey: 頂点は番号そのものが識別子（何番目の頂点か）
                                  key={i}
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={5 / zoom + 1}
                                  className="fill-card stroke-primary"
                                  strokeWidth={2 / zoom + 1}
                                />
                              ))}
                          </svg>

                          {/* 頂点ハンドル（当たり） */}
                          {!preview &&
                            selected &&
                            !selected.locked &&
                            (selected.kind === "route" ||
                              selected.kind === "area") &&
                            selected.points.map((pt, i) => (
                              <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: 頂点は番号そのものが識別子（何番目の頂点か）
                                key={i}
                                onPointerDown={(ev) =>
                                  onVertexDown(ev, selected.id, i)
                                }
                                className="absolute z-30 cursor-move rounded-full"
                                style={{
                                  left: pt.x - 9 / zoom,
                                  top: pt.y - 9 / zoom,
                                  width: 18 / zoom,
                                  height: 18 / zoom,
                                }}
                              />
                            ))}

                          {/* 場所（ピン / 四角 / 丸）—「上質な図面」風：面の色＋選んだ色はごく薄く、細い線と左の色帯、等幅の番号 */}
                          {objects
                            .filter((o): o is PlaceObject => o.kind === "place")
                            .map((o) => {
                              const pal = paletteOf(shownColorOf(o));
                              const sel =
                                !preview && selectedIds.includes(o.id);
                              const tapped =
                                preview && showInfo && selectedId === o.id;
                              const line = objLine(pal.fill);
                              const selStyle = sel
                                ? {
                                    outline: `1.5px solid ${SEL}`,
                                    outlineOffset: 2,
                                  }
                                : {};
                              if (isConnector(o)) {
                                const linked = doc.floors.filter((f) =>
                                  doc.objects.some(
                                    (x) =>
                                      isConnector(x) &&
                                      x.link === o.link &&
                                      x.floor === f.id,
                                  ),
                                );
                                const floorsLabel =
                                  linked.length < 2
                                    ? t("未接続")
                                    : linked.length > 2
                                      ? `${linked[0].name}–${linked[linked.length - 1].name}`
                                      : linked.map((f) => f.name).join("・");
                                const label =
                                  o.title || connectorName(o.connector);
                                if (o.shape !== "pin") {
                                  // 四角／丸の階段・エレベーター：部屋と同じ図面風の面に、線画アイコン＋名前＋つながる階
                                  return (
                                    <div
                                      key={o.id}
                                      className={cn(
                                        "absolute z-20 flex flex-col items-center justify-center gap-1 text-center",
                                        o.shape === "circle"
                                          ? "rounded-full"
                                          : "rounded-md",
                                      )}
                                      style={{
                                        left: o.x - o.w / 2,
                                        top: o.y - o.h / 2,
                                        width: o.w,
                                        height: o.h,
                                        background: objFill(pal.fill),
                                        border: `1px solid ${line}`,
                                        color: "var(--studio-text-primary)",
                                        ...selStyle,
                                      }}
                                    >
                                      {!preview && o.locked && (
                                        <Lock
                                          aria-label={t("固定中")}
                                          className="absolute top-1.5 right-1.5 size-3 text-muted-foreground"
                                        />
                                      )}
                                      <ConnectorIcon
                                        type={o.connector}
                                        className="size-[18px]"
                                        style={{ color: line }}
                                      />
                                      <span className="max-w-full truncate px-2 text-[12px] tracking-[0.04em]">
                                        {label}
                                      </span>
                                      {!preview && (
                                        <span
                                          className={cn(
                                            "max-w-full truncate px-2 font-mono text-[10px] tracking-[0.08em]",
                                            linked.length < 2
                                              ? "text-primary"
                                              : "text-muted-foreground",
                                          )}
                                        >
                                          {floorsLabel}
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                                // ピン型の階段・エレベーター：細い線の正方形に線画アイコン、下に等幅の小さな名前と行き先の階
                                const mb = markBoxOf(o);
                                return (
                                  <div
                                    key={o.id}
                                    className="absolute z-[25]"
                                    style={{
                                      left: o.x - mb.w / 2,
                                      top: o.y - mb.h / 2,
                                      width: mb.w,
                                      height: mb.h,
                                    }}
                                  >
                                    <span
                                      className="flex size-full items-center justify-center rounded-md"
                                      style={{
                                        background: "var(--studio-surface)",
                                        border: `1px solid ${line}`,
                                        color: line,
                                        ...selStyle,
                                      }}
                                    >
                                      <ConnectorIcon
                                        type={o.connector}
                                        style={{
                                          width: Math.min(mb.w, mb.h) * 0.56,
                                          height: Math.min(mb.w, mb.h) * 0.56,
                                        }}
                                      />
                                    </span>
                                    <span className="absolute top-full left-1/2 mt-1 flex -translate-x-1/2 items-center gap-1.5 rounded-sm bg-background/85 px-1 font-mono text-[10px] tracking-[0.08em] whitespace-nowrap">
                                      <span
                                        style={{
                                          color: "var(--studio-text-primary)",
                                        }}
                                      >
                                        {label}
                                      </span>
                                      {!preview && (
                                        <span
                                          className={
                                            linked.length < 2
                                              ? "text-primary"
                                              : "text-muted-foreground"
                                          }
                                        >
                                          {floorsLabel}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              }
                              if (o.shape === "pin") {
                                // 単独のピン：小さな点＋細い輪（中心が x,y）。名前は上に小さく
                                return (
                                  <div
                                    key={o.id}
                                    className="absolute z-20"
                                    style={{ left: o.x, top: o.y }}
                                  >
                                    {o.title && (
                                      <span
                                        className="absolute bottom-3 left-1/2 max-w-[160px] -translate-x-1/2 truncate rounded-md border bg-card px-2 py-0.5 text-[11px] tracking-[0.04em]"
                                        style={{
                                          color: "var(--studio-text-primary)",
                                          borderColor: sel
                                            ? SEL
                                            : "var(--studio-divider)",
                                        }}
                                      >
                                        {o.title}
                                      </span>
                                    )}
                                    <PinDot
                                      color={pal.fill}
                                      line={line}
                                      sel={sel}
                                      tapped={tapped}
                                    />
                                  </div>
                                );
                              }
                              // 四角／丸（部屋・区画）。トイレなどは tolo-web と同じマークを名前の上に出す
                              const parts = splitTitle(o.title);
                              const Mark = KIND_ICON[markOf(o)];
                              const markSize = Math.max(
                                12,
                                Math.min(28, Math.min(o.w, o.h) * 0.3),
                              );
                              // 名前（無ければ番号）は部屋の大きさに合わせた大きさで、入らなければ 2 行に分ける（roomLabel.ts）。
                              // 名前より上の目印（18px）とマークの分は、名前に使える高さから引く（すき間は 6px）
                              const label = roomLabel(
                                parts.name || parts.num,
                                o.w,
                                o.h,
                                {
                                  reserved:
                                    (o.pin ? 18 + 6 : 0) +
                                    (Mark ? markSize + 6 : 0),
                                  spacing: parts.name ? 0.04 : 0.12,
                                  mono: !parts.name,
                                },
                              );
                              return (
                                <div
                                  key={o.id}
                                  className={cn(
                                    "absolute z-20 flex flex-col items-center justify-center gap-1.5 text-center",
                                    o.shape === "circle"
                                      ? "rounded-full"
                                      : "rounded-md",
                                  )}
                                  style={{
                                    left: o.x - o.w / 2,
                                    top: o.y - o.h / 2,
                                    width: o.w,
                                    height: o.h,
                                    background: objFill(pal.fill),
                                    border: `1px solid ${line}`,
                                    // 左の辺に 3px の色帯（丸には付けない）
                                    ...(o.shape === "circle"
                                      ? {}
                                      : {
                                          borderLeft: `3px solid ${pal.fill}`,
                                        }),
                                    color: "var(--studio-text-primary)",
                                    ...selStyle,
                                  }}
                                >
                                  {!preview && o.locked && (
                                    <Lock
                                      aria-label={t("固定中")}
                                      className="absolute top-1.5 right-1.5 size-3 text-muted-foreground"
                                    />
                                  )}
                                  {/* 部屋番号：左上に等幅で小さく（名前が番号だけのときは中央に大きめ） */}
                                  {parts.num && parts.name && (
                                    <span className="absolute top-1.5 left-2.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                                      {parts.num}
                                    </span>
                                  )}
                                  {o.pin && (
                                    <PinDot
                                      color={pal.fill}
                                      line={line}
                                      sel={false}
                                      tapped={tapped}
                                      inline
                                    />
                                  )}
                                  {Mark && (
                                    <Mark
                                      aria-hidden
                                      className="shrink-0"
                                      style={{
                                        width: markSize,
                                        height: markSize,
                                        color: line,
                                      }}
                                    />
                                  )}
                                  {label.lines.length > 0 && (
                                    <span
                                      className={cn(
                                        "max-w-full px-2 leading-[1.2]",
                                        parts.name
                                          ? "tracking-[0.04em]"
                                          : "font-mono tracking-[0.12em]",
                                      )}
                                      style={{ fontSize: label.size }}
                                    >
                                      <span className="block truncate">
                                        {label.lines[0]}
                                      </span>
                                      {label.lines[1] && (
                                        <span className="block truncate">
                                          {label.lines[1]}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              );
                            })}

                          {/* 四角/丸 のリサイズハンドル */}
                          {resizable && (
                            <ResizeHandles
                              id={resizable.id}
                              x={resizable.x}
                              y={resizable.y}
                              w={resizable.w}
                              h={resizable.h}
                              zoom={zoom}
                              onStart={onResizeDown}
                            />
                          )}

                          {/* テキスト */}
                          {objects
                            .filter((o): o is TextObject => o.kind === "text")
                            .map((o) => {
                              const pal = paletteOf(shownColorOf(o));
                              const sel =
                                !preview && selectedIds.includes(o.id);
                              return (
                                <div
                                  key={o.id}
                                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 font-normal tracking-[0.06em] whitespace-nowrap"
                                  style={{
                                    left: o.x,
                                    top: o.y,
                                    fontSize: o.size,
                                    color: `color-mix(in srgb, ${pal.fill} 35%, var(--studio-text-primary))`,
                                    outline: sel
                                      ? `1.5px solid ${SEL}`
                                      : undefined,
                                    outlineOffset: 4,
                                    borderRadius: 6,
                                  }}
                                >
                                  {o.title || t("テキスト")}
                                </div>
                              );
                            })}

                          {/* 道案内の目印（出発・目的地・乗り換え。乗り換えは押すと行き先の階へ） */}
                          {routeMarks
                            .filter((m) => m.floor === doc.activeFloorId)
                            .map((m, i) => {
                              const o = doc.objects.find((x) => x.id === m.id);
                              if (o?.kind !== "place") return null;
                              const cls =
                                "absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium font-mono text-primary-foreground";
                              const style = {
                                left: o.x,
                                top: o.y + 6,
                                background: GUIDE,
                              };
                              const to = m.to;
                              return to ? (
                                <button
                                  // biome-ignore lint/suspicious/noArrayIndexKey: 道案内の目印は道の順に並び、並べ替えない
                                  key={i}
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={() => goFloor(to)}
                                  className={cn(cls, "hover:brightness-110")}
                                  style={style}
                                  title={t("{floor}を表示", {
                                    floor: floorName(to),
                                  })}
                                >
                                  {m.label} ›
                                </button>
                              ) : (
                                <span
                                  // biome-ignore lint/suspicious/noArrayIndexKey: 道案内の目印は道の順に並び、並べ替えない
                                  key={i}
                                  className={cn(cls, "pointer-events-none")}
                                  style={style}
                                >
                                  {m.label}
                                </span>
                              );
                            })}

                          {/* スマートガイドは四角などより手前に描く */}
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-40 overflow-visible"
                            width={worldW}
                            height={worldH}
                          >
                            {/* スマートガイド：そろった端・中央の線と、等しいすき間の目印 */}
                            {guides && (
                              <g className="pointer-events-none">
                                {guides.lines.map((l, i) => (
                                  <line
                                    // biome-ignore lint/suspicious/noArrayIndexKey: スマートガイドはドラッグのたびに作り直す一覧
                                    key={`gl${i}`}
                                    x1={l.x1}
                                    y1={l.y1}
                                    x2={l.x2}
                                    y2={l.y2}
                                    stroke={GUIDE}
                                    strokeWidth={1 / zoom}
                                    strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                                  />
                                ))}
                                {guides.gaps.map((g, i) => {
                                  const horiz = g.y1 === g.y2;
                                  const t = 5 / zoom;
                                  const mx = (g.x1 + g.x2) / 2;
                                  const my = (g.y1 + g.y2) / 2;
                                  return (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: スマートガイドはドラッグのたびに作り直す一覧
                                    <g key={`gg${i}`}>
                                      <line
                                        x1={g.x1}
                                        y1={g.y1}
                                        x2={g.x2}
                                        y2={g.y2}
                                        stroke={GUIDE}
                                        strokeWidth={1.5 / zoom}
                                      />
                                      {horiz ? (
                                        <>
                                          <line
                                            x1={g.x1}
                                            y1={g.y1 - t}
                                            x2={g.x1}
                                            y2={g.y1 + t}
                                            stroke={GUIDE}
                                            strokeWidth={1.5 / zoom}
                                          />
                                          <line
                                            x1={g.x2}
                                            y1={g.y2 - t}
                                            x2={g.x2}
                                            y2={g.y2 + t}
                                            stroke={GUIDE}
                                            strokeWidth={1.5 / zoom}
                                          />
                                        </>
                                      ) : (
                                        <>
                                          <line
                                            x1={g.x1 - t}
                                            y1={g.y1}
                                            x2={g.x1 + t}
                                            y2={g.y1}
                                            stroke={GUIDE}
                                            strokeWidth={1.5 / zoom}
                                          />
                                          <line
                                            x1={g.x2 - t}
                                            y1={g.y2}
                                            x2={g.x2 + t}
                                            y2={g.y2}
                                            stroke={GUIDE}
                                            strokeWidth={1.5 / zoom}
                                          />
                                        </>
                                      )}
                                      <g
                                        transform={`translate(${mx} ${my}) scale(${1 / zoom})`}
                                      >
                                        <rect
                                          x={-16}
                                          y={-9}
                                          width={32}
                                          height={18}
                                          rx={4}
                                          fill={GUIDE}
                                        />
                                        <text
                                          textAnchor="middle"
                                          dominantBaseline="central"
                                          fontSize={11}
                                          fontWeight={600}
                                          fill="var(--studio-on-accent)"
                                        >
                                          {g.size}
                                        </text>
                                      </g>
                                    </g>
                                  );
                                })}
                              </g>
                            )}
                          </svg>

                          {/* 情報カード（説明があるものをタップしたとき） */}
                          {selected && showInfo && hasInfo(selected) && (
                            <div
                              className="absolute z-40"
                              style={{
                                left: anchorOf(selected).x,
                                top: anchorOf(selected).y,
                                transform: `scale(${1 / zoom})`,
                                transformOrigin: "0 0",
                              }}
                            >
                              <div
                                className="w-60"
                                style={{
                                  transform:
                                    "translate(-50%, calc(-100% - 10px))",
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <div className="studio-fade overflow-hidden rounded-md border bg-card">
                                  <div className="flex items-start gap-2 px-3 pt-2.5">
                                    <span
                                      className="mt-1.5 size-2 shrink-0 rounded-sm"
                                      style={{
                                        background: paletteOf(
                                          shownColorOf(selected),
                                        ).fill,
                                      }}
                                    />
                                    <span className="flex-1 text-sm leading-snug font-medium tracking-[0.02em]">
                                      {selected.title || t("（無題）")}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShowInfo(false)}
                                      aria-label={t("閉じる")}
                                      className="-mt-0.5 -mr-1 text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="size-4" />
                                    </button>
                                  </div>
                                  {selected.description?.trim() && (
                                    <p className="px-3 pt-2 pb-3 text-xs leading-relaxed whitespace-pre-wrap">
                                      {selected.description}
                                    </p>
                                  )}
                                </div>
                                {/* 吹き出しの三角 */}
                                <div className="mx-auto -mt-1.5 size-3 rotate-45 border-r border-b bg-card" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {phoneView && (
                      <span
                        aria-hidden
                        className="mx-auto mt-2 mb-2 block h-[5px] w-[134px] shrink-0 rounded-full bg-current opacity-80"
                      />
                    )}
                  </div>
                </div>
              </div>
              {/* 定規（上と左）：地図の座標の目盛り・マウスの位置・選んでいるものの範囲 */}
              {rulersOn && (
                <Rulers
                  zoom={zoom}
                  view={view}
                  selBox={
                    selectedIds.length
                      ? unionBox(
                          objects
                            .filter((o) => selectedIds.includes(o.id))
                            .map(boxOf),
                        )
                      : null
                  }
                  markXRef={rulerXRef}
                  markYRef={rulerYRef}
                />
              )}
              {/* 全体図（ミニマップ）：いま見ている範囲を枠で示す。押した所へ移動 */}
              {showMini && !phoneView && floor && (
                <MiniMap
                  doc={doc}
                  floor={floor}
                  zoom={zoom}
                  view={view}
                  onJump={(x, y) => {
                    const sc = scrollerRef.current;
                    if (sc)
                      sc.scrollTo({
                        left: PAN_PAD + x * zoom - sc.clientWidth / 2,
                        top: PAN_PAD + y * zoom - sc.clientHeight / 2,
                      });
                  }}
                />
              )}
            </div>
            {/* 地図の下の細い帯：マウスの位置・定規・全体図・拡大縮小 */}
            <div className="flex h-9 shrink-0 items-center gap-0.5 border-t px-2">
              {/* マウスの位置（地図の座標） */}
              {rulersOn && (
                <span
                  ref={coordRef}
                  aria-live="off"
                  className="min-w-[7.5rem] px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums"
                />
              )}
              <span className="flex-1" />
              {!phoneView && !preview && (
                <button
                  type="button"
                  aria-pressed={showRulers}
                  aria-label={t("定規")}
                  title={
                    showRulers
                      ? t("定規（座標）を隠す")
                      : t("定規（座標）を出す")
                  }
                  onClick={() => {
                    setShowRulers(!showRulers);
                    saveViewPrefs({ rulers: !showRulers });
                  }}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    showRulers ? "bg-accent text-primary" : "hover:bg-accent",
                  )}
                >
                  <Ruler className="size-4" />
                </button>
              )}
              {!phoneView && (
                <button
                  type="button"
                  aria-pressed={showMini}
                  aria-label={t("全体図")}
                  title={showMini ? t("全体図を隠す") : t("全体図を出す")}
                  onClick={() => {
                    setShowMini(!showMini);
                    saveViewPrefs({ showMini: !showMini });
                  }}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    showMini ? "bg-accent text-primary" : "hover:bg-accent",
                  )}
                >
                  <MapIcon className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={t("全体を表示")}
                title={t("全体を表示")}
                onClick={() => fitView(doc)}
                className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
              >
                <Maximize className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("縮小")}
                onClick={() => zoomBy(0.9)}
                className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="min-w-12 rounded-md px-1 text-center font-mono text-xs tabular-nums hover:bg-accent"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label={t("拡大")}
                onClick={() => zoomBy(1.1)}
                className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
              >
                <ZoomIn className="size-4" />
              </button>
            </div>
          </main>

          {/* プロパティ */}
          {/* 右の設定：「設定」「誘導」のタブで分け、中だけスクロールする。\ キーでしまえる */}
          {sideOpen && (
            <aside
              data-keep-selection
              className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(0,0,0,0.25)]"
            >
              <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
                <div
                  role="tablist"
                  aria-label={t("右の設定")}
                  className="flex items-center gap-0.5 rounded-md p-0.5"
                >
                  {(
                    [
                      { key: "settings", label: t("設定"), Icon: Pencil },
                      { key: "guide", label: t("誘導"), Icon: Route },
                    ] as const
                  ).map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={sideTab === key}
                      onClick={() => setSideTab(key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                        sideTab === key
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent/60",
                      )}
                    >
                      <Icon className="size-3.5" />
                      {label}
                      {/* 誘導で混雑を試しているときは印を付ける */}
                      {key === "guide" &&
                        Object.keys(previewCrowd).length > 0 && (
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: GUIDE }}
                          />
                        )}
                    </button>
                  ))}
                </div>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => toggleSide(false)}
                  title={t("右の設定をしまう（\\）")}
                  aria-label={t("右の設定をしまう")}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <PanelRightClose className="size-4" />
                </button>
              </div>
              <div className="studio-thin-scroll min-h-0 flex-1 overflow-y-auto px-4 [&>div:first-child]:border-t-0">
                {sideTab === "settings" ? (
                  <>
                    {preview && (
                      <div className="border-t py-6">
                        <h2 className="mb-4 flex items-center gap-2 font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
                          <Eye className="size-4" />
                          {t("プレビュー中")}
                        </h2>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t(
                            "お客さんから見たときの表示です。説明を書いた項目は、タップすると説明が出ます。戻るときは地図の上の「編集」を押します。",
                          )}
                        </p>
                      </div>
                    )}
                    {!preview && (
                      <div className="border-t py-6">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <h2 className="font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
                            {selectedIds.length > 1
                              ? t("選択中（{n}件）", { n: selectedIds.length })
                              : selected
                                ? t("選択中の項目")
                                : t("設定")}
                          </h2>
                          {selectedIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds([]);
                                setShowInfo(false);
                                setMenu(null);
                              }}
                              title={t("選択を外す（Esc）")}
                              className="-my-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <X className="size-3.5" />
                              {t("選択を外す")}
                            </button>
                          )}
                        </div>
                        {selectedIds.length > 1 && doc.floors.length > 1 && (
                          <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
                            <span className="mr-1 text-muted-foreground">
                              {t("別の階へコピー")}
                            </span>
                            {doc.floors
                              .filter((f) => f.id !== doc.activeFloorId)
                              .map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => copyToFloor(selectedIds, f.id)}
                                  className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  <Copy className="size-3" />
                                  {t("{floor}へ", { floor: f.name })}
                                </button>
                              ))}
                          </div>
                        )}
                        {selectedIds.length > 1 ? (
                          <div className="space-y-2.5 text-xs">
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => duplicateSelected(selectedIds)}
                                className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
                              >
                                <Copy className="size-3.5" />
                                {t("複製")}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSelected(selectedIds)}
                                className="flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground"
                              >
                                <Trash2 className="size-3.5" />
                                {t("削除")}
                              </button>
                              {selectedIds.every((id) => lockedIds.has(id)) ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    lockSelected(selectedIds, false)
                                  }
                                  className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  <LockOpen className="size-3.5" />
                                  {t("固定を外す")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    lockSelected(selectedIds, true)
                                  }
                                  className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  <Lock className="size-3.5" />
                                  {t("固定する")}
                                </button>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {t("色をまとめて変更")}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {PALETTE_KEYS.map((k) => (
                                  <ColorSwatch
                                    key={k}
                                    k={k}
                                    selected={selectedColor === k}
                                    aria-pressed={selectedColor === k}
                                    onClick={() =>
                                      colorSelected(selectedIds, k)
                                    }
                                    className="size-5"
                                  />
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {t("大きさをそろえる")}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => sizeSelected(selectedIds, "w")}
                                  className="rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  {t("幅を統一")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => sizeSelected(selectedIds, "h")}
                                  className="rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  {t("高さを統一")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    sizeSelected(selectedIds, "both")
                                  }
                                  className="rounded-md border px-2 py-1 hover:bg-accent"
                                >
                                  {t("大きさを統一")}
                                </button>
                              </div>
                            </div>
                            {objects.some(
                              (o) =>
                                selectedIds.includes(o.id) && o.kind === "area",
                            ) && (
                              <div>
                                <span className="text-muted-foreground">
                                  {t("通行止め")}
                                </span>
                                <div className="mt-1 flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      closedSelected(selectedIds, true)
                                    }
                                    className="rounded-md border px-2 py-1 hover:bg-accent"
                                  >
                                    {t("通行止めにする")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      closedSelected(selectedIds, false)
                                    }
                                    className="rounded-md border px-2 py-1 hover:bg-accent"
                                  >
                                    {t("解除")}
                                  </button>
                                </div>
                              </div>
                            )}
                            <p className="text-muted-foreground">
                              {t(
                                "まとめて移動はドラッグ、または矢印キー（Shiftで大きく）。",
                              )}
                            </p>
                          </div>
                        ) : selected ? (
                          <>
                            {/* 見出し：種類のアイコンと名前 */}
                            {(() => {
                              const toolOf = isConnector(selected)
                                ? TOOLS.find((x) => x.key === "connector")
                                : selected.kind === "place"
                                  ? TOOLS.find(
                                      (x) =>
                                        x.key ===
                                        (selected.shape === "pin"
                                          ? "pin"
                                          : selected.shape === "circle"
                                            ? "circle"
                                            : "rect"),
                                    )
                                  : selected.kind === "area"
                                    ? TOOLS.find((x) => x.key === "area")
                                    : TOOLS.find((x) => x.key === "text");
                              const Icon = toolOf?.Icon ?? Square;
                              return (
                                <div className="mb-4 flex items-center gap-2">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                                    {isConnector(selected) ? (
                                      <ConnectorIcon
                                        type={selected.connector}
                                        className="size-4"
                                      />
                                    ) : (
                                      <Icon className="size-4" />
                                    )}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                      {shownName(selected) || t("（名前なし）")}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground">
                                      {isConnector(selected)
                                        ? connectorName(selected.connector)
                                        : t(toolOf?.label ?? "")}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                            {/* 基本：まず決めること */}
                            {isConnector(selected) && (
                              <div className="mb-3">
                                <ConnectorPanel
                                  connector={selected}
                                  floors={doc.floors}
                                  linkedFloorIds={doc.objects
                                    .filter(
                                      (o) =>
                                        isConnector(o) &&
                                        o.link === selected.link,
                                    )
                                    .map((o) => o.floor)}
                                  onType={(t) =>
                                    changeConnectorType(selected.link, t)
                                  }
                                  onDirection={(dir) =>
                                    setConnectorGroup(selected.link, () => ({
                                      direction: dir,
                                    }))
                                  }
                                  onMarkSize={(size) =>
                                    setConnectorGroup(
                                      selected.link,
                                      (o) =>
                                        ({
                                          ...markBoxOf(o),
                                          ...size,
                                        }) as Partial<ConnectorObject>,
                                    )
                                  }
                                  onToggleFloor={(floorId, on) =>
                                    toggleConnectorFloor(selected, floorId, on)
                                  }
                                />
                              </div>
                            )}
                            <PropertyPanel
                              part="basic"
                              key={`b-${selected.id}`}
                              object={selected}
                              graph={doc.graph}
                              onLoadGraph={loadGraphFile}
                              onLock={(on) => lockSelected([selected.id], on)}
                              onChange={(patch) =>
                                updateObject(selected.id, patch)
                              }
                              onDelete={() => deleteObject(selected.id)}
                              onDuplicate={() =>
                                duplicateSelected([selected.id])
                              }
                              onPreview={() => setShowInfo(true)}
                              previewCrowd={previewCrowd[crowdKeyOf(selected)]}
                              onPreviewCrowd={(state) =>
                                setCrowdTrial(crowdKeyOf(selected), state)
                              }
                            />

                            {/* くわしい設定（開け閉めできる。開いたかどうかは覚えておく） */}
                            <details
                              open={advancedOpen || undefined}
                              onToggle={(e) => {
                                const open = (
                                  e.currentTarget as HTMLDetailsElement
                                ).open;
                                if (open !== advancedOpen) {
                                  setAdvancedOpen(open);
                                  saveViewPrefs({ advanced: open });
                                }
                              }}
                              className="mt-4 rounded-md border text-xs"
                            >
                              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-2 select-none hover:bg-accent [&::-webkit-details-marker]:hidden">
                                <ChevronDown
                                  className={cn(
                                    "size-3.5 transition-transform",
                                    !advancedOpen && "-rotate-90",
                                  )}
                                />
                                <span className="font-medium">
                                  {t("くわしい設定")}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                  {t(
                                    "位置・大きさ、形、固定、混雑とのつなぎ など",
                                  )}
                                </span>
                              </summary>
                              {/* 中で設定されているものは、閉じていても印で分かるように */}
                              {!advancedOpen &&
                                (selected.locked ||
                                  selected.graphPointId ||
                                  selected.graphRouteId) && (
                                  <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                                    {selected.locked && (
                                      <span className="rounded bg-accent px-1.5 py-0.5">
                                        {t("固定中")}
                                      </span>
                                    )}
                                    {(selected.graphPointId ||
                                      selected.graphRouteId) && (
                                      <span className="rounded bg-accent px-1.5 py-0.5">
                                        {t("混雑とつながっています")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              <div className="space-y-3 border-t px-2.5 py-3">
                                {/* 位置・大きさ（定規と同じ座標） */}
                                {(() => {
                                  const o = selected;
                                  const pointLike =
                                    o.kind === "text" ||
                                    (o.kind === "place" && o.shape === "pin");
                                  const bb =
                                    o.kind === "area" || o.kind === "route"
                                      ? bboxOf(o.points)
                                      : null;
                                  const left = pointLike
                                    ? (o as PlaceObject).x
                                    : bb
                                      ? bb.x
                                      : (o as PlaceObject).x -
                                        (o as PlaceObject).w / 2;
                                  const top = pointLike
                                    ? (o as PlaceObject).y
                                    : bb
                                      ? bb.y
                                      : (o as PlaceObject).y -
                                        (o as PlaceObject).h / 2;
                                  return (
                                    <div>
                                      <span className="text-muted-foreground">
                                        {pointLike
                                          ? t("位置")
                                          : t("位置（左上）・大きさ")}
                                      </span>
                                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                        <NumField
                                          label="X"
                                          value={left}
                                          disabled={o.locked}
                                          onCommit={(v) =>
                                            setGeometry(o, { left: v })
                                          }
                                        />
                                        <NumField
                                          label="Y"
                                          value={top}
                                          disabled={o.locked}
                                          onCommit={(v) =>
                                            setGeometry(o, { top: v })
                                          }
                                        />
                                        {o.kind === "place" &&
                                          o.shape !== "pin" && (
                                            <>
                                              <NumField
                                                label="W"
                                                value={o.w}
                                                min={GRID_SNAP}
                                                disabled={o.locked}
                                                onCommit={(v) =>
                                                  setGeometry(o, { w: v })
                                                }
                                              />
                                              <NumField
                                                label="H"
                                                value={o.h}
                                                min={GRID_SNAP}
                                                disabled={o.locked}
                                                onCommit={(v) =>
                                                  setGeometry(o, { h: v })
                                                }
                                              />
                                            </>
                                          )}
                                        {bb && (
                                          <span className="col-span-2 font-mono text-[11px] text-muted-foreground">
                                            W {Math.round(bb.w)} H{" "}
                                            {Math.round(bb.h)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <PropertyPanel
                                  part="advanced"
                                  key={`a-${selected.id}`}
                                  object={selected}
                                  graph={doc.graph}
                                  onLoadGraph={loadGraphFile}
                                  onLock={(on) =>
                                    lockSelected([selected.id], on)
                                  }
                                  onChange={(patch) =>
                                    updateObject(selected.id, patch)
                                  }
                                  onDelete={() => deleteObject(selected.id)}
                                  onDuplicate={() =>
                                    duplicateSelected([selected.id])
                                  }
                                  onPreview={() => setShowInfo(true)}
                                  previewCrowd={
                                    previewCrowd[crowdKeyOf(selected)]
                                  }
                                  onPreviewCrowd={(state) =>
                                    setCrowdTrial(crowdKeyOf(selected), state)
                                  }
                                />
                                {selected.kind === "place" &&
                                  selected.shape !== "pin" &&
                                  !isConnector(selected) && (
                                    <div className="rounded-md border border-dashed p-2">
                                      <span className="text-muted-foreground">
                                        {t(
                                          "階段・EVとして使う（全部の階の同じ位置に置かれます）",
                                        )}
                                      </span>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {CONNECTOR_TYPES.map((ct) => (
                                          <button
                                            key={ct}
                                            type="button"
                                            onClick={() =>
                                              makeConnector(selected.id, ct)
                                            }
                                            className={cn(
                                              "flex items-center gap-1 rounded-md border px-2 py-1",
                                              guessConnector(selected.title) ===
                                                ct
                                                ? "border-primary bg-accent text-primary"
                                                : "hover:bg-accent",
                                            )}
                                          >
                                            <ConnectorIcon
                                              type={ct}
                                              className="size-3.5"
                                            />
                                            {t("{type}にする", {
                                              type: connectorName(ct),
                                            })}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                {isConnector(selected) &&
                                  selected.shape !== "pin" && (
                                    <button
                                      type="button"
                                      onClick={() => unmakeConnector(selected)}
                                      className="w-full rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground"
                                    >
                                      {t(
                                        "階段・EVとして使うのをやめて、普通の{shape}に戻す",
                                        {
                                          shape:
                                            selected.shape === "circle"
                                              ? t("丸い区画")
                                              : t("部屋・区画"),
                                        },
                                      )}
                                    </button>
                                  )}
                                {doc.floors.length > 1 && (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="mr-1 text-muted-foreground">
                                      {t("別の階へコピー")}
                                    </span>
                                    {doc.floors
                                      .filter((f) => f.id !== doc.activeFloorId)
                                      .map((f) => (
                                        <button
                                          key={f.id}
                                          type="button"
                                          onClick={() =>
                                            copyToFloor(selectedIds, f.id)
                                          }
                                          className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
                                        >
                                          <Copy className="size-3" />
                                          {t("{floor}へ", { floor: f.name })}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          </>
                        ) : (
                          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                            <p>
                              {t(
                                "地図の項目をクリックすると、ここで名前・説明・色などを変えられます。",
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => setHelpOpen(true)}
                              className="text-primary hover:underline"
                            >
                              {t("わからないときは「使い方（Q&A）」を見る")}{" "}
                              <span className="">→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {floor && !preview && (
                      <div className="border-t py-6">
                        <h2 className="mb-4 font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
                          {t("フロア")}
                        </h2>
                        <div className="flex items-center gap-2">
                          <FloorNameInput
                            key={`${floor.id}:${floor.name}`}
                            name={floor.name}
                            onCommit={(name) => renameFloor(floor.id, name)}
                            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => duplicateFloor(floor.id)}
                            className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                          >
                            <Copy className="size-3.5" />
                            {t("複製")}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFloor(floor.id)}
                            disabled={doc.floors.length <= 1}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" />
                            {t("削除")}
                          </button>
                        </div>
                        {/* tolo-web のグラフのグループ（階）との結び付け。tolo-web はこの ID で階を見分ける */}
                        {doc.graph && (
                          <label className="mt-3 block text-xs">
                            <span className="text-muted-foreground">
                              {t("グラフの階（グループ）")}
                            </span>
                            <select
                              value={floor.groupId ?? ""}
                              onChange={(e) =>
                                setFloorGroup(floor.id, e.target.value)
                              }
                              className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-sm"
                            >
                              <option value="">{t("（結び付けない）")}</option>
                              {doc.graph.groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {labelOf(g.labels, lang) || g.id}
                                </option>
                              ))}
                            </select>
                            {!floor.groupId && (
                              <span className="mt-1 block text-primary">
                                {t(
                                  "決めないと、お客さんの画面でこの階が正しく出ません",
                                )}
                              </span>
                            )}
                          </label>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <GuidePanel
                    route={route}
                    doc={doc}
                    goFloor={goFloor}
                    onStart={setRouteStart}
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {helpOpen && <StudioHelpDialog onClose={() => setHelpOpen(false)} />}
      {notice && (
        <div
          role="status"
          className="studio-fade fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-md bg-primary px-5 py-2.5 text-sm tracking-[0.04em] text-primary-foreground"
        >
          {notice}
        </div>
      )}

      {/* 新規作成：どんなマップを作るか選ぶ */}
      {newMapOpen && (
        <NewMapDialog onPick={newPage} onClose={() => setNewMapOpen(false)} />
      )}

      {/* tolo-web のグラフとのつなぎ */}
      {linkOpen && (
        <GraphLinkDialog
          doc={doc}
          selected={selected}
          floorName={floorName}
          tab={linkTab}
          onTab={setLinkTab}
          unlinkedOnly={linkUnlinkedOnly}
          onUnlinkedOnly={setLinkUnlinkedOnly}
          onLoadGraph={(f) => void loadGraphFile(f)}
          onFloorGroup={setFloorGroup}
          onChange={updateObject}
          onShow={(id) => {
            setLinkOpen(false);
            focusObject(id);
          }}
          onClose={() => setLinkOpen(false)}
        />
      )}

      {/* 場所の一覧表 */}
      {listOpen && (
        <PlacesListDialog
          doc={doc}
          floorName={floorName}
          filter={listFilter}
          onFilter={setListFilter}
          onChange={updateObject}
          onShow={(id) => {
            setListOpen(false);
            focusObject(id);
          }}
          onClose={() => setListOpen(false)}
        />
      )}

      {/* 保存ポイント */}
      {historyList && (
        <SnapshotsDialog
          list={historyList}
          now={historyNow}
          activeFloorId={doc.activeFloorId}
          theme={resolvedTheme === "dark" ? SVG_DARK : SVG_LIGHT}
          onSave={(label) => saveManualSnapshot(label)}
          onRename={renameSnapshotTo}
          onRestore={(snap, saveFirst) => void restoreSnapshot(snap, saveFirst)}
          onRemove={(id) => void removeSnapshot(id)}
          onOpenInTab={openSnapshotInTab}
          onClose={() => setHistoryList(null)}
        />
      )}

      {/* タブを消した直後だけ「元に戻す」 */}
      {deletedPage && (
        <div
          role="status"
          className="studio-fade fixed bottom-8 left-1/2 z-[61] flex -translate-x-1/2 items-center gap-4 rounded-md bg-primary py-2 pr-2 pl-5 text-sm tracking-[0.04em] text-primary-foreground"
        >
          {t("タブ「{name}」を削除しました", { name: deletedPage.page.name })}
          <button
            type="button"
            onClick={restorePage}
            className="rounded bg-card px-3 py-1 text-xs font-medium text-foreground"
          >
            {t("元に戻す")}
          </button>
        </div>
      )}

      {/* 書き出す前のチェック */}
      {check && (
        <CheckDialog
          check={check}
          pageLabel={
            pages.length > 1
              ? (() => {
                  const i = pages.findIndex((p) => p.id === check.pageId);
                  return i >= 0 ? pageName(pages[i], i) : "";
                })()
              : ""
          }
          messageOf={checkMessage}
          onOpenIssue={openIssue}
          onExportAnyway={exportAnyway}
          onClose={() => setCheck(null)}
        />
      )}

      {/* 2つのタブを並べて見比べる */}
      {compare && (
        <CompareDialog
          compare={compare}
          pages={livePages}
          pageName={pageName}
          svgOptions={{
            ...svgLabels,
            theme: resolvedTheme === "dark" ? SVG_DARK : SVG_LIGHT,
          }}
          onChange={setCompare}
          onOpenPage={(id) => {
            setCompare(null);
            goPage(id);
          }}
          onExport={(id) => {
            setCompare(null);
            runCheck(id, true);
          }}
          onClose={() => setCompare(null)}
        />
      )}

      {/* マップタブの右クリックメニュー */}
      {pageMenu && (
        <PopupMenu
          x={pageMenu.x}
          y={pageMenu.y}
          onClose={() => setPageMenu(null)}
          className="w-44"
        >
          <button
            type="button"
            onClick={() => {
              setEditingPage(pageMenu.id);
              setPageMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Pencil className="size-3.5" />
            {t("名前を変更")}
          </button>
          {(() => {
            const idx = pages.findIndex((p) => p.id === pageMenu.id);
            return (
              <>
                <button
                  type="button"
                  disabled={idx <= 0}
                  onClick={() => movePage(pageMenu.id, idx - 1)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("左へ移動")}
                </button>
                <button
                  type="button"
                  disabled={idx >= pages.length - 1}
                  onClick={() => movePage(pageMenu.id, idx + 2)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowRight className="size-3.5" />
                  {t("右へ移動")}
                </button>
              </>
            );
          })()}
          <button
            type="button"
            onClick={() => duplicatePage(pageMenu.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Copy className="size-3.5" />
            {t("複製")}
          </button>
          <button
            type="button"
            disabled={pages.length <= 1}
            onClick={() => deletePage(pageMenu.id)}
            title={
              pages.length <= 1
                ? t("最後の1つのタブは削除できません")
                : undefined
            }
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            {t("削除")}
          </button>
        </PopupMenu>
      )}

      {/* 書き出すマップを選ぶ（タブが2つ以上のときだけ） */}
      {exportPicker && (
        <ExportPickerDialog
          pages={livePages}
          activePageId={activePageId}
          pageName={pageName}
          onPick={exportPage}
          onClose={() => setExportPicker(false)}
        />
      )}

      {/* フロアタブの右クリックメニュー */}
      {floorMenu && (
        <PopupMenu
          x={floorMenu.x}
          y={floorMenu.y}
          onClose={() => setFloorMenu(null)}
          className="w-44"
        >
          <button
            type="button"
            onClick={() => {
              setEditingFloor(floorMenu.id);
              setFloorMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Pencil className="size-3.5" />
            {t("名前を変更")}
          </button>
          {(() => {
            const idx = doc.floors.findIndex((f) => f.id === floorMenu.id);
            return (
              <>
                <button
                  type="button"
                  disabled={idx <= 0}
                  onClick={() => moveFloor(floorMenu.id, idx - 1)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("左へ移動")}
                </button>
                <button
                  type="button"
                  disabled={idx >= doc.floors.length - 1}
                  onClick={() => moveFloor(floorMenu.id, idx + 2)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowRight className="size-3.5" />
                  {t("右へ移動")}
                </button>
              </>
            );
          })()}
          <button
            type="button"
            onClick={() => duplicateFloor(floorMenu.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Copy className="size-3.5" />
            {t("複製")}
          </button>
          <button
            type="button"
            disabled={doc.floors.length <= 1}
            onClick={() => deleteFloor(floorMenu.id)}
            title={
              doc.floors.length <= 1
                ? t("最後の1フロアは削除できません")
                : undefined
            }
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            {t("削除")}
          </button>
        </PopupMenu>
      )}

      {/* 右クリックのコンテキストメニュー */}
      {menu && (
        <PopupMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          className="w-48"
        >
          <button
            type="button"
            onClick={() => duplicateSelected(selectedIds)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Copy className="size-3.5" />
            {t("複製")}
            {selectedIds.length > 1
              ? t("（{n}件）", { n: selectedIds.length })
              : ""}
          </button>
          <button
            type="button"
            onClick={() => deleteSelected(selectedIds)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
          >
            <Trash2 className="size-3.5" />
            {t("削除")}
            {selectedIds.length > 1
              ? t("（{n}件）", { n: selectedIds.length })
              : ""}
          </button>
          {selectedIds.every((id) => lockedIds.has(id)) ? (
            <button
              type="button"
              onClick={() => lockSelected(selectedIds, false)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <LockOpen className="size-3.5" />
              {t("固定を外す")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => lockSelected(selectedIds, true)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <Lock className="size-3.5" />
              {t("固定する（動かないようにする）")}
            </button>
          )}
          {doc.floors.length > 1 && (
            <>
              <div className="my-1 border-t" />
              <div className="px-2 pt-1 pb-0.5 text-muted-foreground">
                {t("別の階へコピー")}
              </div>
              {doc.floors
                .filter((f) => f.id !== doc.activeFloorId)
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => copyToFloor(selectedIds, f.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                  >
                    <Copy className="size-3.5" />
                    {t("{floor}へコピー", { floor: f.name })}
                  </button>
                ))}
            </>
          )}
          <div className="my-1 border-t" />
          <div className="px-2 py-1">
            <span className="text-muted-foreground">{t("色を変える")}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {PALETTE_KEYS.map((k) => (
                <ColorSwatch
                  key={k}
                  k={k}
                  selected={selectedColor === k}
                  aria-pressed={selectedColor === k}
                  onClick={() => colorSelected(selectedIds, k)}
                  className="size-5"
                />
              ))}
            </div>
          </div>
        </PopupMenu>
      )}
    </div>
  );
}
