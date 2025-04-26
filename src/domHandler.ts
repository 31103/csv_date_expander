// Type assertion helper to ensure elements exist
function getElementByIdOrThrow<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with ID "${id}" not found.`);
    }
    return element as T;
}

// --- DOM Element References ---
export const fileInput = getElementByIdOrThrow<HTMLInputElement>('csvFile');
export const startDateColInput = getElementByIdOrThrow<HTMLInputElement>('startDateCol');
export const endDateColInput = getElementByIdOrThrow<HTMLInputElement>('endDateCol');
export const maxDaysLimitInput = getElementByIdOrThrow<HTMLInputElement>('maxDaysLimit');
export const processBtn = getElementByIdOrThrow<HTMLButtonElement>('processBtn');
export const downloadContainer = getElementByIdOrThrow<HTMLDivElement>('downloadContainer');
export const downloadBtn = getElementByIdOrThrow<HTMLButtonElement>('downloadBtn');
export const errorDiv = getElementByIdOrThrow<HTMLDivElement>('error');
export const statusDiv = getElementByIdOrThrow<HTMLDivElement>('status');

// --- UI Update Functions ---

/** Displays an error message. */
export function showError(message: string): void {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    statusDiv.classList.add('hidden');
    downloadContainer.classList.add('hidden');
}

/** Hides the error message area. */
export function clearError(): void {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
}

/** Displays a status message. */
export function showStatus(message: string): void {
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
    clearError(); // Clear any previous errors when showing status
}

/** Hides the status message area. */
export function clearStatus(): void {
    statusDiv.textContent = '';
    statusDiv.classList.add('hidden');
}

/** Shows the download button and container. */
export function showDownloadArea(): void {
    downloadContainer.classList.remove('hidden');
}

/** Hides the download button and container. */
export function hideDownloadArea(): void {
    downloadContainer.classList.add('hidden');
}

/** Sets the state of the process button (disabled/enabled and text). */
export function setProcessButtonState(isLoading: boolean): void {
    processBtn.disabled = isLoading;
    processBtn.textContent = isLoading ? '処理中...' : '処理実行';
}

/** Appends warning details to the status message. */
export function appendWarningDetails(details: string): void {
    if (statusDiv.textContent && !statusDiv.classList.contains('hidden')) {
        statusDiv.textContent += ` (${details})`;
    }
}


// --- Event Listener Setup ---

/**
 * Attaches event listeners to the buttons.
 * @param processCallback - Function to call when the process button is clicked.
 * @param downloadCallback - Function to call when the download button is clicked.
 */
export function setupEventListeners(processCallback: () => void, downloadCallback: () => void): void {
    processBtn.addEventListener('click', processCallback);
    downloadBtn.addEventListener('click', downloadCallback);
}