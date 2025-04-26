// Type assertion helper to ensure elements exist
function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with ID "${id}" not found.`);
  }
  return element as T;
}

// --- DOM Element References ---
export const fileInput = getElementByIdOrThrow<HTMLInputElement>("csvFile");
export const startDateColSelect = getElementByIdOrThrow<HTMLSelectElement>(
  "startDateColSelect",
);
export const endDateColSelect = getElementByIdOrThrow<HTMLSelectElement>(
  "endDateColSelect",
);
export const maxDaysLimitInput = getElementByIdOrThrow<HTMLInputElement>(
  "maxDaysLimit",
);
export const processBtn = getElementByIdOrThrow<HTMLButtonElement>(
  "processBtn",
);
export const downloadContainer = getElementByIdOrThrow<HTMLDivElement>(
  "downloadContainer",
);
export const downloadBtn = getElementByIdOrThrow<HTMLButtonElement>(
  "downloadBtn",
);
export const errorDiv = getElementByIdOrThrow<HTMLDivElement>("error");
export const statusDiv = getElementByIdOrThrow<HTMLDivElement>("status");
export const warningDetailsArea = getElementByIdOrThrow<HTMLDivElement>(
  "warningDetails",
);
export const warningList = getElementByIdOrThrow<HTMLUListElement>(
  "warningList",
);
export const selectedFileNameDiv = getElementByIdOrThrow<HTMLDivElement>(
  "selectedFileName",
);
export const fileDropArea = getElementByIdOrThrow<HTMLDivElement>(
  "fileDropArea",
);

// 新しいUI要素の参照
export const processingIndicator = getElementByIdOrThrow<HTMLDivElement>(
  "processingIndicator",
);
export const resultSummary = getElementByIdOrThrow<HTMLDivElement>(
  "resultSummary",
);
export const resultText = getElementByIdOrThrow<HTMLDivElement>(
  "resultSummary",
).querySelector(".result-text") as HTMLDivElement;
export const helpToggle = getElementByIdOrThrow<HTMLButtonElement>(
  "helpToggle",
);
export const helpContent = getElementByIdOrThrow<HTMLDivElement>(
  "helpContent",
);
export const warningToggle = document.querySelector<HTMLButtonElement>(
  ".warning-toggle",
);

// --- Type Definitions ---
/** Represents information about a specific type of warning during processing. */
export interface WarningInfo {
  type: string; // e.g., "日付解析エラー", "上限超過"
  count: number;
}

/** Represents a detailed warning for a specific row. */
export interface DetailedWarning {
  rowNumber: number; // 1-based original row number
  type: string; // e.g., "日付解析エラー", "上限超過"
  message: string; // Detailed message including relevant data
}

// --- UI Update Functions ---

/**
 * Populates the column select dropdowns with options from the CSV header.
 * @param columns - An array of column names (header values).
 */
export function populateColumnSelectors(columns: string[]): void {
  // Clear existing options except the first placeholder
  startDateColSelect.innerHTML = '<option value="">開始日の列を選択</option>';
  endDateColSelect.innerHTML = '<option value="">終了日の列を選択</option>';

  if (columns && columns.length > 0) {
    columns.forEach((colName, index) => {
      // Use column name as value, or index if name is empty/duplicate?
      // For simplicity, let's use the column name as value for now.
      // Need to handle potential duplicate column names later if necessary.
      // For now, assume unique names or first match is sufficient.
      const option = document.createElement("option");
      option.value = colName; // Use column name as value
      option.textContent = colName; // Display column name

      startDateColSelect.appendChild(option.cloneNode(true)); // Clone for the second select
      endDateColSelect.appendChild(option);
    });
  }
}

/**
 * Resets the column select dropdowns to their initial state.
 */
export function resetColumnSelectors(): void {
  startDateColSelect.innerHTML =
    '<option value="">ファイルを選択してください</option>';
  endDateColSelect.innerHTML =
    '<option value="">ファイルを選択してください</option>';
}

/**
 * Gets the currently selected column names from the dropdowns.
 * @returns An object containing the selected start and end column names, or null if not selected.
 */
export function getSelectedColumnNames(): {
  start: string | null;
  end: string | null;
} {
  const start = startDateColSelect.value || null;
  const end = endDateColSelect.value || null;
  return { start, end };
}

/**
 * Displays the selected file name and preview.
 * @param fileName The name of the selected file.
 * @param previewContent Optional preview content to display.
 */
export function showSelectedFileName(
  fileName: string,
  previewContent?: string,
): void {
  const fileNameElement = selectedFileNameDiv.querySelector(".file-name");
  if (fileNameElement) {
    fileNameElement.textContent = fileName;
  }

  if (previewContent) {
    const previewContentElement = selectedFileNameDiv.querySelector(
      ".file-preview-content",
    );
    if (previewContentElement) {
      previewContentElement.textContent = previewContent;
    }
  }

  selectedFileNameDiv.classList.remove("hidden");
}

/** Clears the displayed selected file name. */
export function clearSelectedFileName(): void {
  const fileNameElement = selectedFileNameDiv.querySelector(".file-name");
  if (fileNameElement) {
    fileNameElement.textContent = "";
  }

  const previewContentElement = selectedFileNameDiv.querySelector(
    ".file-preview-content",
  );
  if (previewContentElement) {
    previewContentElement.textContent = "";
  }

  selectedFileNameDiv.classList.add("hidden");
}

/** Displays an error message. */
export function showError(message: string): void {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
  statusDiv.classList.add("hidden"); // Hide status when error occurs
  downloadContainer.classList.add("hidden"); // Hide download when error occurs
  hideWarningDetailsArea(); // Hide warning details when error occurs
  hideResultSummary(); // Hide result summary when error occurs
}

/** Hides the error message area. */
export function clearError(): void {
  errorDiv.textContent = "";
  errorDiv.classList.add("hidden");
}

/**
 * Displays a status message, optionally including formatted warning counts.
 * @param baseMessage The main status message (e.g., "処理完了。100行生成。").
 * @param warnings An array of WarningInfo objects (for counts).
 */
export function showStatusWithWarnings(
  baseMessage: string,
  warnings: WarningInfo[] = [],
): void {
  let messageText = baseMessage; // Start with the base message

  if (warnings.length > 0) {
    const warningCounts = warnings
      .map((w) => `${w.type}: ${w.count}行`) // No need to escape here for textContent
      .join("、");
    messageText += ` (注意: ${warningCounts} により一部行がスキップされました)`;
  }

  statusDiv.textContent = messageText; // Use textContent for simple status
  statusDiv.classList.remove("hidden");
  clearError(); // Clear any previous errors when showing status

  // 結果サマリーも表示
  showResultSummary(messageText, warnings.length > 0 ? "warning" : "success");
}

/** Hides the status message area. */
export function clearStatus(): void {
  statusDiv.textContent = ""; // Clear textContent
  statusDiv.classList.add("hidden");
}

/** Shows the download button and container. */
export function showDownloadArea(): void {
  downloadContainer.classList.remove("hidden");
}

/** Hides the download button and container. */
export function hideDownloadArea(): void {
  downloadContainer.classList.add("hidden");
}

/** Sets the state of the process button (disabled/enabled and text). */
export function setProcessButtonState(isLoading: boolean): void {
  processBtn.disabled = isLoading;
  processBtn.textContent = isLoading ? "処理中..." : "処理実行";

  // 処理中インジケーターの表示/非表示
  if (isLoading) {
    showProcessingIndicator();
  } else {
    hideProcessingIndicator();
  }
}

/**
 * Displays detailed warning messages in a list.
 * @param detailedWarnings An array of DetailedWarning objects.
 */
export function showWarningDetails(detailedWarnings: DetailedWarning[]): void {
  // Clear previous warnings
  warningList.innerHTML = "";

  if (detailedWarnings.length > 0) {
    detailedWarnings.forEach((warning) => {
      const listItem = document.createElement("li");
      // Escape message content before setting innerHTML using the DOM method
      listItem.innerHTML = `行 ${warning.rowNumber}: ${
        escapeHtmlUsingDOM(warning.message)
      }`;
      warningList.appendChild(listItem);
    });
    showWarningDetailsArea();
  } else {
    hideWarningDetailsArea();
  }
}

/** Shows the warning details area. */
export function showWarningDetailsArea(): void {
  warningDetailsArea.classList.remove("hidden");
}

/** Hides the warning details area. */
export function hideWarningDetailsArea(): void {
  warningDetailsArea.classList.add("hidden");
}

/**
 * DOM API (textContent) を利用してHTML特殊文字をエスケープする関数
 * (ブラウザ環境でのみ動作します)
 * @param {string} unsafe エスケープ対象の文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtmlUsingDOM(unsafe: string): string {
  if (typeof unsafe !== "string") {
    return "";
  }
  // 一時的なDOM要素を作成
  const div = document.createElement("div");
  // textContentに設定すると、特殊文字は自動的にエスケープされる
  div.textContent = unsafe;
  // innerHTMLを取得すると、エスケープされた文字列が得られる
  return div.innerHTML;
}

/**
 * Sets the visual highlight state for the file drop area.
 * @param highlight - True to highlight, false to remove highlight.
 */
export function setDropAreaHighlight(highlight: boolean): void {
  if (highlight) {
    fileDropArea.classList.add("dragover");
  } else {
    fileDropArea.classList.remove("dragover");
  }
}

/**
 * 処理中インジケーターを表示する
 */
export function showProcessingIndicator(): void {
  processingIndicator.classList.remove("hidden");
}

/**
 * 処理中インジケーターを非表示にする
 */
export function hideProcessingIndicator(): void {
  processingIndicator.classList.add("hidden");
}

/**
 * 結果サマリーを表示する
 * @param message 表示するメッセージ
 * @param type 結果の種類 ("success", "warning", "error")
 */
export function showResultSummary(
  message: string,
  type: "success" | "warning" | "error" = "success",
): void {
  const resultIcon = resultSummary.querySelector(".result-icon");
  if (resultIcon) {
    resultIcon.className = `result-icon ${type}`;
  }

  if (resultText) {
    resultText.textContent = message;
  }

  resultSummary.classList.remove("hidden");
}

/**
 * 結果サマリーを非表示にする
 */
export function hideResultSummary(): void {
  resultSummary.classList.add("hidden");
}

/**
 * CSVデータのプレビューを生成する
 * @param csvData CSVデータ（行の配列）
 * @param maxRows 表示する最大行数
 * @returns プレビュー用のテキスト
 */
export function generateCsvPreview(
  csvData: string[][],
  maxRows: number = 3,
): string {
  if (!csvData || csvData.length === 0) {
    return "プレビューできるデータがありません";
  }

  const previewRows = csvData.slice(0, maxRows);
  return previewRows.map((row) => row.join(", ")).join("\n");
}

// --- Event Listener Setup ---

/**
 * Attaches event listeners to buttons and the drop area.
 * @param processCallback - Function to call when the process button is clicked.
 * @param downloadCallback - Function to call when the download button is clicked.
 * @param fileDropCallback - Function to call when a file is dropped onto the drop area.
 */
export function setupEventListeners(
  processCallback: () => void,
  downloadCallback: () => void,
  fileDropCallback: (file: File) => void,
): void {
  processBtn.addEventListener("click", processCallback);
  downloadBtn.addEventListener("click", downloadCallback);

  // Drag and Drop Listeners for fileDropArea
  fileDropArea.addEventListener("dragover", (event) => {
    event.preventDefault(); // Necessary to allow drop
    setDropAreaHighlight(true);
  });

  fileDropArea.addEventListener("dragleave", () => {
    setDropAreaHighlight(false);
  });

  fileDropArea.addEventListener("drop", (event) => {
    event.preventDefault(); // Prevent default browser behavior (opening file)
    setDropAreaHighlight(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      // Handle only the first file if multiple are dropped
      const file = files[0];
      if (
        file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")
      ) {
        fileDropCallback(file); // Pass the dropped file to the callback
      } else {
        showError("CSVファイルのみドロップできます。"); // Show error for non-CSV files
      }
    }
  });

  // ヘルプトグルのイベントリスナー
  helpToggle.addEventListener("click", () => {
    const isHidden = helpContent.classList.contains("hidden");
    if (isHidden) {
      helpContent.classList.remove("hidden");
      helpToggle.textContent = "使い方を隠す";
    } else {
      helpContent.classList.add("hidden");
      helpToggle.textContent = "使い方を表示";
    }
  });

  // 警告トグルのイベントリスナー
  if (warningToggle) {
    warningToggle.addEventListener("click", () => {
      const warningContent = warningDetailsArea.querySelector(
        ".warning-content",
      );
      if (warningContent) {
        const isHidden = warningContent.classList.contains("hidden");
        if (isHidden) {
          warningContent.classList.remove("hidden");
          warningToggle.setAttribute("aria-expanded", "true");
        } else {
          warningContent.classList.add("hidden");
          warningToggle.setAttribute("aria-expanded", "false");
        }
      }
    });
  }
}
