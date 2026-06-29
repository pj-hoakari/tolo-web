# 人検出モデルセットアップ

## YOLOモデルのセットアップ
デフォルトではYOLO26nを使用

### uvセットアップ
[uv](https://docs.astral.sh/uv/)

```bash
uv --version
```
上記コマンドを実行してバージョンが表示されない場合，行う必要がある
#### uvをインストール

[Installation | uv](https://docs.astral.sh/uv/getting-started/installation/#__tabbed_1_1)

Ubuntuの場合
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### YOLOモデル（ONNX形式）の作成
`public/models`ディレクトリ内にONNX形式のYOLOモデルを配置

#### 1. `public/models`ディレクトリに移動

```bash
cd public/models
```

#### 2. YOLOモデルの変換・配置

```bash
uv run --no-project --with ultralytics yolo export model=yolo26n.pt format=onnx imgsz=640 simplify=True
```

## モデルの配信

配信される URL は環境変数`NEXT_PUBLIC_CROWD_DETECTION_MODEL_PATH`（既定 `/models/yolo26n.onnx`）
既定のURLのまま、マウントするファイル名を合わせる運用

### `pnpm dev`（ローカル開発）

`public/models/yolo26n.onnx`を配置する

### `compose.yaml`（開発用コンテナ）

リポジトリの`./public/models`を`/app/public/models`にbindマウントして供給
`pnpm dev`と同様に`public/models/yolo26n.onnx`を配置

### ビルド済みイメージ使用時

モデルはイメージに含まれないため、ホスト上のモデルディレクトリをマウントして供給する
マウントしたディレクトリ直下に、配信 URL に対応するファイル名（既定:`yolo26n.onnx`）を配置
