// 英語の辞書（見出し＝画面の日本語の文、値＝英語）。{name} などは差し込み。
// 見出しは画面のコードの t("…") と完全に同じ文にすること（違うと日本語のまま表示される）。
export const EN: Record<string, string> = {
  // --- 共通・ヘッダー ---
  使い方: "Help",
  "知りたいことを入力（例：コピー、階段、そろえる）":
    "Search (e.g. copy, stairs, align)",
  "「{q}」に当てはまる質問がありません。別のことばで探してみてください。":
    "No questions match “{q}”. Try other words.",
  "会場マップ・スタジオ": "Venue Map Studio",
  "元に戻す（⌘Z）": "Undo (⌘Z)",
  元に戻す: "Undo",
  "やり直し（⌘⇧Z）": "Redo (⌘⇧Z)",
  やり直し: "Redo",
  整列済みの見本会場マップを読み込む: "Load the sample venue map",
  見本: "Sample",
  読み込む: "Import",
  見本を読み込む: "Load sample",
  書き出す: "Export",
  完了: "Done",
  "見本の会場マップを読み込みます。いまのタブの内容は置き換わります。よろしいですか？":
    "Load the sample venue map? The map in the current tab will be replaced.",
  閉じる: "Close",
  編集: "Edit",
  プレビュー: "Preview",
  縮小: "Zoom out",
  拡大: "Zoom in",

  // --- 道具・種類 ---
  選択: "Select",
  エリア: "Area",
  文字: "Text",
  ルート: "Route",
  "（無題）": "(Untitled)",
  新しい場所: "New place",
  テキスト: "Text",
  "地図をクリックして置く（全部の階の同じ位置に置かれます）":
    "Click the map to place it (placed at the same spot on every floor)",

  // --- フロア ---
  "ドラッグで並べ替え／ダブルクリックで名前を変更／右クリックでメニュー":
    "Drag to reorder / double-click to rename / right-click for menu",
  道案内の経路が通る階: "The route passes this floor",
  フロアを追加: "Add floor",
  フロア: "Floor",
  フロア名: "Floor name",
  名前を変更: "Rename",
  左へ移動: "Move left",
  右へ移動: "Move right",
  最後の1フロアは削除できません: "The last floor can't be deleted",
  "{name}（コピー）": "{name} (copy)",
  "「{name}」と、その階の項目を削除します。よろしいですか？":
    "Delete “{name}” and everything on that floor?",

  // --- 地図上の表示 ---
  未接続: "Not linked",
  "{floor}を表示": "Show {floor}",
  出発: "Start",
  // --- 右パネル ---
  プレビュー中: "Previewing",
  "選択中（{n}件）": "Selected ({n})",
  選択中の項目: "Selected item",
  設定: "Settings",
  別の階へコピー: "Copy to another floor",
  "{floor}へ": "To {floor}",
  "{floor}へコピー": "Copy to {floor}",
  "{floor}にはすでにあります": "Already on {floor}",
  "{floor}にコピーしました（{n}件）": "Copied to {floor} ({n})",
  複製: "Duplicate",
  削除: "Delete",
  "（{n}件）": " ({n})",
  色をまとめて変更: "Change color for all",
  色を変える: "Change color",
  大きさをそろえる: "Match size",
  幅を統一: "Same width",
  高さを統一: "Same height",
  大きさを統一: "Same size",
  通行止めにする: "Close",
  解除: "Reopen",
  "まとめて移動はドラッグ、または矢印キー（Shiftで大きく）。":
    "Drag to move them together, or use the arrow keys (Shift for bigger steps).",
  "{type}にする": "Make it {type}",
  "地図の項目をクリックすると、ここで名前・説明・色などを変えられます。":
    "Click an item on the map to edit its name, description, color and more here.",
  "わからないときは「使い方（Q&A）」を見る": "Need help? Open the Q&A",

  // --- 誘導プレビュー ---
  "階段・エスカレーター・エレベーター": "stairs, escalator or elevator",
  "経路が見つかりません。通路がふさがっているか、エスカレーターの向きが合っていない可能性があります。":
    "No route found. A passage may be blocked, or an escalator may run the wrong way.",
  "手順を押すとその階を表示します。地図上の「〜へ」の目印からも移れます。":
    "Press a step to show that floor. You can also use the “to …” markers on the map.",

  // --- 階段・エレベーターの設定 ---
  種類: "Type",
  "マークの大きさ（全部の階に反映・角のハンドルでも変更可）":
    "Mark size (applies to every floor; you can also drag the corners)",
  幅: "Width",
  高さ: "Height",
  つながる階: "Connected floors",
  "フロアタブの「＋」で階を増やすと選べます。":
    "Add floors with “+” on the floor tabs to choose them.",
  "まだ別の階とつながっていません。": "Not linked to another floor yet.",
  "チェックした階にも同じ位置に置かれます。位置がずれる場合は、その階で動かしてください。":
    "It is placed at the same spot on each checked floor. If it's off, move it on that floor.",
  向き: "Direction",
  "上り・下り": "Up & down",
  上りのみ: "Up only",
  下りのみ: "Down only",
  "上り＝フロアタブで右側の階へ進む向きです。":
    "“Up” means toward the floors on the right of the floor tabs.",

  // --- 項目の設定 ---
  名前: "Name",
  書くとタップで情報カードに表示されます:
    "If written, it appears in the info card on tap",
  外す: "Remove",
  情報カードを表示してみる: "Preview the info card",
  色: "Color",
  形: "Shape",
  文字サイズ: "Font size",

  // --- グラフ連携・混雑 ---
  混雑を試す: "Try congestion",
  なし: "None",
  "混雑：中": "Congestion: medium",
  "混雑：高": "Congestion: high",
  危険: "Danger",

  // --- 色の名前 ---
  インディゴ: "Indigo",
  "トイレ（男性）": "Restroom (men)",
  "トイレ（女性）": "Restroom (women)",
  "トイレ（男女）": "Restroom (all genders)",
  多目的トイレ: "Accessible restroom",
  飲食: "Food & drink",
  "売店・物販": "Shop & merchandise",
  自販機: "Vending machine",
  "休憩・ラウンジ": "Rest & lounge",
  "授乳室・ベビー": "Nursing & baby",
  "救護・医務室": "First aid",
  "受付・案内": "Reception & info",
  "ロッカー・クローク": "Lockers & cloakroom",
  充電: "Charging",
  喫煙所: "Smoking area",
  出入口: "Entrance & exit",
  集合場所: "Meeting point",
  "展示・催し": "Exhibits & events",
  トイレ: "Restrooms",
  "飲食・買い物": "Food & shopping",
  "休憩・サービス": "Rest & services",
  "出入口・集合": "Entrances & meeting",
  催し: "Events",
  建物の外枠: "Building outline",
  "建物の外枠（壁として描く）": "Building outline (drawn as walls)",
  "普通の部屋は「基本の色」から選びます。トイレなどの種類を選ぶと、tolo-web と同じ色とマークで表示されます":
    'Pick ordinary rooms from "Basic colors". Choosing a type such as a restroom shows it with the same color and mark as tolo-web',
  ローズ: "Rose",
  アンバー: "Amber",
  "基本（グレー）": "Basic (gray)",
  "基本（藍色）": "Basic (indigo)",
  エメラルド: "Emerald",
  スカイ: "Sky",
  バイオレット: "Violet",
  基本の色: "Basic colors",
  スレート: "Slate",

  // --- マップのタブ・新規作成・書き出す選択 ---
  新規作成: "New",
  "白紙のマップを新しいタブで作ります（いまのマップはそのまま残ります）":
    "Create a blank map in a new tab (your current map stays)",
  マップのタブ: "Map tabs",
  マップ名: "Map name",
  "マップ{n}": "Map {n}",
  新しいマップのタブを追加: "Add a new map tab",
  最後の1つのタブは削除できません: "The last tab can't be deleted",
  "新しいタブ「{name}」で開きました": "Opened in a new tab “{name}”",
  "どのマップを書き出しますか？": "Which map do you want to export?",
  "選んだタブのマップを1つのファイルとして保存します。":
    "The map in the chosen tab is saved as one file.",
  "{f}フロア・{n}件": "Floors: {f} · Items: {n}",
  表示中: "Current",
  キャンセル: "Cancel",

  // --- 固定・探す・チェック・見比べる・画像・印刷・スマホ表示・保存の失敗 ---
  "固定しているので消せません。固定を外してください":
    "It's locked, so it can't be deleted. Unlock it first.",
  "{floor}を画像で保存しました": "Saved {floor} as an image",
  チェック: "Check",
  タブが2つ以上あると使えます: "Available when there are two or more tabs",
  見比べる: "Compare",
  画像で保存: "Save image",
  "全部の階を1ページずつ印刷します（PDF にも保存できます）":
    "Print every floor, one per page (you can also save as PDF)",
  印刷: "Print",
  "ブラウザに保存できませんでした。": "Couldn't save in the browser.",
  "グリッドは作るときの目安です（お客さんの画面には出ません）":
    "The grid is a guide for drawing (not shown to visitors)",
  "名前で探す（⌘F）": "Find by name (⌘F)",
  名前で探す: "Find by name",
  見つかりませんでした: "No matches",
  固定中: "Locked",
  パソコンの画面で見る: "View as on a computer",
  パソコン: "Computer",
  スマホの画面で見る: "View as on a smartphone",
  スマホ: "Phone",
  固定を外す: "Unlock",
  固定する: "Lock",
  "タブ「{name}」を削除しました": "Deleted tab “{name}”",
  書き出す前のチェック: "Check before export",
  "確認しています…": "Checking…",
  "問題は見つかりませんでした。": "No problems found.",
  念のため: "FYI",
  このまま書き出す: "Export anyway",
  "左右で別のタブを選べます。階の切り替えは両方そろって動きます。":
    "Choose a tab on each side. Switching floors changes both.",
  見比べるタブ: "Tab to compare",
  このタブを開く: "Open this tab",
  これを書き出す: "Export this",
  "固定する（動かないようにする）": "Lock (prevent moving)",
  "固定中（押すと外す）": "Locked (press to unlock)",
  "「混雑を試す」は、ここでの誘導プレビューにだけ効きます（保存しません）。お客さんの画面では、実際の混雑状況で避けます。":
    "“Try congestion” only affects the route preview here (not saved). On the visitors’ screen, routes avoid actual congestion.",

  // --- 全体表示・保存ポイント ---
  全体を表示: "Fit to view",
  "読み込んでいます…": "Loading…",
  新しいタブで開く: "Open in new tab",
  この状態に戻す: "Restore",
  たった今: "Just now",
  "{n}分前": "{n} min ago",
  "{n}時間前": "{n} h ago",
  "{n}日前": "{n} days ago",
  "{time}の状態に戻しました（⌘Z で取り消せます）":
    "Restored the state from {time} (undo with ⌘Z)",
  "{name}（{time}）": "{name} ({time})",
  // --- 画像で保存のメニュー・選択を外す ---
  "この階だけ（{floor}）": "This floor only ({floor})",
  表示中の階を1枚の画像にします: "Save the current floor as one image",
  "全部の階（{n}枚）": "All floors ({n} images)",
  "階ごとに1枚ずつ、続けて保存します":
    "Save one image per floor, one after another",
  "全部の階（{n}枚）を画像で保存しました": "Saved all floors ({n} images)",
  "選択を外す（Esc）": "Deselect (Esc)",
  選択を外す: "Deselect",
  // --- 履歴（残す・削除・確認）・誘導プレビューのリセット ---
  "名前（任意）例：案A・入口を広げる前":
    "Name (optional), e.g. Plan A / before widening the entrance",
  "（名前なし）": "(No name)",
  削除する: "Delete",
  "目的地・混雑の試しを、はじめの状態に戻します（出発＝現在地はそのまま）":
    "Clear the destination and congestion trials (Start = current location stays)",
  リセット: "Reset",
  // --- 保存ポイント ---
  保存ポイント: "Save points",
  "いまの地図を保存ポイントにしたり、保存ポイントの状態に戻したりします（⌘S で保存）":
    "Save the current map as a save point, or go back to one (⌘S to save)",
  "保存ポイントを作れませんでした。": "Couldn't create the save point.",
  "保存ポイント「{name}」を作りました": "Created save point “{name}”",
  "保存ポイントを作りました（名前は「保存ポイント」の一覧で付けられます）":
    "Created a save point (you can name it in the Save points list)",
  "名前を変えられませんでした。": "Couldn’t rename it.",
  "マスを押すと「{level}」で混ませます": "Click a cell to make it “{level}”",
  名前を変える: "Rename",
  "「{name}」に戻す前": "Before restoring “{name}”",
  "いまの地図に名前を付けて保存しておき、あとでその状態に戻せます（⌘S でも保存できます）。案を試す前などに作っておくと安心です。このブラウザの中だけに残り、ページを開き直しても使えます。":
    "Save the current map with a name and go back to that state later (⌘S also saves). Handy before trying out an idea. Save points stay in this browser only and remain after reopening the page.",
  保存ポイントの名前: "Save point name",
  いまの状態を保存: "Save current state",
  "まだ保存ポイントがありません。名前を入れて「いまの状態を保存」を押すと作れます。":
    "No save points yet. Enter a name and press “Save current state”.",
  "いまの地図が、この状態に置き換わります。いまの地図を残しておきたいときは「保存してから戻す」を選んでください（戻した直後なら ⌘Z でも取り消せます）。":
    "Your current map will be replaced with this state. To keep your current map, choose “Save, then restore” (right after, ⌘Z also undoes it).",
  "この保存ポイントを削除します。削除すると元に戻せません。":
    "Delete this save point? This can't be undone.",
  保存せずに戻す: "Restore without saving",
  保存してから戻す: "Save, then restore",
  この保存ポイントを削除: "Delete this save point",
  // --- 名前のかぶり・階の並び ---
  "{name}（コピー{n}）": "{name} (copy {n})",
  "階の並びを変えました。エスカレーターの上り・下りは並びで決まるので、向きを確かめてください":
    "Floor order changed. Escalator up/down depends on the order, so check their directions.",
  // --- ほかの階を重ねる・全体図・一覧 ---
  受付: "Reception",
  全体図: "Overview map",
  全体図を隠す: "Hide overview map",
  全体図を出す: "Show overview map",
  "全体図（押すとその場所へ移動）": "Overview map (press to go there)",
  一覧: "List",
  場所の一覧: "Places",
  "名前・色はここで直せます。「表示」でその場所へ移動します。":
    "Edit names and colors here. “Show” takes you to the place.",
  階で絞り込む: "Filter by floor",
  すべての階: "All floors",
  名前で絞り込む: "Filter by name",
  名前がないものだけ: "Only items without a name",
  "{n}件": "{n} items",
  階: "Floor",
  当てはまる場所がありません: "No matching places",
  表示: "Show",
  "画像を作れませんでした。地図が大きすぎる可能性があります。":
    "Couldn't create the image. The map may be too large.",
  "保存できる量を超えています。このまま閉じると最後の変更が消えます。「書き出す」でファイルに保存するか、使っていないタブを減らしてください。":
    "This exceeds the space the browser allows. If you close now, your latest changes will be lost. Save a file with “Export”, or remove unused tabs.",
  // --- 定規・座標 ---
  定規: "Rulers",
  "定規（座標）を隠す": "Hide rulers (coordinates)",
  "定規（座標）を出す": "Show rulers (coordinates)",
  位置: "Position",
  "位置（左上）・大きさ": "Position (top left) & size",
  // --- 新規作成（建物／会場） ---
  会場: "Venue",
  "どんなマップを作りますか？": "What kind of map do you want to make?",
  "白紙のマップを新しいタブで作ります。いまのマップはそのまま残ります。":
    "A blank map opens in a new tab. Your current map stays.",
  "建物（階あり）": "Building (with floors)",
  "校舎やビルなど。1F から始めて、2F・3F…と階を増やし、階段やエレベーターでつなげます。":
    "Schools, office buildings and more. Start from 1F, add 2F, 3F… and connect them with stairs or elevators.",
  "会場（階なし）": "Venue (no floors)",
  "屋外のお祭り会場や広場など、階の無い場所を1枚の地図で作ります。あとから階を足すこともできます。":
    "Outdoor festival grounds, plazas and other places without floors, on a single map. You can add floors later.",
  // --- 道具の名前（用途で呼ぶ） ---
  "部屋・区画": "Room",
  丸い区画: "Round room",
  "目印（ピン）": "Marker",
  範囲: "Zone",
  "階段・EV": "Stairs/EV",
  四角い区画: "Rectangular",
  目印: "Marker",
  "階段・EVとして使うのをやめて、普通の{shape}に戻す":
    "Stop using as stairs/EV (back to a plain {shape})",
  "{floor}から別の階へ移れる{what}がありません。道具の「階段・EV」で置き、つながる階を選んでください。":
    "There is no {what} to leave {floor}. Place one with the “Stairs/EV” tool and choose the floors it connects.",
  "範囲を「通行止め」にすると、その道は避けて再計算します。":
    "Set a zone to “Closed” and the route will avoid it.",
  "真ん中に目印（ピン）を表示": "Show a marker in the center",
  "階段・EVとして使う（全部の階の同じ位置に置かれます）":
    "Use as stairs/EV (placed at the same spot on every floor)",
  通行止め: "Closed",
  "通行止め（ここは避けて案内）": "Closed (routes avoid it)",
  // --- tolo-web のグラフ・混雑を避けて誘導 ---
  "グラフを読み込みました（グループ {g}・ポイント {p}・ルート {r}）":
    "Graph loaded (groups {g}, points {p}, routes {r})",
  つなぎ: "Links",
  "混雑を避けて誘導（プレビュー）": "Crowd-avoiding guidance (preview)",
  "名前のある場所を2つ以上置くと、お客さんの画面と同じように、混雑を避けて目的地へ誘導する道を試せます。":
    "Place two or more named places to try guidance that avoids crowds, just like the visitors’ screen.",
  "お客さんの現在地は、読み取った QR コードの場所が先です。分からないときに、ここで選んだ場所が現在地になります。":
    "The visitors’ current location comes from the scanned QR code first. When it's unknown, the place chosen here is used.",
  すべて外す: "Clear all",
  "地図のどれとも結び付いていないので、道には影響しません":
    "Not linked to anything on the map, so it doesn't affect the route",
  "ルート（通路）": "Routes (passages)",
  混雑の度合い: "Crowd level",
  "危険な所を通らないと行けないため、その道を案内しています。":
    "The only way passes a dangerous spot, so that route is shown.",
  "混雑を避けた道に変えて案内しています。灰色の点線は、混雑が無いときの道です。":
    "Guiding along a route that avoids the crowd. The gray dotted line is the route without crowds.",
  "混んでいる所を通らない道なので、そのまま案内しています。":
    "The route doesn't pass crowded spots, so it stays the same.",
  "（結び付けない）": "(Not linked)",
  "グループ {g}・ポイント {p}・ルート {r}":
    "Groups {g} · Points {p} · Routes {r}",
  グラフを読み直す: "Reload graph",
  グラフを読み込む: "Load graph",
  "階（グループ）": "Floors (groups)",
  "ポイント（場所）": "Points (places)",
  結び付いていないものだけ: "Only unlinked",
  "選んでいる物：{name}": "Selected: {name}",
  地図の物を選んでいません: "Nothing selected on the map",
  未設定: "Not set",
  ポイント: "Point",
  結び付いている地図の物: "Linked map items",
  当てはまるものがありません: "No matches",
  "なし（ここが混んでも避けられません）":
    "None (can't be avoided when crowded)",
  結び付きを外す: "Unlink",
  先に地図の物を選んでください: "Select something on the map first",
  ルートは範囲か線に結び付けます: "Routes are linked to zones or lines",
  選んでいる物に結び付ける: "Link to selected",
  混雑とのつなぎ: "Crowd link",
  "（グラフに無い：{id}）": "(Not in graph: {id})",
  "読み込んだグラフに、このポイントがありません":
    "This point isn't in the loaded graph",
  "お客さんの画面では、名前が「{name}」と表示されます（ポイントの名前）。":
    "On the visitors’ screen, the name shows as “{name}” (the point’s name).",
  "読み込んだグラフに、このルートがありません":
    "This route isn't in the loaded graph",
  "廊下などの通路は、通路に沿って範囲を描き、ルートに結び付けると、そこが混んだときに避けられます。":
    "For corridors, draw a zone along the passage and link it to a route so it can be avoided when crowded.",
  "決めていないと、お客さんの画面では「{name}」が現在地になります。":
    "If not set, “{name}” becomes the current location on the visitors’ screen.",
  ここにする: "Use this",
  // --- 混雑を試す（階段・EV をまとめて） ---
  台: "",
  基: "",
  か所: "",
  "{type}{n}{unit}": "{n} × {type}",
  "{name} ほか{n}件": "{name} + {n} more",
  地図に無し: "not on map",
  "階段・エレベーター：マスを押すと、その台のその階だけ混みます。名前を押すとその台の全部の階、階を押すとその階の全部の台をまとめて混ませます。":
    "Stairs & elevators: press a cell to crowd that one on that floor only. Press a name for all its floors, or a floor for everything on that floor.",
  "{floor}の全部の台": "Everything on {floor}",
  "{name}の全部の階": "{name} on all floors",
  "{name}（{floor}）": "{name} ({floor})",
  // --- 道具（左の縦の並び）・右の設定（基本／くわしい設定） ---
  道具: "Tools",
  くわしい設定: "Advanced settings",
  "位置・大きさ、形、固定、混雑とのつなぎ など":
    "Position & size, shape, lock, crowd links, etc.",
  混雑とつながっています: "Linked to crowd info",
  表示する文字: "Text to show",
  "例：受付・101教室・売店": "e.g. Reception, Room 101, Shop",
  "名前を入れると、地図に表示され、お客さんが目的地に選べます":
    "With a name, it shows on the map and visitors can choose it as a destination",
  説明: "Description",
  "（任意・タップで表示）": "(optional, shown on tap)",
  "地図の物を選んで、動かしたり大きさを変えたりします。何もない所をドラッグすると、まとめて選べます。":
    "Select items on the map to move or resize them. Drag on an empty spot to select several.",
  "ドラッグして、部屋や売り場を描きます。部屋どうしのすき間が、お客さんの通る道になります。":
    "Drag to draw rooms or shops. The gaps between rooms become the paths visitors walk.",
  "ドラッグして、丸い形の区画（ブース・広場など）を描きます。":
    "Drag to draw a round area (booth, plaza, etc.).",
  "クリックした所に目印を置きます。入口・案内所など、部屋ではない場所に使います。":
    "Click to place a marker. Use it for places that aren’t rooms, like entrances or info desks.",
  "ドラッグして範囲を囲みます。待機列の場所、通行止めにする所、建物全体などを示すのに使います。":
    "Drag to outline a zone, such as a queue area, a closed spot, or the whole building.",
  "クリックした所に文字を置きます。建物名や「本館」などの見出しに使います。":
    "Click to place text, for headings like a building name.",
  "クリックした所に階段・エスカレーター・エレベーターを置きます。全部の階の同じ位置に置かれます。":
    "Click to place stairs, an escalator or an elevator. It’s placed at the same spot on every floor.",
  // --- 作業場のレイアウト ---
  "確かめる・共有": "Check & share",
  "部屋・目印を表で見て、名前や色を直す":
    "See rooms & markers in a table and fix names/colors",
  行けない場所などが無いか調べる: "Look for unreachable places and more",
  "2つのタブを並べて比べる": "Compare two tabs side by side",
  選んでいる物の色も変わります: "The selection’s color changes too",
  グリッド: "Grid",
  "お客さんから見た表示（プレビュー）": "As visitors see it (preview)",
  "右の設定を出す（\\）": "Show the side panel (\\)",
  右の設定を出す: "Show the side panel",
  右の設定: "Side panel",
  誘導: "Guidance",
  "右の設定をしまう（\\）": "Hide the side panel (\\)",
  右の設定をしまう: "Hide the side panel",
  "お客さんから見たときの表示です。説明を書いた項目は、タップすると説明が出ます。戻るときは地図の上の「編集」を押します。":
    "This is how visitors see the map. Tap an item with a description to see it. Press “Edit” above the map to go back.",
  // --- チェックの文（何が・どうする・どこへ） ---
  "ファイルを読み込めませんでした。この画面で書き出した案内マップか、グラフ（.json）を選んでください。":
    "Couldn't read the file. Choose a guide map exported from this studio, or a graph (.json).",
  "グラフを読み込めませんでした。グラフ編集で作ったグラフ（.json）を選んでください。":
    "Couldn't read the graph. Choose a graph (.json) made in the graph editor.",
  "「{name}」（{floor}）へたどり着けません": "Can't reach “{name}” ({floor})",
  "現在地「{from}」から行ける道がありません。部屋・区画どうしのすき間が狭すぎないか、通路がふさがれていないか確かめてください。":
    "There’s no path from the current location “{from}”. Check that the gaps between rooms aren’t too narrow and that no passage is blocked.",
  その場所を表示: "Show the place",
  お客さんの現在地が決まっていません:
    "The visitors’ current location isn’t set",
  "QR コードの場所が分からないとき、どこから案内を始めるかを「誘導」の「現在地」で選んでください。":
    "Choose where guidance starts when the QR code location is unknown, in “Current location” on the Guidance tab.",
  "「現在地」を開く": "Open “Current location”",
  "名前のない目印があります（{floor}）": "A marker has no name ({floor})",
  "名前が無いと、お客さんが目的地として選べません。名前を入れるか、要らなければ消してください。":
    "Without a name, visitors can’t choose it as a destination. Give it a name, or delete it if it isn’t needed.",
  その目印を表示: "Show the marker",
  "「{name}」（{floor}）が、ほかの階とつながっていません":
    "“{name}” ({floor}) isn’t linked to other floors",
  "この階段・エレベーターでは別の階へ移れません。右の「つながる階」で、行き来できる階に印を付けてください。":
    "These stairs/elevator can’t take visitors to another floor. Check the floors it connects in “Connected floors” on the right.",
  "{floor}へ行ける階段・エレベーターがありません":
    "No stairs or elevator lead to {floor}",
  "ほかの階からこの階へ案内できません。道具の「階段・EV」で置いてください。":
    "Visitors can’t be guided to this floor from other floors. Place one with the “Stairs/EV” tool.",
  その階を表示: "Show the floor",
  "「{a}」と「{b}」が重なっています（{floor}）":
    "“{a}” and “{b}” overlap ({floor})",
  "重なっていると、その間を通る道が作れません。少し離してください。":
    "Overlapping rooms leave no path between them. Move them apart a little.",
  "2つを選んで表示": "Select both and show",
  "{floor}には、まだ何も置かれていません": "Nothing is placed on {floor} yet",
  "使わない階なら、消してもかまいません。":
    "If you don’t use this floor, you can delete it.",
  "混雑の情報と、まだつながっていません": "Not linked to crowd info yet",
  "グラフ（グラフ編集で作ったもの）を読み込むと、混んでいる所を避けた案内を確かめられます。":
    "Load the graph (made in the graph editor) to check guidance that avoids crowds.",
  "「つなぎ」を開く": "Open “Links”",
  "{floor}が、グラフのどの階か決まっていません":
    "{floor} isn’t matched to a floor in the graph",
  "決めないと、お客さんの画面でこの階が正しく出ません。「つなぎ」の「階」で選んでください。":
    "Otherwise this floor won’t appear correctly on the visitors’ screen. Choose it under “Floors” in “Links”.",
  "「つなぎ」の階を開く": "Open floors in “Links”",
  "「{name}」の結び付け先が、グラフに見つかりません":
    "The link of “{name}” isn’t in the graph",
  "グラフが作り直された可能性があります。右の「くわしい設定」→「混雑とのつなぎ」で、ポイントを選び直してください。":
    "The graph may have been rebuilt. Choose the point again in “Advanced settings” → “Crowd link” on the right.",
  "グラフが作り直された可能性があります。右の「くわしい設定」→「混雑とのつなぎ」で、ルートを選び直してください。":
    "The graph may have been rebuilt. Choose the route again in “Advanced settings” → “Crowd link” on the right.",
  "混雑の情報を受け取れない場所が{n}か所あります":
    "{n} places can’t receive crowd info",
  "グラフの「{names}」などが、地図のどれとも結び付いていないため、そこが混んでも避けて案内できません。":
    "Graph points such as “{names}” aren’t linked to anything on the map, so guidance can’t avoid them when crowded.",
  結び付いていない場所の一覧を開く: "Open the list of unlinked places",
  "混雑の情報を受け取れない通路が{n}本あります":
    "{n} passages can’t receive crowd info",
  "グラフの「{names}」などの通路が、地図と結び付いていません。廊下に沿って範囲を描き、「つなぎ」でルートに結び付けると、混んだときに避けられます。":
    "Passages such as “{names}” aren’t linked to the map. Draw a zone along each corridor and link it to the route in “Links” so it can be avoided when crowded.",
  結び付いていない通路の一覧を開く: "Open the list of unlinked passages",
  グラフと地図を結び付ける: "Link the map to the graph",
  "グラフの階（グループ）": "Floor in the graph (group)",
  "決めないと、お客さんの画面でこの階が正しく出ません":
    "Otherwise this floor won’t appear correctly on the visitors’ screen",
  "お客さんの画面と同じ計算で、混んでいる所を避けて目的地へ誘導する道を出します。":
    "Shows the route that avoids crowded spots, calculated the same way as the visitors’ screen.",
  "お客さんの画面は、混雑の情報をグラフのポイント・ルートごとに受け取り、結び付いた地図の場所・範囲を避けて案内します。地図の物を選んでからここを開くと、その物に結び付けられます。":
    "The visitors’ screen receives crowd info per graph point/route and guides around the linked places and zones on the map. Select something on the map before opening this to link it.",
  "まだグラフがありません。グラフ編集で作ったグラフ（.json）を読み込んでください。":
    "No graph yet. Load a graph (.json) made in the graph editor.",
  "気になる所が{n}件あります。項目を押すと、直す場所へ移ります。":
    "{n} things to look at. Press an item to go where you can fix it.",
  直してください: "Fix this",
  "グラフ（グラフ編集で作ったもの）を読み込むと、この場所を混雑の情報と結び付けられます。結び付けた所が混んでいると、お客さんの画面ではそこを避けて案内します。":
    "Load the graph (made in the graph editor) to link this place to crowd info. When a linked place is crowded, the visitors’ screen guides around it.",
};
