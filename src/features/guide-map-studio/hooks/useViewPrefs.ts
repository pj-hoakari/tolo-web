import * as React from "react";

// 画面だけの設定（全体図・定規・右の「くわしい設定」・右の設定を出しているか）。このブラウザに覚えておく
// 保存キー
const VIEW_PREFS_KEY = "guide-map-studio:view-prefs";
// 前の名前の保存キー。残っていれば一度だけ読んで引き継ぐ
const LEGACY_VIEW_PREFS_KEY = "venue-map:view-prefs";

export function useViewPrefs() {
  const [sideOpen, setSideOpen] = React.useState(true); // 右の設定を出しているか
  const [showMini, setShowMini] = React.useState(true); // 全体図（ミニマップ）
  const [showRulers, setShowRulers] = React.useState(true); // 定規（座標）を表示
  const [advancedOpen, setAdvancedOpen] = React.useState(false); // 右の設定の「くわしい設定」を開いているか
  React.useEffect(() => {
    try {
      const v = JSON.parse(
        window.localStorage.getItem(VIEW_PREFS_KEY) ||
          window.localStorage.getItem(LEGACY_VIEW_PREFS_KEY) ||
          "{}",
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
  return {
    showMini,
    setShowMini,
    showRulers,
    setShowRulers,
    advancedOpen,
    setAdvancedOpen,
    sideOpen,
    setSideOpen,
    saveViewPrefs,
  };
}
