import { formatDate, parseDate } from "./dateUtils.ts";
import { generateCSV, parseCSV } from "./csvParser.ts";
import {
  clearError,
  clearSelectedFileName, // Added: Function to clear selected file name
  // showStatus, // Removed
  clearStatus,
  DetailedWarning, // Added
  fileInput,
  getSelectedColumnNames, // Added
  hideDownloadArea,
  hideWarningDetailsArea, // Added
  maxDaysLimitInput,
  populateColumnSelectors, // Added
  resetColumnSelectors, // Added
  setProcessButtonState,
  // appendWarningDetails, // Removed
  setupEventListeners,
  showDownloadArea,
  showError,
  showSelectedFileName, // Added: Function to display selected file name
  showStatusWithWarnings, // Added
  showWarningDetails, // Added
  WarningInfo, // Added
} from "./domHandler.ts";

let processedCsvString: string = ""; // Store processed data for download
let originalFileName: string = "data"; // Store original filename for download
let selectedFile: File | null = null; // Added: Store the selected/dropped file
let parsedCsvData: { header: string[]; dataRows: string[][] } | null = null; // Added: Store parsed CSV data

/**
 * Updates the selected file state and UI.
 * @param file The file selected or dropped by the user.
 */
/**
 * Updates the selected file state and UI, and loads header for column selection.
 * @param file The file selected or dropped by the user.
 */
async function updateSelectedFile(file: File | null): Promise<void> {
  selectedFile = file;
  clearError(); // Clear any previous errors
  clearStatus(); // Clear previous status/results
  hideDownloadArea();
  hideWarningDetailsArea();
  processedCsvString = "";
  parsedCsvData = null; // Reset parsed data
  resetColumnSelectors(); // Reset column selectors initially

  if (file) {
    showSelectedFileName(file.name);
    originalFileName = file.name.replace(/\.csv$/i, ""); // Store for download filename

    try {
      // Read and parse header to populate column selectors
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const csvText = decodeCsvText(arrayBuffer);
      const data = parseCSV(csvText);

      if (!data || data.length < 1) { // Need at least a header row
        showError("CSVファイルが空か、ヘッダー行がありません。");
        clearSelectedFileName();
        selectedFile = null; // Clear selected file state on error
        return;
      }

      const header = data[0];
      populateColumnSelectors(header); // Populate dropdowns with header names
      // Store parsed data for later use in processFile
      parsedCsvData = { header: header, dataRows: data.slice(1) };
    } catch (error) {
      console.error(
        "ファイルの読み込みまたはヘッダー解析中にエラーが発生しました:",
        error,
      );
      showError(
        `ファイルの読み込みまたはヘッダー解析に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      clearSelectedFileName();
      selectedFile = null; // Clear selected file state on error
      parsedCsvData = null; // Reset parsed data on error
    }
  } else {
    clearSelectedFileName();
    // Column selectors are already reset at the start of the function
  }
}

/**
 * Reads and processes the given CSV file.
 * @param file The CSV file to process.
 */
async function processFile(file: File): Promise<void> {
  // 1. Reset UI state (specific to processing start)
  clearError();
  clearStatus();
  hideDownloadArea();
  hideWarningDetailsArea();
  processedCsvString = "";
  setProcessButtonState(true);

  // 2. Get column names and limit inputs
  const selectedColNames = getSelectedColumnNames();
  let maxDaysLimit = parseInt(maxDaysLimitInput.value || "365", 10); // Get limit, default 365

  // 3. Validate column name selection and limit input
  if (!selectedColNames.start) {
    showError("開始日の列を選択してください。");
    setProcessButtonState(false);
    return;
  }
  if (!selectedColNames.end) {
    showError("終了日の列を選択してください。");
    setProcessButtonState(false);
    return;
  }
  if (selectedColNames.start === selectedColNames.end) {
    showError("開始日と終了日の列名は異なる必要があります。");
    setProcessButtonState(false);
    return;
  }
  if (isNaN(maxDaysLimit) || maxDaysLimit <= 0) {
    console.warn("展開行数上限が無効なため、デフォルト値 365 を使用します。");
    maxDaysLimit = 365;
    maxDaysLimitInput.value = "365";
  }

  // 4. Check if parsed data is available (should be loaded by updateSelectedFile)
  if (!parsedCsvData) {
    showError(
      "CSVデータが読み込まれていません。ファイルを再選択してください。",
    );
    setProcessButtonState(false);
    return;
  }

  const originalHeader = parsedCsvData.header;
  const originalDataRows = parsedCsvData.dataRows;

  // 5. Find column indices based on selected names
  const startDateColIndex = originalHeader.indexOf(selectedColNames.start);
  const endDateColIndex = originalHeader.indexOf(selectedColNames.end);

  // 6. Validate found indices and data rows
  try {
    if (startDateColIndex === -1) {
      showError(
        `開始日の列 "${selectedColNames.start}" がヘッダーに見つかりません。`,
      );
      setProcessButtonState(false);
      return;
    }
    if (endDateColIndex === -1) {
      showError(
        `終了日の列 "${selectedColNames.end}" がヘッダーに見つかりません。`,
      );
      setProcessButtonState(false);
      return;
    }
    if (originalDataRows.length === 0) {
      showError("CSVファイルに処理可能なデータ行が含まれていません。");
      setProcessButtonState(false);
      return;
    }

    // 7. Process the data rows
    const { processedRows, warningsSummary, detailedWarnings } =
      processDataRows(
        originalDataRows,
        originalHeader,
        startDateColIndex,
        endDateColIndex,
        maxDaysLimit,
      );

    // 8. Handle results and feedback
    if (processedRows.length > 0) {
      const baseMessage =
        `処理完了。${processedRows.length}行が生成されました。`;
      const newHeader = ["EXPANDDATE", ...originalHeader];
      processedCsvString = generateCSV(newHeader, processedRows);
      showDownloadArea();
      showStatusWithWarnings(baseMessage, warningsSummary);
      showWarningDetails(detailedWarnings);
    } else {
      // Determine why no rows were generated
      const totalSkipped = warningsSummary.reduce((sum, w) => sum + w.count, 0); // Approx total skipped
      if (totalSkipped >= originalDataRows.length) { // Use >= for safety
        showError(
          "処理できる有効なデータがありませんでした。詳細は下の警告リストを確認してください。",
        );
        showStatusWithWarnings("処理結果なし。", warningsSummary);
        showWarningDetails(detailedWarnings);
      } else {
        showError(
          "有効な日付範囲を持つデータ行が見つかりませんでした。入力ファイル、列名、上限値を確認してください。",
        );
      }
      // No download area shown if no rows processed
    }
  } catch (error) {
    console.error("処理中にエラーが発生しました:", error);
    showError(
      `処理中にエラーが発生しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    setProcessButtonState(false); // Ensure button is re-enabled
  }
}

/**
 * Helper function to read File as ArrayBuffer using Promise.
 * @param file The file to read.
 * @returns A Promise resolving with the ArrayBuffer.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        resolve(event.target.result);
      } else {
        reject(new Error("ファイルの読み込み形式が不正です。"));
      }
    };
    reader.onerror = () => {
      reject(new Error("ファイルの読み込み中にエラーが発生しました。"));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Helper function to decode ArrayBuffer to CSV text, handling BOM and encodings.
 * @param arrayBuffer The ArrayBuffer containing file data.
 * @returns The decoded CSV text string.
 * @throws Error if decoding fails.
 */
function decodeCsvText(arrayBuffer: ArrayBuffer): string {
  try {
    // Check for UTF-8 BOM (EF BB BF)
    const bom = new Uint8Array(arrayBuffer.slice(0, 3));
    if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
      console.log("Decoding as UTF-8 (BOM detected)");
      return new TextDecoder("utf-8").decode(arrayBuffer.slice(3));
    } else {
      // No BOM detected, try Shift_JIS first
      try {
        console.log("Attempting to decode as Shift_JIS");
        const decoded = new TextDecoder("shift_jis", { fatal: true }).decode(
          arrayBuffer,
        );
        console.log("Successfully decoded as Shift_JIS");
        return decoded;
      } catch (shiftJisError) {
        // If Shift_JIS fails, try UTF-8 (could be BOM-less UTF-8)
        console.warn(
          "Shift_JIS decoding failed, attempting UTF-8 (no BOM)",
          shiftJisError,
        );
        try {
          const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
            arrayBuffer,
          );
          console.log("Successfully decoded as UTF-8 (no BOM)");
          return decoded;
        } catch (utf8Error) {
          console.error(
            "Failed to decode as both Shift_JIS and UTF-8.",
            utf8Error,
          );
          throw new Error(
            "ファイルの文字コードを自動判別できませんでした。ファイルが UTF-8 または Shift_JIS 形式であることを確認してください。",
          );
        }
      }
    }
  } catch (decodingError) {
    console.error("Error during file decoding:", decodingError);
    const message = decodingError instanceof Error
      ? decodingError.message
      : String(decodingError);
    throw new Error(
      `ファイルのデコードに失敗しました: ${message} ファイルが UTF-8 または Shift_JIS 形式であることを確認してください。`,
    );
  }
}

/**
 * Processes the data rows to expand dates.
 * @param originalDataRows The rows to process (excluding header).
 * @param originalHeader The original header row.
 * @param startDateColIndex 0-based index of the start date column.
 * @param endDateColIndex 0-based index of the end date column.
 * @param maxDaysLimit Maximum number of days to expand per row.
 * @returns An object containing processed rows, warning summary, and detailed warnings.
 */
function processDataRows(
  originalDataRows: string[][],
  originalHeader: string[], // Added for context in warnings if needed later
  startDateColIndex: number,
  endDateColIndex: number,
  maxDaysLimit: number,
): {
  processedRows: string[][];
  warningsSummary: WarningInfo[];
  detailedWarnings: DetailedWarning[];
} {
  const processedRows: string[][] = [];
  let skippedRowCount = 0;
  let invalidDateRowCount = 0;
  let invalidRangeRowCount = 0;
  let truncationRowCount = 0;
  const detailedWarnings: DetailedWarning[] = [];

  originalDataRows.forEach((row, rowIndex) => {
    const rowNumberForError = rowIndex + 2; // 1-based index for user messages
    if (row.length <= Math.max(startDateColIndex, endDateColIndex)) {
      skippedRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "列数不足",
        message: `列数が不足しています (${row.length}列)。`,
      });
      return;
    }

    const startDateStr = row[startDateColIndex];
    const endDateStr = row[endDateColIndex];

    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);

    if (!startDate) {
      invalidDateRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "日付解析エラー",
        message: `開始日 "${startDateStr}" を解析できません。`,
      });
      return;
    }
    if (!endDate) {
      invalidDateRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "日付解析エラー",
        message: `終了日 "${endDateStr}" を解析できません。`,
      });
      return;
    }

    if (startDate.getTime() > endDate.getTime()) {
      invalidRangeRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "日付範囲エラー",
        message: `開始日 (${formatDate(startDate)}) が終了日 (${
          formatDate(endDate)
        }) より後です。`,
      });
      return;
    }

    const dayDifference = (endDate.getTime() - startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const totalDaysToExpand = dayDifference + 1;

    let currentDate = new Date(startDate.getTime());
    const finalEndDate = new Date(endDate.getTime());
    let expandedCount = 0;
    let truncated = false;
    let loopCount = 0;
    const maxLoops = Math.max(totalDaysToExpand + 10, maxDaysLimit + 10);

    while (
      currentDate.getTime() <= finalEndDate.getTime() &&
      expandedCount < maxDaysLimit &&
      loopCount < maxLoops
    ) {
      const formattedDate = formatDate(currentDate);
      processedRows.push([formattedDate, ...row]);
      expandedCount++;
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      loopCount++;
    }

    if (
      expandedCount === maxDaysLimit &&
      currentDate.getTime() <= finalEndDate.getTime() &&
      loopCount < maxLoops
    ) {
      truncated = true;
      truncationRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "上限による打ち切り",
        message: `展開行数が上限 (${maxDaysLimit}日) に達したため、${
          formatDate(currentDate)
        } 以降の展開を打ち切りました (本来の終了日: ${
          formatDate(endDate)
        }, 全 ${totalDaysToExpand}日)。`,
      });
    } else if (loopCount >= maxLoops) {
      console.error(
        `行 ${rowNumberForError}: 日付展開ループが予期せず最大回数 (${maxLoops}) に達しました。スキップします。`,
      );
      invalidRangeRowCount++;
      detailedWarnings.push({
        rowNumber: rowNumberForError,
        type: "処理エラー",
        message:
          `日付展開ループが予期せず最大回数 (${maxLoops}) に達しました。`,
      });
    }
  }); // End of originalDataRows.forEach

  // Compile summary
  const warningsSummary: WarningInfo[] = [];
  if (invalidDateRowCount > 0) {
    warningsSummary.push({
      type: "日付解析エラー",
      count: invalidDateRowCount,
    });
  }
  if (invalidRangeRowCount > 0) {
    warningsSummary.push({
      type: "日付範囲/処理エラー",
      count: invalidRangeRowCount,
    });
  }
  if (skippedRowCount > 0) {
    warningsSummary.push({ type: "列数不足", count: skippedRowCount });
  }
  if (truncationRowCount > 0) {
    warningsSummary.push({
      type: "上限による打ち切り",
      count: truncationRowCount,
    });
  }

  return { processedRows, warningsSummary, detailedWarnings };
}

/**
 * Handles the click event for the "Process" button.
 * Uses the currently selected file stored in `selectedFile`.
 */
function handleProcessClick(): void {
  if (!selectedFile) {
    showError("CSVファイルを選択またはドロップしてください。");
    return;
  }
  // Add check for parsed data before calling processFile
  if (!parsedCsvData) {
    showError(
      "CSVデータの読み込みが完了していません。ファイル選択をやり直してください。",
    );
    return;
  }
  // Now call processFile with the stored file
  processFile(selectedFile);
}

/**
 * Handles the download logic when the "Download" button is clicked.
 */
function handleDownloadClick(): void {
  if (!processedCsvString) {
    showError(
      "ダウンロードするデータがありません。先に処理を実行してください。",
    );
    return;
  }

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
  const blob = new Blob([bom, processedCsvString], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${originalFileName}_expanded.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Initialize ---
// Add event listener for file input change
fileInput.addEventListener("change", async (event) => { // Made async
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] ?? null; // Get file or null
  await updateSelectedFile(file); // Await the async function
  target.value = ""; // Clear the input value
});

// Setup event listeners for buttons and drop area when the script loads
// The drop callback now just updates the selected file
setupEventListeners(
  handleProcessClick,
  handleDownloadClick,
  updateSelectedFile,
);

console.log("CSV Date Expander Initialized (TypeScript Version)");
