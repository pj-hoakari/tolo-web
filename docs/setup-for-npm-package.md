# NPMパッケージ用の開発環境セットアップ

## .envファイルの作成

`.env.example`ファイルをコピー

```bash
cp .env.example .env
```

## トークンの設定

### GitHubトークンの作成

TBD

### トークンの.envファイルへの設定

`.env`ファイルの`NPM_TOKEN`行にトークンを記載

```env
NPM_TOKEN=ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```


## direnvのセットアップ
任意，direnvを使用する場合のみ

[direnv – unclutter your .profile | direnv](https://direnv.net/)

### direnvのインストール
[Installation | direnv](https://direnv.net/docs/installation.html)

Ubuntuの場合
```bash
sudo apt install direnv
```

### direnvとシェルの連携
[Setup | direnv](https://direnv.net/docs/hook.html)

```bash
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
```

### .envrcファイルの作成

`.envrc.example`ファイルをコピー

```bash
cp .envrc.example .envrc
```

### direnvの許可

```bash
direnv allow
```
