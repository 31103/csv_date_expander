# 機能強化計画: 列名による日付列選択

**目的:**
CSVファイルの日付列指定を、現在の列番号入力から、ファイル読み込み後に表示される列名ドロップダウンリストでの選択に変更する。

**計画:**

1. **ブランチ作成:**
   - Gitで新しいフィーチャーブランチ `feature/select-column-by-name`
     を作成します。 (これは後ほど `code` モードで実施します)

2. **UIの変更 (`index.html`):**
   - 現在の「開始日の列番号」「終了日の列番号」の `<input type="number">` 要素
     (`id="startDateCol"`, `id="endDateCol"`) を削除します。
   - 代わりに、列名選択用の `<select>` 要素を2つ追加します。IDはそれぞれ
     `startDateColSelect`, `endDateColSelect` とします。
   - これらの `<select>`
     要素は、初期状態では空、または「ファイルを選択してください」といった選択肢のみ表示します。
   - 関連する `<label>` のテキストも「列番号」から「列名」に変更します。

3. **DOM操作の変更 (`src/domHandler.ts`):**
   - `startDateColInput`, `endDateColInput` の参照を削除します。
   - 新しい `<select>` 要素 (`startDateColSelect`, `endDateColSelect`)
     への参照を追加します。
   - 新しい関数 `populateColumnSelectors(columns: string[])`
     を追加します。この関数は、引数で受け取った列名 (`columns`) を `<option>`
     要素として `<select>`
     要素に追加します。ファイルが選択されていない場合やヘッダーがない場合は、選択肢をクリアまたは「選択してください」の状態に戻します。
   - 新しい関数
     `getSelectedColumnNames(): { start: string | null, end: string | null }`
     を追加します。この関数は、各 `<select>`
     要素で現在選択されている列名を返します。
   - ファイル選択解除時などに `<select>` をリセットする `resetColumnSelectors()`
     関数を追加します。

4. **メインロジックの変更 (`src/main.ts`):**
   - **ファイル選択/ドロップ時 (`updateSelectedFile`):**
     - ファイルが選択されたら、`readFileAsArrayBuffer`, `decodeCsvText`,
       `parseCSV` を呼び出してCSVデータを読み込み、ヘッダー行 (`data[0]`)
       を取得します。
     - 取得したヘッダー行を `domHandler.populateColumnSelectors` に渡して、UIの
       `<select>` 要素を更新します。
     - ファイル読み込みやヘッダー取得に失敗した場合は、エラー表示とセレクターのリセットを行います。
     - ファイル選択が解除された場合は、`domHandler.resetColumnSelectors`
       を呼び出します。
   - **処理実行時 (`handleProcessClick` / `processFile`):**
     - `domHandler.getSelectedColumnNames`
       を呼び出して、ユーザーが選択した開始日・終了日の **列名** を取得します。
     - 列名が選択されていない場合はエラーを表示します。
     - 取得した列名をもとに、`processFile` の先頭で取得したヘッダー行
       (`originalHeader`) を検索し、対応する **0ベースの列インデックス**
       (`startDateColIndex`, `endDateColIndex`) を特定します。
     - 列名がヘッダー内に見つからない場合（通常は起こらないはずですが）のエラーハンドリングを追加します。
     - 以降の処理（`processDataRows`
       の呼び出しなど）は、特定した列インデックスを使用して実行します。
     - 従来の列番号の数値検証ロジックは、列名が選択されているかの検証に置き換えます。

5. **ドキュメント更新:**
   - `README.md` の使い方セクションを更新し、列名選択方式に変更します。
   - Memory Bank (`activeContext.md`, `progress.md` など)
     に今回の変更内容を反映します。（これは `code`
     モードでの実装完了後に行います）

**処理フローのイメージ (Mermaid):**

```mermaid
graph TD
    subgraph ファイル選択/ドロップ時
        A[ユーザー: ファイル選択/ドロップ] --> B(main.ts: updateSelectedFile);
        B --> C{ファイル読み込み & デコード};
        C --> D(main.ts: parseCSV);
        D --> E{ヘッダー行取得 (data[0])};
        E -- 成功 --> F(domHandler.ts: populateColumnSelectors);
        F --> G[UI: 列名<select>更新];
        E -- 失敗 --> H(domHandler.ts: showError & resetSelectors);
    end

    subgraph 処理実行時
        I[ユーザー: 処理実行ボタンクリック] --> J(main.ts: handleProcessClick);
        J --> K(domHandler.ts: getSelectedColumnNames);
        K --> L{main.ts: ヘッダーから列名に対応するIndex検索};
        L -- 列名未選択/見つからない --> M(domHandler.ts: showError);
        L -- Index特定 --> N{main.ts: processDataRows (Index使用)};
        N --> O{処理結果表示/ダウンロード};
    end

    G --> I;
```
