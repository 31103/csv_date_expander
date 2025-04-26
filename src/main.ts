import { parseDate, formatDate } from './dateUtils.ts';
import { parseCSV, generateCSV } from './csvParser.ts';
import {
    fileInput,
    startDateColInput,
    endDateColInput,
    maxDaysLimitInput,
    showError,
    clearError,
    showStatus,
    clearStatus,
    showDownloadArea,
    hideDownloadArea,
    setProcessButtonState,
    appendWarningDetails,
    setupEventListeners
} from './domHandler.ts';

let processedCsvString: string = ''; // Store processed data for download
let originalFileName: string = 'data'; // Store original filename for download

/**
 * Handles the main CSV processing logic when the "Process" button is clicked.
 */
function handleProcessClick(): void {
    // 1. Reset UI state
    clearError();
    clearStatus();
    hideDownloadArea();
    processedCsvString = '';
    setProcessButtonState(true);

    // 2. Get inputs
    const file = fileInput.files?.[0];
    const startDateColIndex = parseInt(startDateColInput.value || 'NaN', 10) - 1; // 0-based
    const endDateColIndex = parseInt(endDateColInput.value || 'NaN', 10) - 1;   // 0-based
    let maxDaysLimit = parseInt(maxDaysLimitInput.value || '100', 10); // Get limit, default 100

    // 3. Validate inputs
    if (!file) {
        showError("CSVファイルを選択してください。");
        setProcessButtonState(false); return;
    }
    if (isNaN(startDateColIndex) || startDateColIndex < 0) {
        showError("有効な開始日の列番号 (1以上) を入力してください。");
        setProcessButtonState(false); return;
    }
    if (isNaN(endDateColIndex) || endDateColIndex < 0) {
        showError("有効な終了日の列番号 (1以上) を入力してください。");
        setProcessButtonState(false); return;
    }
    if (startDateColIndex === endDateColIndex) {
        showError("開始日と終了日の列番号は異なる必要があります。");
        setProcessButtonState(false); return;
    }
    if (isNaN(maxDaysLimit) || maxDaysLimit <= 0) {
        // Defaulting instead of showing error, could be changed
        console.warn("展開行数上限が無効なため、デフォルト値 100 を使用します。");
        maxDaysLimit = 100;
        maxDaysLimitInput.value = '100'; // Update input field as well
        // showError("展開行数上限には正の整数を入力してください。");
        // setProcessButtonState(false); return;
    }

    originalFileName = file.name.replace(/\.csv$/i, ''); // Store for download filename

    // 4. Read the file
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => { // Add explicit type for event
        try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
                throw new Error("ファイルの読み込みに失敗しました (ArrayBuffer)。");
            }

            let csvText: string;
            try {
                // Check for UTF-8 BOM (EF BB BF)
                const bom = new Uint8Array(arrayBuffer.slice(0, 3));
                if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
                    console.log("Decoding as UTF-8 (BOM detected)");
                    // Decode skipping the BOM
                    csvText = new TextDecoder('utf-8').decode(arrayBuffer.slice(3));
                } else {
                    // No BOM detected, try Shift_JIS first
                    try {
                        console.log("Attempting to decode as Shift_JIS");
                        csvText = new TextDecoder('shift_jis', { fatal: true }).decode(arrayBuffer);
                        console.log("Successfully decoded as Shift_JIS");
                    } catch (shiftJisError) {
                        // If Shift_JIS fails, try UTF-8 (could be BOM-less UTF-8)
                        console.warn("Shift_JIS decoding failed, attempting UTF-8 (no BOM)", shiftJisError);
                        try {
                            csvText = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
                            console.log("Successfully decoded as UTF-8 (no BOM)");
                        } catch (utf8Error) {
                            // If both fail, throw a specific error
                            console.error("Failed to decode as both Shift_JIS and UTF-8.", utf8Error);
                            throw new Error("ファイルのエンコーディングを判別できませんでした。UTF-8 または Shift_JIS であることを確認してください。");
                        }
                    }
                }
            } catch (decodingError) {
                // Catch errors specifically from the decoding process
                console.error("Error during file decoding:", decodingError);
                // Show error to the user via the UI handler
                showError(`ファイルデコードエラー: ${decodingError instanceof Error ? decodingError.message : String(decodingError)}. ファイルがUTF-8またはShift_JIS形式であることを確認してください。`);
                setProcessButtonState(false); // Re-enable button
                return; // Stop further execution in the onload handler
            }

            // --- Original processing continues below using the decoded csvText ---
            const data = parseCSV(csvText);

            if (!data || data.length < 2) { // Need header + at least one data row
                showError(data.length < 1 ? "CSVファイルが空か、読み込みに失敗しました。" : "CSVファイルにはヘッダー行の他に、少なくとも1行のデータが必要です。");
                setProcessButtonState(false); return;
            }

            const originalHeader = data[0];
            const originalDataRows = data.slice(1);

            if (startDateColIndex >= originalHeader.length || endDateColIndex >= originalHeader.length) {
                showError(`指定された列番号 (${Math.max(startDateColIndex, endDateColIndex) + 1}) がCSVの列数 (${originalHeader.length}) を超えています。`);
                setProcessButtonState(false); return;
            }

            // 5. Process the data
            const newHeader = ["EXPANDDATE", ...originalHeader];
            const processedRows: string[][] = [];
            let skippedRowCount = 0;
            let invalidDateRowCount = 0;
            let invalidRangeRowCount = 0;
            let limitExceededRowCount = 0;

            originalDataRows.forEach((row, rowIndex) => {
                const rowNumberForError = rowIndex + 2; // 1-based index for user messages
                if (row.length <= Math.max(startDateColIndex, endDateColIndex)) {
                    console.warn(`行 ${rowNumberForError}: 列数が不足しています (${row.length}列)。スキップします。`);
                    skippedRowCount++;
                    return;
                }

                const startDateStr = row[startDateColIndex];
                const endDateStr = row[endDateColIndex];

                const startDate = parseDate(startDateStr);
                const endDate = parseDate(endDateStr);

                if (!startDate) {
                    console.warn(`行 ${rowNumberForError}: 開始日 "${startDateStr}" を解析できません。スキップします。`);
                    invalidDateRowCount++;
                    return;
                }
                if (!endDate) {
                    console.warn(`行 ${rowNumberForError}: 終了日 "${endDateStr}" を解析できません。スキップします。`);
                    invalidDateRowCount++;
                    return;
                }

                // Dates are already UTC from parseDate
                if (startDate.getTime() > endDate.getTime()) {
                    console.warn(`行 ${rowNumberForError}: 開始日 (${formatDate(startDate)}) が終了日 (${formatDate(endDate)}) より後です。スキップします。`);
                    invalidRangeRowCount++;
                    return;
                }

                // Check day limit
                const dayDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24); // Difference in days
                const numberOfExpandedRows = dayDifference + 1;

                if (numberOfExpandedRows > maxDaysLimit) {
                    console.warn(`行 ${rowNumberForError}: 展開行数 (${numberOfExpandedRows}) が上限 (${maxDaysLimit}) を超えています。スキップします。`);
                    limitExceededRowCount++;
                    return;
                }

                // Iterate from start date to end date (inclusive), using UTC dates
                let currentDate = new Date(startDate.getTime()); // Clone start date
                const finalEndDate = new Date(endDate.getTime()); // Clone end date

                let loopCount = 0;
                const maxLoops = maxDaysLimit + 10; // Safety break

                while (currentDate.getTime() <= finalEndDate.getTime() && loopCount < maxLoops) {
                    const formattedDate = formatDate(currentDate);
                    processedRows.push([formattedDate, ...row]);

                    // Move to the next day in UTC
                    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                    loopCount++;
                }
                if (loopCount >= maxLoops) {
                    console.error(`行 ${rowNumberForError}: 日付展開ループが予期せず最大回数 (${maxLoops}) に達しました。スキップします。`);
                    invalidRangeRowCount++; // Count as a range issue
                }
            }); // End of originalDataRows.forEach

            // 6. Handle results and feedback
            let finalMessage = '';
            if (processedRows.length > 0) {
                finalMessage = `処理完了。${processedRows.length}行が生成されました。`;
                processedCsvString = generateCSV(newHeader, processedRows);
                showDownloadArea();
                showStatus(finalMessage);
            } else {
                // Determine why no rows were generated
                if (originalDataRows.length === 0) {
                    showError("CSVファイルに処理可能なデータ行が含まれていません。");
                } else if (invalidDateRowCount + invalidRangeRowCount + skippedRowCount + limitExceededRowCount === originalDataRows.length) {
                    showError("すべてのデータ行でエラーまたは上限超過が発生したため、結果を生成できませんでした。詳細はコンソールを確認してください。");
                } else {
                    showError("有効な日付範囲を持つデータ行が見つかりませんでした。入力ファイル、列番号、上限値を確認してください。");
                }
                setProcessButtonState(false); return;
            }

            // Append warning counts to the status message
            const warnings: string[] = [];
            if (invalidDateRowCount > 0) warnings.push(`${invalidDateRowCount}行で日付解析エラー`);
            if (invalidRangeRowCount > 0) warnings.push(`${invalidRangeRowCount}行で日付範囲エラー`);
            if (skippedRowCount > 0) warnings.push(`${skippedRowCount}行で列数不足`);
            if (limitExceededRowCount > 0) warnings.push(`${limitExceededRowCount}行で上限超過`);

            if (warnings.length > 0) {
                appendWarningDetails(`注意: ${warnings.join('、')}により一部行がスキップされました。詳細はコンソール参照`);
            }

        } catch (error) {
            console.error("処理中に予期せぬエラーが発生しました:", error);
            showError(`処理中に予期せぬエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setProcessButtonState(false);
        }
    }; // End of reader.onload

    reader.onerror = () => {
        showError("ファイルの読み込み中にエラーが発生しました。");
        setProcessButtonState(false);
    };

    reader.readAsArrayBuffer(file); // Read as ArrayBuffer to allow encoding detection
}

/**
 * Handles the download logic when the "Download" button is clicked.
 */
function handleDownloadClick(): void {
    if (!processedCsvString) {
        showError("ダウンロードするデータがありません。先に処理を実行してください。");
        return;
    }

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const blob = new Blob([bom, processedCsvString], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${originalFileName}_expanded.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Initialize ---
// Setup event listeners when the script loads
setupEventListeners(handleProcessClick, handleDownloadClick);

console.log("CSV Date Expander Initialized (TypeScript Version)");