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
export const startDateColInput = getElementByIdOrThrow<HTMLInputElement>(
  "startDateCol",
);
export const endDateColInput = getElementByIdOrThrow<HTMLInputElement>(
  "endDateCol",
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
); // Added
export const warningList = getElementByIdOrThrow<HTMLUListElement>(
  "warningList",
); // Added
export const selectedFileNameDiv = getElementByIdOrThrow<HTMLDivElement>(
  "selectedFileName",
); // Added for displaying filename

export const fileDropArea = getElementByIdOrThrow<HTMLDivElement>(
  "fileDropArea",
); // Added for drag & drop

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

/** Displays the selected file name. */
export function showSelectedFileName(fileName: string): void {
  selectedFileNameDiv.textContent = `選択中のファイル: ${fileName}`;
  selectedFileNameDiv.classList.remove("hidden");
}

/** Clears the displayed selected file name. */
export function clearSelectedFileName(): void {
  selectedFileNameDiv.textContent = "";
  selectedFileNameDiv.classList.add("hidden");
}

/** Displays an error message. */
export function showError(message: string): void {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
  statusDiv.classList.add("hidden"); // Hide status when error occurs
  downloadContainer.classList.add("hidden"); // Hide download when error occurs
  hideWarningDetailsArea(); // Hide warning details when error occurs
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
  // Warning details list is handled separately
}

/** Hides the status message area. */
export function clearStatus(): void {
  statusDiv.textContent = ""; // Clear textContent
  statusDiv.classList.add("hidden");
  // When status is cleared, also clear selected file name if no file is selected
  // This logic is now handled in updateSelectedFile in main.ts
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
  fileDropCallback: (file: File) => void, // Added for drag & drop
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
}
