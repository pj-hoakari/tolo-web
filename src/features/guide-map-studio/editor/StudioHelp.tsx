"use client";

import { ChevronRight, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";

// 会場マップ・スタジオの使い方（Q&A）。地図を作る人向けに、専門用語を使わず、画面に出ている言葉で説明する。
// 知りたいことを検索・カテゴリから探せる。「困ったとき」には、使っていてつまずきやすい点をまとめている。
type QA = { q: string; a: React.ReactNode; keywords?: string };
type Section = { title: string; items: QA[] };

const K = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-md border px-1 py-0.5 font-mono text-[11px]">
    {children}
  </kbd>
);
const B = ({ children }: { children: React.ReactNode }) => (
  <b className="font-medium text-foreground">{children}</b>
);

const SECTIONS: Section[] = [
  {
    title: "はじめに",
    items: [
      {
        q: "まず何をすればいい？",
        a: (
          <>
            地図は、<B>部屋を並べて</B>作ります。次の順に進めてください。
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                道具の <B>部屋・区画</B> を選び、地図の上を<B>ドラッグ</B>
                して部屋や売り場を置きます。
              </li>
              <li>
                右の <B>名前</B>{" "}
                に「受付」「101教室」などを入れます。名前を付けた場所が、お客さんの
                <B>目的地</B>になります。
              </li>
              <li>
                部屋どうしの<B>すき間が、お客さんの歩く道</B>
                になります。人が通れるくらい空けて並べてください。
              </li>
              <li>
                階がある建物は、道具の <B>階段・EV</B>{" "}
                で階段やエレベーターを置くと、階どうしがつながります。
              </li>
              <li>
                できたら <B>書き出す</B>{" "}
                を押します。行けない場所などがあれば、先に教えてくれます。
              </li>
            </ol>
            <span className="mt-2 block">
              できあがりの例を見たいときは、上の <B>見本</B> を押すと
              KCG本館（1F〜6F）の地図が出ます。見本はいま開いているタブの中身と入れ替わるので、作りかけの地図があるときは、先に{" "}
              <B>新規作成</B> で別のタブを開いてから押してください。
            </span>
          </>
        ),
        keywords: "はじめ 最初 作り方 手順 見本 テンプレート",
      },
      {
        q: "作った地図は保存される？",
        a: (
          <>
            はい。このブラウザの中に<B>自動で保存</B>
            されます。別のパソコンで続きを作るとき、ほかの人に渡すとき、お客さん向けの案内画面に載せるときは、
            <B>書き出す</B> でファイルに保存してください。そのファイルは{" "}
            <B>読み込む</B> で開けます。
          </>
        ),
        keywords: "保存 書き出す 読み込む ファイル",
      },
      {
        q: "案を2つ作って、いい方を選びたい（タブ・新規作成）",
        a: (
          <>
            上の <B>新規作成</B> か、タブの横の <B>＋</B> を押し、
            <B>建物（階あり）</B>か<B>会場（階なし）</B>
            を選ぶと、白紙のマップが新しいタブで開きます（いまのマップはそのまま残ります）。エクセルのシートのように、タブを押して切り替えられます。今のマップを元に別の案を作るときは、タブを
            <B>右クリック → 複製</B>。タブは<B>ダブルクリック</B>
            で名前を変えられ、<B>ドラッグ</B>で並べ替えられます。元に戻す（
            <K>⌘</K>+<K>Z</K>）はタブごとに別々です。
          </>
        ),
        keywords: "タブ シート 新規作成 案 比べる 複製 別ページ",
      },
      {
        q: "階のない会場（屋外など）を作りたい",
        a: (
          <>
            <B>新規作成</B> で <B>会場（階なし）</B>{" "}
            を選ぶと、「会場」という1つの階だけのマップで始まります。階段やエレベーターは置かなくてかまいません。お客さんの画面には、階の名前の所に「会場」と出ます。名前は右の設定の「フロア」欄で変えられます。あとで建物の中も作りたくなったら、階のタブの{" "}
            <B>＋</B> で階を足せます。
          </>
        ),
        keywords: "階なし 屋外 会場 お祭り 広場 1フロア 新規作成",
      },
      {
        q: "タブが2つ以上あるとき、どれが書き出される？",
        a: (
          <>
            <B>書き出す</B>{" "}
            を押すと、どのタブのマップを書き出すか聞かれるので、選んだ1つだけがファイルになります（ファイル名にタブの名前が入ります）。タブが1つだけのときは聞かずにそのまま書き出します。どちらがよいか迷うときは{" "}
            <B>見比べる</B> で並べて比べられます。
          </>
        ),
        keywords: "書き出す タブ 選ぶ どれ ファイル",
      },
      {
        q: "お客さんにはどんな画面で見える？",
        a: (
          <>
            地図の上の帯の <B>プレビュー</B>{" "}
            を押すと、お客さんから見たときの表示になります。説明を書いた場所をタップすると、その内容が出ます。
            <B>スマホ</B>{" "}
            を押すと、スマホの形の中に地図が出て、スマホでの見え方を確かめられます。グリッド（方眼）や選択の枠は、お客さんの画面には出ません。戻るときは「編集」です。
          </>
        ),
        keywords: "お客さん 見え方 プレビュー グリッド 方眼 スマホ 携帯",
      },
    ],
  },
  {
    title: "置く・書く",
    items: [
      {
        q: "地図をもっと広く使いたい",
        a: (
          <>
            右の設定は <B>{"\\"}</B>{" "}
            キー（または右の設定の右上のボタン）でしまえます。もう一度押すと出ます。右の設定は「
            <B>設定</B>」と「<B>誘導</B>
            」のタブに分かれていて、地図の物を選ぶと「設定」のタブに切り替わります。
          </>
        ),
        keywords: "広く 狭い 右の設定 しまう 隠す タブ 誘導",
      },
      {
        q: "道具はどこ？ 名前や色はどこで決める？",
        a: (
          <>
            <B>道具</B>
            は地図のすぐ左に縦に並んでいます（部屋・区画、範囲、目印など）。マウスを置くと使い方が出ます。キーでも選べます（
            <K>V</K> 選択・<K>R</K> 部屋・区画・<K>C</K> 丸い区画・<K>P</K>{" "}
            目印・<K>A</K> 範囲・<K>T</K> 文字・<K>E</K>{" "}
            階段・EV）。描いた物を選ぶと、右の設定のいちばん上に<B>名前</B>と
            <B>色</B>
            が出ます。位置・大きさ、形、固定、混雑とのつなぎは、その下の{" "}
            <B>くわしい設定</B> を開くと出ます。
          </>
        ),
        keywords: "道具 どこ 名前 色 設定 くわしい キー",
      },
      {
        q: "部屋や売り場（部屋・区画）を置くには？",
        a: (
          <>
            道具の <B>部屋・区画</B>（丸い形なら <B>丸い区画</B>
            ）を選び、地図の上で<B>ドラッグ</B>
            すると、その大きさで置けます。クリックだけなら決まった大きさで置かれます。部屋・区画どうしの
            <B>すき間が「歩ける道」</B>
            として道案内に使われます。部屋ではない場所（入口・案内所など）は{" "}
            <B>目印（ピン）</B> で置けます。
          </>
        ),
        keywords: "四角 丸 部屋 売り場 置く 追加",
      },
      {
        q: "名前・説明を付けるには？",
        a: (
          <>
            置いたものをクリックすると、右に設定が出ます。<B>名前</B>と
            <B>説明</B>
            を入れられます。説明は、書いたものだけがお客さんの画面でタップしたときに出ます。
          </>
        ),
        keywords: "名前 タイトル 説明",
      },
      {
        q: "色を変えるには？",
        a: (
          <>
            変えたいものを選んで、地図の左の道具の下にある<B>色</B>
            か、右の設定の色を押します。右クリックのメニューからも変えられます。いくつか選んでいれば、まとめて変わります。
          </>
        ),
        keywords: "色",
      },
      {
        q: "範囲とは？どう描く？",
        a: (
          <>
            「物販待機列」のように、ある範囲を囲んで分かりやすくするものです（いちばん下に描かれます）。道具の{" "}
            <B>範囲</B>{" "}
            を選んでドラッグすると、四角い範囲が描けます。角の点をドラッグすると、その角につながる辺ごと動いて大きさが変わります。
          </>
        ),
        keywords: "エリア 範囲 待機列",
      },
      {
        q: "道を通れなくする（通行止め）には？",
        a: (
          <>
            通れなくしたい所に範囲を描き、右の設定で <B>通行止め</B>{" "}
            にします。道案内はそこを避けた道を出します。
          </>
        ),
        keywords: "通行止め 混雑 避ける",
      },
      {
        q: "消すには？",
        a: (
          <>
            選んで <K>Delete</K> キー、または右クリック
            →「削除」です。間違えたら <K>⌘</K>+<K>Z</K> で元に戻せます。
          </>
        ),
        keywords: "削除 消す",
      },
    ],
  },
  {
    title: "選ぶ・動かす",
    items: [
      {
        q: "いくつかまとめて選ぶには？",
        a: (
          <>
            何もない所から<B>ドラッグ</B>して囲むか、<K>Shift</K>{" "}
            を押しながらクリックします（もう一度押すと外れます）。<K>⌘</K>+
            <K>A</K> で、その階の全部を選べます。
          </>
        ),
        keywords: "まとめて 選ぶ 複数 Shift",
      },
      {
        q: "動かすには？まとめて動かすには？",
        a: (
          <>
            ドラッグで動かします。いくつか選んでいれば、そのうち1つをドラッグすると全部一緒に動きます。矢印キーでも少しずつ動かせます（
            <K>Shift</K> で大きく）。
          </>
        ),
        keywords: "動かす 移動 矢印",
      },
      {
        q: "地図そのものを動かす・拡大するには？",
        a: (
          <>
            <K>⌘</K>（または <K>Space</K>
            ）を押しながらドラッグすると、地図をつかんで動かせます。拡大・縮小は{" "}
            <K>⌘</K>+マウスホイールか、地図の下の帯の ＋／－ です。
          </>
        ),
        keywords: "地図 動かす 拡大 縮小 ズーム",
      },
      {
        q: "選んでいるのを外すには？",
        a: (
          <>
            何もない所か、地図の外をクリックします。<K>Esc</K>{" "}
            でも外れます（右の設定で名前などを入力している途中でも外れます）。右の設定の見出しの横にある{" "}
            <B>選択を外す</B> でも外せます。
          </>
        ),
        keywords: "選択 外す 解除",
      },
      {
        q: "名前で場所を探すには？",
        a: (
          <>
            階のタブの右にある <B>名前で探す</B> に入力します（<K>⌘</K>+<K>F</K>{" "}
            でも入れます）。出てきた候補を押すと、その階に切り替わって、その場所が真ん中に出ます。
          </>
        ),
        keywords: "探す 検索 名前 見つける",
      },
      {
        q: "部屋の名前をまとめて確かめたい・直したい（一覧）",
        a: (
          <>
            上の <B>確かめる・共有</B> の <B>一覧</B>{" "}
            を押すと、部屋・区画、目印、範囲などが表になって並びます。名前と色はその場で直せます。階や名前で絞り込んだり、「名前がないものだけ」を出したりできます。
            <B>表示</B> を押すと、その場所へ移動します。
          </>
        ),
        keywords: "一覧 表 まとめて 名前 直す 確かめる リスト",
      },
      {
        q: "大きな会場で、いまどこを見ているか分からない（全体図）",
        a: (
          <>
            地図の右下の <B>全体図</B>
            （地図の中身がはみ出しているときに出ます）に、その階の全体と、いま見ている範囲（枠）が出ます。全体図を押したりドラッグしたりすると、その場所へ移動します。地図の下の帯の地図のボタンで出す・隠すを切り替えられます。
          </>
        ),
        keywords: "全体図 ミニマップ どこ 見失う 移動",
      },
      {
        q: "動かないように固定するには？",
        a: (
          <>
            選んで、右の設定の <B>固定する</B>{" "}
            を押します（右クリックからも選べます）。固定したものは、ドラッグしても動かず、消すこともできません。大きな範囲や壁を固定しておくと、その上のものを触るときに間違えて動かしません。外すときは、もう一度押して{" "}
            <B>固定を外す</B> です。
          </>
        ),
        keywords: "固定 ロック 動かない 鍵",
      },
    ],
  },
  {
    title: "大きさ・そろえる",
    items: [
      {
        q: "大きさを変えるには？",
        a: (
          <>
            選ぶと角に小さな四角が出ます。それをドラッグすると、縦長・横長も自由に変えられます。階段・エレベーターのマークも同じです。
          </>
        ),
        keywords: "大きさ サイズ 角",
      },
      {
        q: "きれいにそろえるには？",
        a: (
          <>
            動かしたり大きさを変えたりすると、ほかのものと
            <B>端・真ん中がそろう所</B>、<B>同じ大きさになる所</B>、
            <B>すき間が等しくなる所</B>
            で自動でピタッと止まり、線や数字が出ます。
          </>
        ),
        keywords: "そろえる 等間隔 ピタッと 線 数字",
      },
      {
        q: "いくつかを同じ大きさ・等間隔にするには？",
        a: (
          <>
            同じ大きさにするには、まとめて選んで右の「幅を統一」「高さを統一」「大きさを統一」を押します。等間隔にするには、動かしたり大きさを変えたりして、すき間に
            <B>同じ数字が2つ</B>出た所で離します。
          </>
        ),
        keywords: "同じ大きさ 等間隔",
      },
    ],
  },
  {
    title: "階・階段・エレベーター",
    items: [
      {
        q: "階を増やす・名前を変える・消すには？",
        a: (
          <>
            階のタブの横の <B>＋</B> で増やせます。タブを<B>ダブルクリック</B>
            すると名前を変えられます。タブを<B>右クリック</B>
            すると「名前を変更・複製・削除・左へ移動・右へ移動」が選べます。タブは
            <B>ドラッグ</B>でも並べ替えられます。
          </>
        ),
        keywords: "階 フロア 追加 名前 削除 複製 並べ替え",
      },
      {
        q: "位置を数字で確かめたい・合わせたい（座標・定規）",
        a: (
          <>
            地図の上と左に<B>定規</B>があり、地図の座標（左上が
            0）が目盛りで出ます。マウスの位置は地図の下の帯に「X 240 Y
            360」のように出て、部屋・区画を描いている間は大きさ（W・H）が出ます。選んでいるものの範囲は定規に色の帯で出ます。右の設定の{" "}
            <B>X・Y・W・H</B>{" "}
            に数字を入れると、その位置・大きさにぴったり合わせられます（X・Y
            は左上の位置）。上の階と同じ位置にしたいときは、同じ数字を入れてください。定規は地図の下の帯の定規のボタンで出す・隠すを切り替えられます。
          </>
        ),
        keywords: "座標 定規 位置 数字 X Y 幅 高さ 合わせる ぴったり 上下の階",
      },
      {
        q: "1F のものを 2F にコピーするには？",
        a: (
          <>
            コピーしたいものを選んで、右クリック
            →「2Fへコピー」か、右の「別の階へコピー」を押します。<B>同じ位置</B>
            にコピーされます。<K>⌘</K>+<K>C</K> で写して、2F を開いて <K>⌘</K>+
            <K>V</K> でも同じ位置に貼れます。
          </>
        ),
        keywords: "別の階 コピー 貼り付け",
      },
      {
        q: "階段・エレベーター・エスカレーターを置くには？",
        a: (
          <>
            道具の <B>階段・EV</B>{" "}
            を選び、種類（階段・エスカレーター・エレベーター）を選んで地図をクリックします。
            <B>全部の階の同じ位置</B>
            に置かれ、どの階で動かしても全部の階で一緒に動きます。
          </>
        ),
        keywords: "階段 エレベーター エスカレーター 置く",
      },
      {
        q: "描いた部屋・区画をエレベーターにしたい",
        a: (
          <>
            その部屋・区画を選んで、右の「エレベーターにする」（または階段・エスカレーター）を押します。
          </>
        ),
        keywords: "四角 エレベーター 変える",
      },
    ],
  },
  {
    title: "混雑を避けて誘導する",
    items: [
      {
        q: "お客さんの画面では、どう案内される？",
        a: (
          <>
            お客さんは、自分の<B>現在地</B>（読み取った QR
            コードの場所）から、検索した<B>目的地</B>
            へ案内されます。そのとき、会場の<B>混雑の情報</B>を見て、
            <B>混んでいる所を避けた道</B>
            を出し、危険な所は通りません。混雑が変わると道も変わります。スタジオでは、右の{" "}
            <B>混雑を避けて誘導（プレビュー）</B> で、同じ計算の道を試せます。
          </>
        ),
        keywords: "お客さん 案内 誘導 混雑 避ける 現在地 目的地 QR",
      },
      {
        q: "混雑を避けた案内を試すには？",
        a: (
          <>
            右の <B>混雑を避けて誘導（プレビュー）</B>{" "}
            で「現在地」と「目的地」を選びます。次に <B>混雑を試す</B>{" "}
            で度合い（中・高・危険）を選び、<B>階段・エレベーターの表</B>
            のマスを押すと、その台のその階が混みます（台の名前を押すとその台の全部の階、階を押すとその階の全部の台）。すると、混雑を避けた道（オレンジ）と、混雑が無いときの道（灰色の点線）が地図に出ます。混雑させた所は地図に色で出ます。
            <B>リセット</B>{" "}
            で目的地と混雑の試しを外せます（現在地は地図に保存されるので残ります）。
          </>
        ),
        keywords: "混雑 試す プレビュー 避ける 道 リセット",
      },
      {
        q: "混雑を避けられるようにするには？（つなぎ）",
        a: (
          <>
            お客さんの画面は、混雑の情報を<B>グラフのポイント・ルートごと</B>
            に受け取ります。地図の場所・範囲がそのポイント・ルートに
            <B>結び付いていないと、混んでいても避けられません</B>。上の{" "}
            <B>確かめる・共有</B> の <B>つなぎ</B>{" "}
            でグラフ（グラフ編集で作ったもの）を読み込み、地図の物を選んでから「選んでいる物に結び付ける」を押してください。廊下などの通路は、通路に沿って{" "}
            <B>範囲</B> を描き、ルートに結び付けます。結び付いていないものは{" "}
            <B>チェック</B> でも分かります。
          </>
        ),
        keywords:
          "つなぎ グラフ ポイント ルート 結び付け 混雑 避けられない 通路 廊下",
      },
    ],
  },
  {
    title: "仕上げ・共有",
    items: [
      {
        q: "お客さんに出す前に、まちがいが無いか確かめたい",
        a: (
          <>
            上の <B>確かめる・共有</B> の <B>チェック</B> を押すと、
            <B>行けない場所</B>・<B>ほかの階とつながっていない階段</B>・
            <B>階段もエレベーターも無い階</B>・<B>名前のない場所</B>・
            <B>重なっている部屋・区画</B>
            などを探して一覧にします。項目を押すと、その場所を表示します。
            <B>書き出す</B> ときも自動でチェックし、<B>要確認</B>
            の所があるときだけ一覧が出ます（「このまま書き出す」も選べます）。「念のため」の項目は{" "}
            <B>チェック</B> ボタンで見られます。
          </>
        ),
        keywords: "チェック 確認 まちがい 行けない 書き出す前",
      },
      {
        q: "2つの案を並べて見比べたい",
        a: (
          <>
            タブが2つ以上あるとき、上の <B>確かめる・共有</B> の <B>見比べる</B>{" "}
            を押すと、2つのタブの地図が左右に並びます。左右それぞれで見るタブを選べて、階を切り替えると両方いっしょに変わります。よい方が決まったら、その側の{" "}
            <B>これを書き出す</B> で書き出せます。
          </>
        ),
        keywords: "見比べる 比較 並べる 案 タブ",
      },
      {
        q: "地図を画像にしたい／紙に印刷したい",
        a: (
          <>
            上の <B>確かめる・共有</B> の <B>画像で保存</B> から、
            <B>この階だけ</B>か<B>全部の階</B>
            （階ごとに1枚ずつ）かを選べます。画像（PNG）なので資料に貼るときに便利です。全部の階のとき、ブラウザに「複数のファイルのダウンロード」を聞かれたら「許可」を選んでください。
            <B>印刷</B> は、全部の階を1ページずつ印刷します。印刷の画面で「PDF
            に保存」を選ぶと PDF にもできます。
          </>
        ),
        keywords: "画像 PNG 印刷 PDF 紙 資料",
      },
    ],
  },
  {
    title: "困ったとき",
    items: [
      {
        q: "作った地図が消えた／別のパソコンで続きを作りたい",
        a: (
          <>
            地図は<B>このパソコンの、このブラウザの中にだけ</B>
            保存されています。別のパソコンや別のブラウザ、シークレットウィンドウでは見えません。ブラウザの履歴やデータを消すと、地図も消えます。区切りのいい所で{" "}
            <B>書き出す</B> を押してファイルに保存しておき、続きを作るときは{" "}
            <B>読み込む</B> で開いてください。
          </>
        ),
        keywords: "消えた 保存 別のパソコン バックアップ 書き出す",
      },
      {
        q: "「見本」で作っていた地図が置き換わった／「読み込む」でタブが増えた",
        a: (
          <>
            <B>見本</B> は、いま表示しているタブの中身を置き換えます。直後なら{" "}
            <K>⌘</K>+<K>Z</K> で戻せます。残したい地図があるときは、先に{" "}
            <B>新規作成</B> で白紙のタブを開いてから見本を押してください。
            <B>読み込む</B>{" "}
            は、作っていた地図を消さないように、いまのタブに何か描いてあるときは
            <B>新しいタブ</B>で開きます。いらないタブは<B>右クリック → 削除</B>
            で消せます。
          </>
        ),
        keywords: "見本 読み込む 置き換わった タブ 増えた 戻す",
      },
      {
        q: "タブを消してしまった",
        a: (
          <>
            消した直後に画面の下に出る <B>元に戻す</B>{" "}
            を押すと、元の位置に戻ります（8秒ほどで消えます）。<K>⌘</K>+<K>Z</K>{" "}
            では戻せないので、大事な案は <B>書き出す</B>{" "}
            でファイルにも保存しておくと安心です。
          </>
        ),
        keywords: "タブ 削除 消えた 戻せない",
      },
      {
        q: "ドラッグしても動かない／消せない",
        a: (
          <>
            右上に鍵のマークが付いているものは<B>固定</B>
            されています。選んで、右の設定の <B>固定中（押すと外す）</B>{" "}
            を押してください。
          </>
        ),
        keywords: "動かない 消せない 固定 ロック 鍵",
      },
      {
        q: "プレビューで「経路が見つかりません」と出る",
        a: (
          <ul className="list-disc space-y-1 pl-4">
            <li>
              部屋・区画どうしの<B>すき間が狭すぎる</B>
              と通れません。グリッドの細い線1マス分ぐらいはあけてください。
            </li>
            <li>
              通路を部屋・区画や「通行止め」の範囲でふさいでいないか確かめてください。
            </li>
            <li>
              出発と目的地を囲む範囲があると、道案内はその
              <B>範囲の外には出ません</B>
              。建物全体を囲むように、範囲を大きく描いてください。
            </li>
            <li>
              別の階どうしのときは、その階に階段やエレベーターがあるか（「未接続」になっていないか）、エスカレーターの向きが合っているかを見てください。
            </li>
          </ul>
        ),
        keywords: "経路が見つかりません 通れない 道案内 出ない",
      },
      {
        q: "現在地・目的地の一覧に、部屋が出てこない",
        a: (
          <>
            一覧に出るのは<B>名前のある場所</B>
            だけです（お客さんの画面と同じ）。その部屋を選んで、右の設定で名前を入れてください。グラフのポイントに結び付いていれば、ポイントの名前が使われます。階段・エレベーターは一覧に出ません。
          </>
        ),
        keywords: "一覧 出てこない 現在地 目的地 名前",
      },
      {
        q: "ドラッグしたら、地図が動かずに四角い枠が出る",
        a: (
          <>
            何もない所のドラッグは「まとめて選ぶ」になっています。地図を動かしたいときは、
            <K>⌘</K>（または <K>Space</K>）を押しながらドラッグしてください。
          </>
        ),
        keywords: "動かない 枠 ドラッグ 地図",
      },
      {
        q: "地図がどこかへ行ってしまった／小さくなりすぎた",
        a: (
          <>
            地図の下の帯の <B>全体を表示</B>
            （四隅の矢印のボタン）を押すと、その階の地図がぴったり収まります。「100%」などの数字を押すと、元の大きさに戻ります。
          </>
        ),
        keywords: "見失った 小さい 大きい 元に戻す 100% 全体 見えない",
      },
      {
        q: "案を試す前の状態を残しておきたい（保存ポイント）",
        a: (
          <>
            上の <B>保存ポイント</B>{" "}
            を押し、名前（例：「案A」「入口を広げる前」）を入れて{" "}
            <B>いまの状態を保存</B> を押します。<K>⌘</K>+<K>S</K>{" "}
            でも名前なしですぐ保存できます。名前はあとから一覧の名前（鉛筆のマーク）を押して付け直せます。保存ポイントはタブごとに残り、ページを開き直しても使えます（このブラウザの中だけ）。
          </>
        ),
        keywords: "保存ポイント 残す 保存 スナップショット 履歴 ⌘S 案",
      },
      {
        q: "保存ポイントの状態に戻したい／いらない保存ポイントを消したい",
        a: (
          <>
            <B>保存ポイント</B> を開き、戻したいものの <B>この状態に戻す</B>{" "}
            を押すと確認が出ます。いまの地図も残したいときは{" "}
            <B>保存してから戻す</B>、残さなくてよいときは <B>保存せずに戻す</B>{" "}
            です（戻した直後なら ⌘Z
            でも取り消せます）。いまの地図はそのままで見比べたいときは{" "}
            <B>新しいタブで開く</B>。いらない保存ポイントは、ごみ箱のボタン →{" "}
            <B>削除する</B> で消せます（消すと戻せません）。
          </>
        ),
        keywords: "保存ポイント 戻す 前の状態 開き直す 削除 消す 履歴",
      },
      {
        q: "思った所に置けない（勝手に吸い付く）",
        a: (
          <>
            ほかのものとそろう所で、自動でピタッと止まるようになっています。止めたくないときは{" "}
            <K>Option</K>{" "}
            を押しながら動かしてください。位置はグリッドの刻みでそろいます。
          </>
        ),
        keywords: "吸い付く ずれる 置けない Option",
      },
      {
        q: "⌘Z（元に戻す）が効かない",
        a: (
          <>
            名前や説明の欄に文字を入力しているあいだは、入力した文字のほうが戻ります。地図の何もない所をクリックしてから押してください。ページを開き直すと
            ⌘Z では戻れないので、大事な所では <B>保存ポイント</B>（<K>⌘</K>+
            <K>S</K>）を作っておくと、あとでその状態に戻せます。
          </>
        ),
        keywords: "元に戻す 効かない ⌘Z",
      },
      {
        q: "範囲の中のものが選べない／範囲が選べない",
        a: (
          <>
            範囲の中に置いた部屋・区画などは、そのままクリックで選べます。範囲そのものを選ぶときは、範囲の中の何もない所をクリックするか、枠の線や名前をクリックしてください（ドラッグすると「まとめて選ぶ」になります）。
          </>
        ),
        keywords: "エリア 選べない",
      },
      {
        q: "階段を消したら、ほかの階からも消えた",
        a: (
          <>
            階段・エレベーターは、全部の階で1つのものとして扱っています。ある階だけから外したいときは、消さずに、右の設定の「つながる階」でその階のチェックを外してください。
          </>
        ),
        keywords: "階段 消えた ほかの階 つながる階",
      },
      {
        q: "エスカレーターが逆向きに案内される",
        a: (
          <>
            上り・下りは、<B>階のタブの左が下の階、右が上の階</B>
            として判断しています。タブを 1F → 2F → 3F
            の順に並べ、エスカレーターの設定で「向き」を確かめてください。
          </>
        ),
        keywords: "エスカレーター 逆 向き 上り 下り",
      },
      {
        q: "英語に切り替えても、部屋の名前が日本語のまま",
        a: (
          <>
            切り替わるのは画面のボタンや説明だけで、部屋や階の名前は入力した文字のまま表示されます。
          </>
        ),
        keywords: "英語 名前 日本語 切り替え",
      },
    ],
  },
  {
    title: "キー操作",
    items: [
      {
        q: "使えるキー操作の一覧",
        a: (
          <ul className="space-y-1">
            <li>
              <K>⌘</K>+<K>Z</K> 元に戻す ／ <K>⌘</K>+<K>Shift</K>+<K>Z</K>{" "}
              やり直し
            </li>
            <li>
              <K>⌘</K>+<K>C</K> コピー ／ <K>⌘</K>+<K>V</K> 貼り付け ／ <K>⌘</K>
              +<K>X</K> 切り取り
            </li>
            <li>
              <K>⌘</K>+<K>D</K> 複製 ／ <K>⌘</K>+<K>A</K> この階を全部選ぶ
            </li>
            <li>
              <K>Delete</K> 削除 ／ <K>Esc</K> 選択を外す ／ 矢印キー 少し動かす
            </li>
            <li>
              <K>⌘</K> か <K>Space</K> を押しながらドラッグ 地図を動かす
            </li>
            <li>
              <K>Shift</K>+クリック 選ぶものを足す ／ <K>Option</K>+ドラッグ
              そろえずに動かす
            </li>
            <li>
              <K>⌘</K>+<K>F</K> 名前で探す ／ <K>⌘</K>+<K>S</K>{" "}
              保存ポイントを作る
            </li>
            <li>
              <K>V</K> 選択 ／ <K>R</K> 部屋・区画 ／ <K>C</K> 丸い区画 ／{" "}
              <K>P</K> 目印 ／ <K>A</K> 範囲 ／ <K>T</K> 文字 ／ <K>E</K>{" "}
              階段・EV
            </li>
          </ul>
        ),
        keywords: "キー ショートカット 元に戻す コピー 貼り付け",
      },
    ],
  },
];

// 英語版（日本語版と同じ並び・同じ内容）
const SECTIONS_EN: Section[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "Where do I start?",
        a: (
          <>
            You build a map by <B>laying out rooms</B>. Go in this order:
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Choose the <B>Room</B> tool and <B>drag</B> on the map to place
                rooms and shops.
              </li>
              <li>
                Type a <B>Name</B> on the right, such as “Reception” or “Room
                101”. Named places become visitors’ <B>destinations</B>.
              </li>
              <li>
                The <B>gaps between rooms are the paths</B> visitors walk. Leave
                enough space for people to pass.
              </li>
              <li>
                In a building with floors, place stairs and elevators with the{" "}
                <B>Stairs/EV</B> tool to connect the floors.
              </li>
              <li>
                When you’re done, press <B>Export</B>. If there are problems,
                such as places that can’t be reached, it tells you first.
              </li>
            </ol>
            <span className="mt-2 block">
              To see a finished example, press <B>Sample</B> at the top to show
              the KCG main building (1F–6F). The sample replaces the contents of
              the current tab, so if you have a map in progress, open another
              tab with <B>New</B> first.
            </span>
          </>
        ),
        keywords: "start begin how to steps sample template",
      },
      {
        q: "Is my map saved?",
        a: (
          <>
            Yes. It is <B>saved automatically</B> in this browser. To continue
            on another computer, share it with someone, or publish it on the
            visitor guide screen, save it as a file with <B>Export</B>. You can
            open that file with <B>Import</B>.
          </>
        ),
        keywords: "save export import file",
      },
      {
        q: "I want to make two versions and pick the better one (tabs, New)",
        a: (
          <>
            Press <B>New</B> at the top or <B>+</B> next to the tabs, then
            choose <B>Building (with floors)</B> or <B>Venue (no floors)</B> to
            open a blank map in a new tab (your current map stays). Switch
            between them by clicking the tabs, like sheets in Excel. To base a
            new version on the current map,{" "}
            <B>right-click the tab → Duplicate</B>. <B>Double-click</B> a tab to
            rename it and <B>drag</B> to reorder. Undo (<K>⌘</K>+<K>Z</K>) is
            separate for each tab.
          </>
        ),
        keywords: "tabs sheets new version compare duplicate page",
      },
      {
        q: "I want to make a venue without floors (outdoors, etc.)",
        a: (
          <>
            Choose <B>Venue (no floors)</B> in <B>New</B> to start with a single
            floor named “Venue”. You don’t need stairs or elevators. On the
            visitors’ screen, “Venue” appears where the floor name goes. Rename
            it in the “Floor” section on the right. If you later want to map
            inside a building, add floors with <B>+</B> on the floor tabs.
          </>
        ),
        keywords: "no floors outdoor venue festival plaza single new",
      },
      {
        q: "With two or more tabs, which one is exported?",
        a: (
          <>
            When you press <B>Export</B>, you are asked which tab’s map to
            export, and only that one is saved as a file (the tab name is
            included in the file name). With only one tab, it exports right away
            without asking. If you can’t decide, put them side by side with{" "}
            <B>Compare</B>.
          </>
        ),
        keywords: "export tab choose which file",
      },
      {
        q: "What will visitors see?",
        a: (
          <>
            Press <B>Preview</B> in the bar above the map to see it as visitors
            do. Tapping a place with a description shows it. Press <B>Phone</B>{" "}
            to show the map inside a smartphone frame and check how it looks on
            a phone. The grid and selection outlines are not shown to visitors.
            Press “Edit” to go back.
          </>
        ),
        keywords: "visitors preview grid phone smartphone mobile",
      },
    ],
  },
  {
    title: "Placing & writing",
    items: [
      {
        q: "I want more room for the map",
        a: (
          <>
            Hide the side panel with the <B>{"\\"}</B> key (or the button at its
            top right); press again to show it. The side panel has{" "}
            <B>Settings</B> and <B>Guidance</B> tabs, and switches to Settings
            when you select something on the map.
          </>
        ),
        keywords: "more room bigger side panel hide tabs guidance",
      },
      {
        q: "Where are the tools? Where do I set names and colors?",
        a: (
          <>
            The <B>tools</B> are stacked just left of the map (Room, Zone,
            Marker, etc.). Hover to see how to use each. You can also pick them
            with keys (<K>V</K> Select, <K>R</K> Room, <K>C</K> Round room,{" "}
            <K>P</K> Marker, <K>A</K> Zone, <K>T</K> Text, <K>E</K> Stairs/EV).
            Select something you drew and its <B>name</B> and <B>color</B>{" "}
            appear at the top of the settings on the right. Position & size,
            shape, lock and crowd links are under <B>Advanced settings</B>{" "}
            below.
          </>
        ),
        keywords: "tools where name color settings advanced keys",
      },
      {
        q: "How do I place rooms or shops?",
        a: (
          <>
            Choose the <B>Room</B> tool (or <B>Round room</B> for round ones)
            and <B>drag</B> on the map to place it at that size. A single click
            places it at a default size. The{" "}
            <B>gaps between rooms are the walkways</B> used for directions.
            Places that aren’t rooms (entrances, info desks, etc.) can be placed
            with <B>Marker</B>.
          </>
        ),
        keywords: "rectangle circle room shop place add",
      },
      {
        q: "How do I add a name or description?",
        a: (
          <>
            Click something you placed and its settings appear on the right. You
            can enter a <B>Name</B> and <B>Description</B>. A description is
            shown only if you write one, when visitors tap the place.
          </>
        ),
        keywords: "name title description",
      },
      {
        q: "How do I change the color?",
        a: (
          <>
            Select it and press a <B>color</B> under the tools on the left of
            the map, or a color in the settings on the right. You can also use
            the right-click menu. If several things are selected, they all
            change.
          </>
        ),
        keywords: "color",
      },
      {
        q: "What is a zone, and how do I draw one?",
        a: (
          <>
            A zone outlines a region to make it easy to see, like a “merch
            queue” (it is drawn underneath everything). Choose the <B>Zone</B>{" "}
            tool and drag to draw a rectangular region. Drag a corner point to
            resize it; the edges connected to that corner move with it.
          </>
        ),
        keywords: "area region queue",
      },
      {
        q: "How do I block a way (close it)?",
        a: (
          <>
            Draw a zone over the place you want to block and turn on{" "}
            <B>Closed</B> in its settings. Directions will take a way around it.
          </>
        ),
        keywords: "closed block congestion avoid",
      },
      {
        q: "How do I delete something?",
        a: (
          <>
            Select it and press <K>Delete</K>, or right-click → “Delete”. If you
            make a mistake, undo with <K>⌘</K>+<K>Z</K>.
          </>
        ),
        keywords: "delete remove",
      },
    ],
  },
  {
    title: "Selecting & moving",
    items: [
      {
        q: "How do I select several things?",
        a: (
          <>
            <B>Drag</B> from an empty spot to draw a box around them, or hold{" "}
            <K>Shift</K> and click (click again to remove). <K>⌘</K>+<K>A</K>{" "}
            selects everything on the floor.
          </>
        ),
        keywords: "several select multiple shift",
      },
      {
        q: "How do I move things, or several at once?",
        a: (
          <>
            Drag to move. If several are selected, dragging one moves them all.
            The arrow keys nudge them too (<K>Shift</K> for bigger steps).
          </>
        ),
        keywords: "move drag arrow",
      },
      {
        q: "How do I move or zoom the map itself?",
        a: (
          <>
            Hold <K>⌘</K> (or <K>Space</K>) and drag to grab and move the map.
            Zoom with <K>⌘</K>+mouse wheel, or the + / − buttons in the bar
            below the map.
          </>
        ),
        keywords: "map move zoom",
      },
      {
        q: "How do I deselect?",
        a: (
          <>
            Click an empty spot or outside the map. <K>Esc</K> also clears the
            selection (even while typing a name in the settings on the right).
            You can also press <B>Deselect</B> next to the heading of the
            settings.
          </>
        ),
        keywords: "deselect clear",
      },
      {
        q: "How do I find a place by name?",
        a: (
          <>
            Type in <B>Find by name</B> to the right of the floor tabs (or press{" "}
            <K>⌘</K>+<K>F</K>). Press a result to switch to that floor and bring
            the place to the center.
          </>
        ),
        keywords: "find search name",
      },
      {
        q: "I want to check or fix room names all at once (list)",
        a: (
          <>
            Press <B>List</B> in <B>Check &amp; share</B> at the top to see
            rooms, markers, zones and more in a table. You can edit names and
            colors right there, filter by floor or name, or show only items
            without a name. Press <B>Show</B> to go to that place.
          </>
        ),
        keywords: "list table names edit check all",
      },
      {
        q: "In a large venue I can’t tell where I am (overview map)",
        a: (
          <>
            The <B>overview map</B> at the bottom right of the map (shown when
            the map doesn’t fit) shows the whole floor and the area you’re
            viewing (frame). Press or drag on it to move there. Show or hide it
            with the map button in the bar below the map.
          </>
        ),
        keywords: "overview minimap where lost navigate",
      },
      {
        q: "How do I lock something so it doesn’t move?",
        a: (
          <>
            Select it and press <B>Lock</B> in the settings on the right (also
            in the right-click menu). Locked things can’t be dragged or deleted.
            Locking large areas or walls keeps you from moving them by mistake
            while working on things on top. Press it again to <B>Unlock</B>.
          </>
        ),
        keywords: "lock fixed prevent moving",
      },
    ],
  },
  {
    title: "Size & alignment",
    items: [
      {
        q: "How do I resize?",
        a: (
          <>
            When selected, small squares appear on the corners. Drag them to
            make it taller or wider. Stairs and elevator marks work the same
            way.
          </>
        ),
        keywords: "size resize corner",
      },
      {
        q: "How do I line things up neatly?",
        a: (
          <>
            When you move or resize, it snaps where{" "}
            <B>edges or centers line up</B> with other things, where the{" "}
            <B>size matches</B>, or where the <B>gaps are equal</B>, and shows
            lines and numbers.
          </>
        ),
        keywords: "align snap equal spacing lines numbers",
      },
      {
        q: "How do I make several the same size or evenly spaced?",
        a: (
          <>
            For the same size, select them and press “Same width”, “Same height”
            or “Same size” on the right. For even spacing, move or resize until{" "}
            <B>two matching numbers</B> appear in the gaps, then let go.
          </>
        ),
        keywords: "same size even spacing",
      },
    ],
  },
  {
    title: "Floors, stairs & elevators",
    items: [
      {
        q: "How do I add, rename or delete floors?",
        a: (
          <>
            Add floors with <B>+</B> next to the floor tabs. <B>Double-click</B>{" "}
            a tab to rename it. <B>Right-click</B> a tab for “Rename / Duplicate
            / Delete / Move left / Move right”. You can also reorder tabs by{" "}
            <B>dragging</B>.
          </>
        ),
        keywords: "floor add rename delete duplicate reorder",
      },
      {
        q: "I want to check or set positions with numbers (coordinates, rulers)",
        a: (
          <>
            The <B>rulers</B> on the top and left of the map show map
            coordinates (0 at the top left). The mouse position appears in the
            bar below the map like “X 240 Y 360”, and the size (W, H) while you
            draw a room. The selected item’s range shows as a colored band on
            the rulers. Enter numbers in <B>X, Y, W, H</B> in the settings on
            the right to set the exact position and size (X, Y are the top-left
            corner). To match a position on another floor, enter the same
            numbers. Show or hide the rulers with the ruler button in the bar
            below the map.
          </>
        ),
        keywords: "coordinates ruler position numbers x y width height align",
      },
      {
        q: "How do I copy things from 1F to 2F?",
        a: (
          <>
            Select them and right-click → “Copy to 2F”, or press “Copy to
            another floor” on the right. They are copied to the{" "}
            <B>same position</B>. You can also copy with <K>⌘</K>+<K>C</K>, open
            2F and paste with <K>⌘</K>+<K>V</K>.
          </>
        ),
        keywords: "copy another floor paste",
      },
      {
        q: "How do I place stairs, elevators or escalators?",
        a: (
          <>
            Choose the <B>Stairs/EV</B> tool, pick the type (stairs, escalator
            or elevator) and click the map. It is placed at{" "}
            <B>the same spot on every floor</B>, and moving it on one floor
            moves it on all floors.
          </>
        ),
        keywords: "stairs elevator escalator place",
      },
      {
        q: "I want to turn a room I drew into an elevator",
        a: (
          <>
            Select the room and press “Make it Elevator” (or Stairs / Escalator)
            on the right.
          </>
        ),
        keywords: "rectangle elevator convert",
      },
    ],
  },
  {
    title: "Crowd-avoiding guidance",
    items: [
      {
        q: "How are visitors guided on their screen?",
        a: (
          <>
            Visitors are guided from their <B>current location</B> (where they
            scanned the QR code) to the <B>destination</B> they search for.
            Using the venue’s <B>crowd info</B>, the route{" "}
            <B>avoids crowded spots</B> and never passes dangerous ones. When
            crowds change, the route changes too. In the studio, try the same
            calculation with <B>Crowd-avoiding guidance (preview)</B> on the
            right.
          </>
        ),
        keywords:
          "visitors guidance crowd avoid current location destination qr",
      },
      {
        q: "How do I try crowd-avoiding guidance?",
        a: (
          <>
            In <B>Crowd-avoiding guidance (preview)</B> on the right, choose the
            current location and destination. Then in <B>Try congestion</B>,
            pick a level (medium/high/danger), then press cells in the{" "}
            <B>stairs & elevators table</B> to crowd that car on that floor
            (press a car’s name for all its floors, or a floor for every car on
            it). The crowd-avoiding route (orange) and the route without crowds
            (gray dotted) appear on the map, and crowded spots are colored.{" "}
            <B>Reset</B> clears the destination and trials (the current location
            stays, since it’s saved in the map).
          </>
        ),
        keywords: "crowd try preview avoid route reset",
      },
      {
        q: "How do I make crowds avoidable? (links)",
        a: (
          <>
            The visitors’ screen receives crowd info{" "}
            <B>per graph point/route</B>. If places and zones on the map{" "}
            <B>aren’t linked</B> to them, crowds there <B>can’t be avoided</B>.
            Load the graph (made in the graph editor) in <B>Links</B> (under{" "}
            <B>Check &amp; share</B> at the top), select something on the map,
            and press “Link to selected”. For corridors, draw a <B>zone</B>{" "}
            along the passage and link it to a route. <B>Check</B> also lists
            what isn’t linked.
          </>
        ),
        keywords: "links graph point route crowd avoid corridor",
      },
    ],
  },
  {
    title: "Finishing & sharing",
    items: [
      {
        q: "I want to check for mistakes before showing it to visitors",
        a: (
          <>
            Press <B>Check</B> in <B>Check &amp; share</B> at the top to list{" "}
            <B>unreachable places</B>, <B>stairs not linked to other floors</B>,{" "}
            <B>floors with no stairs or elevator</B>,{" "}
            <B>places without names</B>, <B>overlapping rooms</B> and more.
            Press an item to show it. <B>Export</B> also checks automatically
            and shows the list only when something is marked <B>Check</B> (you
            can still choose “Export anyway”). “FYI” items are shown with the{" "}
            <B>Check</B> button.
          </>
        ),
        keywords: "check mistakes unreachable before export",
      },
      {
        q: "I want to compare two versions side by side",
        a: (
          <>
            With two or more tabs, press <B>Compare</B> in{" "}
            <B>Check &amp; share</B> at the top to show two tabs’ maps side by
            side. Choose a tab on each side; switching floors changes both. Once
            you decide, press <B>Export this</B> on that side.
          </>
        ),
        keywords: "compare side by side versions tabs",
      },
      {
        q: "I want the map as an image / on paper",
        a: (
          <>
            Under <B>Save image</B> in <B>Check &amp; share</B>, choose{" "}
            <B>This floor only</B> or <B>All floors</B> (one PNG per floor),
            handy for documents. For all floors, if the browser asks about
            downloading multiple files, choose “Allow”. <B>Print</B> prints
            every floor, one per page. Choose “Save as PDF” in the print dialog
            to make a PDF.
          </>
        ),
        keywords: "image png print pdf paper",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "My map disappeared / I want to continue on another computer",
        a: (
          <>
            The map is saved <B>only in this browser on this computer</B>. It
            isn’t visible on another computer, another browser or a private
            window, and clearing the browser’s history or data deletes it too.
            Press <B>Export</B> now and then to save a file, and open it with{" "}
            <B>Import</B> to continue.
          </>
        ),
        keywords: "disappeared lost save another computer backup export",
      },
      {
        q: "“Sample” replaced my map / “Import” added a tab",
        a: (
          <>
            <B>Sample</B> replaces the map in the current tab. Right after, you
            can undo with <K>⌘</K>+<K>Z</K>. To keep your map, open a blank tab
            with <B>New</B> first, then press Sample. <B>Import</B> opens the
            file in a <B>new tab</B> if the current tab has anything on it, so
            your work isn’t lost. Remove tabs you don’t need with{" "}
            <B>right-click → Delete</B>.
          </>
        ),
        keywords: "sample import replaced tab added undo",
      },
      {
        q: "I deleted a tab by mistake",
        a: (
          <>
            Right after deleting, press <B>Undo</B> at the bottom of the screen
            to put it back (it disappears after about 8 seconds). <K>⌘</K>+
            <K>Z</K> doesn’t bring tabs back, so also save important versions
            with <B>Export</B>.
          </>
        ),
        keywords: "tab deleted lost undo",
      },
      {
        q: "It won’t move / can’t be deleted",
        a: (
          <>
            Things with a lock mark at the top right are <B>locked</B>. Select
            it and press <B>Locked (press to unlock)</B> in the settings on the
            right.
          </>
        ),
        keywords: "won't move cannot delete locked",
      },
      {
        q: "The preview says “No route found”",
        a: (
          <ul className="list-disc space-y-1 pl-4">
            <li>
              If the <B>gaps between shapes are too narrow</B>, no one can pass.
              Leave at least one small grid square between them.
            </li>
            <li>Check that no room or “Closed” zone blocks the passage.</li>
            <li>
              If a zone surrounds both the start and the destination, directions{" "}
              <B>never leave that zone</B>. Draw the zone big enough to cover
              the whole building.
            </li>
            <li>
              Across floors, check that the floor has stairs or an elevator (not
              “Not linked”) and that escalators run the right way.
            </li>
          </ul>
        ),
        keywords: "no route found cannot pass directions",
      },
      {
        q: "A room doesn’t appear in the current location / destination list",
        a: (
          <>
            Only <B>named places</B> appear (same as the visitors’ screen).
            Select the room and enter a name on the right. If it’s linked to a
            graph point, the point’s name is used. Stairs and elevators don’t
            appear.
          </>
        ),
        keywords: "list missing current location destination name",
      },
      {
        q: "Dragging draws a box instead of moving the map",
        a: (
          <>
            Dragging on an empty spot selects several things. To move the map,
            hold <K>⌘</K> (or <K>Space</K>) while dragging.
          </>
        ),
        keywords: "box drag map not moving",
      },
      {
        q: "I lost the map / it got too small",
        a: (
          <>
            Press <B>Fit to view</B> (the four-arrow button) in the bar below
            the map to fit the whole floor. Press the percentage (such as
            “100%”) to return to normal size.
          </>
        ),
        keywords: "lost small zoom reset 100% fit view",
      },
      {
        q: "I want to keep the state before trying an idea (save points)",
        a: (
          <>
            Press <B>Save points</B> at the top, enter a name (e.g. “Plan A”,
            “before widening the entrance”) and press <B>Save current state</B>.{" "}
            <K>⌘</K>+<K>S</K> saves right away without a name; you can name it
            later by clicking its name (pencil icon) in the list. Save points
            are kept per tab and remain after reopening the page (in this
            browser only).
          </>
        ),
        keywords: "save point snapshot history keep ⌘S version",
      },
      {
        q: "I want to go back to a save point / delete save points",
        a: (
          <>
            Open <B>Save points</B> and press <B>Restore</B> on the one you
            want; a confirmation appears. To keep your current map too, choose{" "}
            <B>Save, then restore</B>; otherwise <B>Restore without saving</B>{" "}
            (right after, ⌘Z also undoes it). To compare while keeping your
            current map, use <B>Open in new tab</B>. Delete save points you
            don’t need with the trash button → <B>Delete</B> (this can’t be
            undone).
          </>
        ),
        keywords: "save point restore earlier state reopen delete history",
      },
      {
        q: "I can’t put it exactly where I want (it snaps)",
        a: (
          <>
            Things snap where they line up with others. Hold <K>Option</K> while
            moving to turn that off. Positions still follow the grid steps.
          </>
        ),
        keywords: "snap stuck position option",
      },
      {
        q: "⌘Z (undo) doesn’t work",
        a: (
          <>
            While you’re typing in a name or description field, it undoes your
            typing instead. Click an empty spot on the map first. After
            reloading the page ⌘Z can’t go back, so create a <B>save point</B> (
            <K>⌘</K>+<K>S</K>) at important moments to return to later.
          </>
        ),
        keywords: "undo not working",
      },
      {
        q: "I can’t select things inside a zone / the zone itself",
        a: (
          <>
            Things placed inside a zone can be clicked as usual. To select the
            zone itself, click an empty spot inside it, or its outline or name
            (dragging selects several things instead).
          </>
        ),
        keywords: "area cannot select",
      },
      {
        q: "Deleting stairs removed them from other floors too",
        a: (
          <>
            Stairs and elevators are treated as one thing across all floors. To
            remove one from a single floor, don’t delete it; uncheck that floor
            in “Connected floors” on the right.
          </>
        ),
        keywords: "stairs deleted other floors connected",
      },
      {
        q: "The escalator is guided the wrong way",
        a: (
          <>
            Up and down are based on{" "}
            <B>
              the floor tabs: left is the lower floor, right is the upper floor
            </B>
            . Put the tabs in order (1F → 2F → 3F) and check “Direction” in the
            escalator settings.
          </>
        ),
        keywords: "escalator wrong direction up down",
      },
      {
        q: "Room names stay in Japanese after switching to English",
        a: (
          <>
            Only the buttons and explanations switch. Room and floor names are
            shown exactly as you typed them.
          </>
        ),
        keywords: "english names japanese language",
      },
    ],
  },
  {
    title: "Keyboard",
    items: [
      {
        q: "List of keyboard shortcuts",
        a: (
          <ul className="space-y-1">
            <li>
              <K>⌘</K>+<K>Z</K> Undo / <K>⌘</K>+<K>Shift</K>+<K>Z</K> Redo
            </li>
            <li>
              <K>⌘</K>+<K>C</K> Copy / <K>⌘</K>+<K>V</K> Paste / <K>⌘</K>+
              <K>X</K> Cut
            </li>
            <li>
              <K>⌘</K>+<K>D</K> Duplicate / <K>⌘</K>+<K>A</K> Select all on this
              floor
            </li>
            <li>
              <K>Delete</K> Delete / <K>Esc</K> Deselect / Arrow keys: nudge
            </li>
            <li>
              Hold <K>⌘</K> or <K>Space</K> and drag: move the map
            </li>
            <li>
              <K>Shift</K>+click: add to selection / <K>Option</K>+drag: move
              without snapping
            </li>
            <li>
              <K>⌘</K>+<K>F</K> Find by name / <K>⌘</K>+<K>S</K> Create a save
              point
            </li>
            <li>
              <K>V</K> Select / <K>R</K> Room / <K>C</K> Round room / <K>P</K>{" "}
              Marker / <K>A</K> Zone / <K>T</K> Text / <K>E</K> Stairs/EV
            </li>
          </ul>
        ),
        keywords: "keyboard shortcuts undo copy paste",
      },
    ],
  },
];

// React ノードから検索用の文字を取り出す
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return "";
}

export function StudioHelpDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const sections = (lang === "ja" ? SECTIONS : SECTIONS_EN)
    .map((s) => ({
      ...s,
      items: q
        ? s.items.filter((it) =>
            `${it.q} ${textOf(it.a)} ${it.keywords ?? ""}`
              .toLowerCase()
              .includes(q),
          )
        : s.items,
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div
      data-keep-selection
      className="studio-fade fixed inset-0 z-[70] flex items-start justify-center bg-black/20 p-6 pt-[10vh]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("使い方")}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border bg-card"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="flex items-center gap-3 border-b px-8 py-6">
          <h2 className="flex-1 text-2xl font-normal tracking-[0.06em]">
            {t("使い方")}
          </h2>
          <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
            Q&amp;A
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("閉じる")}
            className="ml-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b px-8 py-4">
          <label className="flex items-center gap-2 rounded-md border border-input px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              // biome-ignore lint/a11y/noAutofocus: 開いた・名前の編集を始めたときに、すぐ入力できるようにする
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "知りたいことを入力（例：コピー、階段、そろえる）",
              )}
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "「{q}」に当てはまる質問がありません。別のことばで探してみてください。",
                { q: query },
              )}
            </p>
          ) : (
            sections.map((s) => (
              <section key={s.title} className="mb-8 last:mb-0">
                <h3 className="mb-2 font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
                  {s.title}
                </h3>
                <div className="divide-y border-y">
                  {s.items.map((it) => (
                    <details key={it.q} open={Boolean(q)} className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-1 py-3.5 text-sm hover:bg-accent/60">
                        <span className="font-mono text-xs text-primary">
                          Q
                        </span>
                        <span className="flex-1">{it.q}</span>
                        <ChevronRight
                          className={cn(
                            "size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90",
                          )}
                        />
                      </summary>
                      <div className="studio-fade flex gap-3 px-1 pb-5 text-sm leading-loose text-muted-foreground">
                        <span className="font-mono text-xs leading-loose text-foreground">
                          A
                        </span>
                        <div className="flex-1">{it.a}</div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
