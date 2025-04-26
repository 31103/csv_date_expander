# アクティブコンテキスト

## 現在の作業内容

- **エラー表示のUI詳細化を実装しました。** (行ごとの警告詳細をUIに表示)
- **CSVエンコーディング自動検出機能（UTF-8/Shift_JIS）を実装しました。**
- `README.md` を更新し、エンコーディング対応について追記しました。
- (完了済み) プロジェクトのリファクタリング作業。
- (完了済み) TypeScriptとDenoの導入とコードのモジュール化。
- (完了済み) CSSのプレーンCSSへの移行とインライン化。
- (完了済み) 単一HTML生成ビルドスクリプト (`build.ts`) の作成。

## 最近の変更

- **`index.html` を変更:** 警告詳細表示用のエリア (`#warningDetails`,
  `#warningList`) を追加。
- **`src/style.css` を変更:** 警告詳細エリアのスタイルを追加。
- **`src/domHandler.ts` を変更:**
  - 警告詳細エリアのDOM要素参照を追加。
  - 警告詳細を表示/非表示/設定する関数 (`showWarningDetailsArea`,
    `hideWarningDetailsArea`, `showWarningDetails`) を追加。
  - `showStatusWithWarnings` をサマリー表示に特化するように修正。
  - `escapeHtml` 関数を `escapeHtmlUsingDOM` に置き換え。
- **`src/main.ts` を変更:**
  - 行ごとの警告詳細 (`DetailedWarning`) を収集するロジックを追加。
  - 処理完了時に `showWarningDetails`
    を呼び出して警告リストを表示するように修正。
  - 処理開始時に `hideWarningDetailsArea` を呼び出すように修正。
- **`README.md` を更新:** エラー/警告表示がUI上で行われるように説明を修正。
- **`src/main.ts` を変更 (以前):**
  - `FileReader.readAsText()` を `readAsArrayBuffer()` に変更。
  - `TextDecoder` を使用して、UTF-8 BOM -> Shift_JIS -> UTF-8 (BOMなし)
    の順でデコードを試行するロジックを追加。
- **`README.md` を更新 (以前):**
  - 入力CSVフォーマットの文字コードに関する記述を、UTF-8/Shift_JIS自動検出に対応するように修正。
- (以前の変更) プロジェクト構造を `src/` ディレクトリベースに変更。
- (以前の変更) JavaScriptをTypeScriptに移行し、モジュール分割。
- (以前の変更) `src/style.css` を作成し、Tailwind CSSを削除。
- (以前の変更) `index.html` テンプレートを作成。
- (以前の変更) `build.ts` を作成し、単一HTML生成を可能にした。

## 次のステップ

- **エラー表示改善は完了しました。**
- 次のタスクは未定です。考えられるステップとしては引き続き以下があります:
  - TypeScriptモジュールに対する単体テストの追加 (`deno test`)。
  - ユーザーからのフィードバックに基づく機能追加や改善。
  - より堅牢なCSV解析ライブラリの導入検討。
