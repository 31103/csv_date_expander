# CSV Encoding Improvement Plan

## Problem

The current application assumes CSV files are UTF-8 encoded. This causes
mojibake (garbled characters) when processing Shift_JIS encoded files. The
output encoding requirement is flexible.

## Goal

Modify the application to correctly handle both UTF-8 and Shift_JIS encoded CSV
files automatically, without requiring user input for encoding selection.

## Proposed Solution

Implement automatic encoding detection using the `FileReader` API and the
`TextDecoder` API within the browser's JavaScript environment.

**Steps:**

1. **Modify File Reading (`src/main.ts`):**
   - Change `reader.readAsText(file, 'UTF-8');` to
     `reader.readAsArrayBuffer(file);` to read the file as binary data.
2. **Implement Decoding Logic (`src/main.ts` - `reader.onload`):**
   - Get the `ArrayBuffer` from `event.target.result`.
   - Use `TextDecoder` to decode the buffer:
     1. Check for UTF-8 BOM (Byte Order Mark - `EF BB BF`) at the beginning of
        the buffer.
     2. If BOM exists, decode as UTF-8 (`new TextDecoder('utf-8')`).
     3. If no BOM, attempt to decode as Shift\_JIS
        (`new TextDecoder('shift_jis', { fatal: true })`).
     4. If Shift\_JIS decoding fails (throws an error due to `fatal: true`),
        attempt to decode as UTF-8 (`new TextDecoder('utf-8', { fatal: true })`)
        to handle BOM-less UTF-8 files.
     5. If both attempts fail, consider the encoding unknown.
3. **Adjust Error Handling (`src/main.ts`):**
   - Provide clear error messages to the user if decoding fails (e.g., "Failed
     to determine file encoding. Please ensure the file is UTF-8 or Shift_JIS
     encoded.").
4. **Build Process (`build.ts`):**
   - No changes are expected as this solution relies on built-in browser APIs
     (`FileReader`, `TextDecoder`).

**Flowchart (Mermaid):**

```mermaid
graph TD
    A[Start: Mojibake Issue] --> B(Change read method to ArrayBuffer);
    B --> C{Decode in reader.onload};
    C --> D{Check for UTF-8 BOM};
    D -- BOM Found --> E[Decode as UTF-8];
    D -- No BOM --> F{Try Decode as Shift_JIS (fatal: true)};
    F -- Success --> G[Decoding Complete];
    F -- Error --> H{Try Decode as UTF-8 (fatal: true)};
    H -- Success --> G;
    H -- Error --> I[Unknown Encoding Error];
    E --> G;
    G --> K[Proceed to CSV Parsing];
    I --> L[Show Error to User];

    subgraph src/main.ts Changes
        B
        C
        D
        E
        F
        H
        I
        L
    end
```

## Rationale

This approach prioritizes user experience by automating the encoding detection.
It leverages standard browser APIs, minimizing the need for external libraries
and potential build process complications. The BOM check followed by Shift\_JIS
and then UTF-8 attempts covers the most common scenarios for Japanese CSV files.
