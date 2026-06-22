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
