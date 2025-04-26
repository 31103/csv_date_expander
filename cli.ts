import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";
import { generateCSV, parseCSV } from "./src/csvParser.ts"; // Import parseCSV and generateCSV
import { formatDate, parseDate } from "./src/dateUtils.ts"; // Import date functions

// --- Type Definitions (Ported from domHandler.ts) ---
/** Represents information about a specific type of warning during processing. */
interface WarningInfo {
  type: string; // e.g., "日付解析エラー", "上限超過"
  count: number;
}

/** Represents a detailed warning for a specific row. */
interface DetailedWarning {
  rowNumber: number; // 1-based original row number
  type: string; // e.g., "日付解析エラー", "上限超過"
  message: string; // Detailed message including relevant data
}

// --- Helper Functions ---

/**
 * Helper function to decode ArrayBuffer/Uint8Array to CSV text, handling BOM and encodings.
 * @param buffer The Uint8Array containing file data.
 * @returns The decoded CSV text string.
 * @throws Error if decoding fails.
 */
function decodeCsvText(buffer: Uint8Array): string {
  try {
    // Check for UTF-8 BOM (EF BB BF)
    const bom = buffer.slice(0, 3);
    if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
      console.log("Decoding as UTF-8 (BOM detected)");
      return new TextDecoder("utf-8").decode(buffer.slice(3));
    } else {
      // No BOM detected, try Shift_JIS first
      try {
        console.log("Attempting to decode as Shift_JIS");
        const decoded = new TextDecoder("shift_jis", { fatal: true }).decode(
          buffer,
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
            buffer,
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
 * Processes the data rows to expand dates. (Ported from main.ts and adapted for CLI)
 * @param originalDataRows The rows to process (excluding header).
 * @param originalHeader The original header row.
 * @param startDateColIndex 0-based index of the start date column.
 * @param endDateColIndex 0-based index of the end date column.
 * @param maxDaysLimit Maximum number of days to expand per row.
 * @returns An object containing processed rows, warning summary, and detailed warnings.
 */
function processDataRows(
  originalDataRows: string[][],
  originalHeader: string[], // Kept for context in warnings
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
        message: `列数が不足しています (${row.length}列)。期待される最小列数: ${
          Math.max(startDateColIndex, endDateColIndex) + 1
        }`,
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
    let loopCount = 0;
    // Add a safety break for potential infinite loops
    const maxLoops = Math.max(totalDaysToExpand + 10, maxDaysLimit + 10);

    while (
      currentDate.getTime() <= finalEndDate.getTime() &&
      expandedCount < maxDaysLimit &&
      loopCount < maxLoops // Safety break
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
      loopCount < maxLoops // Ensure it wasn't the safety break
    ) {
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
      // This indicates a potential issue in the loop logic or date calculation
      console.error(
        `行 ${rowNumberForError}: 日付展開ループが予期せず最大回数 (${maxLoops}) に達しました。スキップします。`,
      );
      invalidRangeRowCount++; // Count as a range/processing error
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

// --- Main Logic ---

const HELP_MESSAGE = `
Usage:
  deno run --allow-read --allow-write cli.ts --file <input_csv_path> --start-col <start_date_column_number> --end-col <end_date_column_number> [options]

Required Arguments:
  --file <path>        Path to the input CSV file.
  --start-col <number> Column number (1-based) containing the start date.
  --end-col <number>   Column number (1-based) containing the end date.

Options:
  --limit <number>     Maximum number of expanded rows per input row (default: 365).
  --output <path>      Path for the output CSV file (default: output.csv).
  --help               Show this help message.
`;

async function main() {
  try {
    const parsedArgs = parseArgs(Deno.args, {
      // Remove 'number' option, parse manually later
      string: ["file", "output", "start-col", "end-col", "limit"],
      boolean: ["help"],
      alias: {
        "h": "help",
        "f": "file",
        "s": "start-col",
        "e": "end-col",
        "l": "limit",
        "o": "output",
      },
      default: {
        // Keep defaults as strings or numbers as appropriate for parsing
        limit: "365",
        output: "output.csv",
        help: false,
      },
    });

    // Destructure args
    const { file, output, help } = parsedArgs;
    const startColStr = parsedArgs["start-col"]; // Access using string key
    const endColStr = parsedArgs["end-col"];
    const limitStr = parsedArgs["limit"];

    if (help) {
      console.log(HELP_MESSAGE);
      Deno.exit(0);
    }

    // --- Basic Validation ---
    if (!file || startColStr === undefined || endColStr === undefined) { // Check string presence
      console.error("Error: Missing required arguments.\n");
      console.error(HELP_MESSAGE);
      Deno.exit(1);
    }

    // --- Parse and Validate Numeric Arguments ---
    const startCol = parseInt(startColStr, 10);
    const endCol = parseInt(endColStr, 10);
    const limit = parseInt(limitStr, 10);

    if (isNaN(startCol) || startCol <= 0) {
      console.error(
        `Error: --start-col must be a positive integer. Received: ${startColStr}`,
      );
      console.error(HELP_MESSAGE);
      Deno.exit(1);
    }
    if (isNaN(endCol) || endCol <= 0) {
      console.error(
        `Error: --end-col must be a positive integer. Received: ${endColStr}`,
      );
      console.error(HELP_MESSAGE);
      Deno.exit(1);
    }
    if (isNaN(limit) || limit <= 0) {
      console.error(
        `Error: --limit must be a positive integer. Received: ${limitStr}`,
      );
      console.error(HELP_MESSAGE);
      Deno.exit(1);
    }

    // --- File Reading and Parsing ---
    console.log(`Reading file: ${file}...`);
    const fileContentUint8Array = await Deno.readFile(file);
    console.log("Decoding file content...");
    const csvText = decodeCsvText(fileContentUint8Array);
    console.log("Parsing CSV data...");
    const parsedData = parseCSV(csvText);

    if (!parsedData || parsedData.length === 0) {
      console.error("Error: CSV file is empty or could not be parsed.");
      Deno.exit(1);
    }

    const header = parsedData[0];
    const dataRows = parsedData.slice(1);

    console.log(
      `CSV Parsed: ${header.length} columns, ${dataRows.length} data rows.`,
    );

    // --- Further Validation (Column Indices) ---
    const startDateColIndex = startCol - 1; // Convert 1-based to 0-based
    const endDateColIndex = endCol - 1; // Convert 1-based to 0-based

    if (startDateColIndex < 0 || startDateColIndex >= header.length) {
      console.error(
        `Error: Start date column number (${startCol}) is out of range (1-${header.length}).`,
      );
      Deno.exit(1);
    }
    if (endDateColIndex < 0 || endDateColIndex >= header.length) {
      console.error(
        `Error: End date column number (${endCol}) is out of range (1-${header.length}).`,
      );
      Deno.exit(1);
    }
    if (startDateColIndex === endDateColIndex) {
      console.error(
        "Error: Start date and end date columns cannot be the same.",
      );
      Deno.exit(1);
    }

    console.log("Arguments and CSV parsed successfully:");
    console.log(`  Input File: ${file}`);
    console.log(
      `  Start Column: ${startCol} (Name: ${header[startDateColIndex]})`,
    );
    console.log(`  End Column: ${endCol} (Name: ${header[endDateColIndex]})`);
    console.log(`  Limit: ${limit}`);
    console.log(`  Output File: ${output}`);

    // --- Date Expansion Logic ---
    console.log("\nProcessing data rows...");
    const { processedRows, warningsSummary, detailedWarnings } =
      processDataRows(
        dataRows,
        header,
        startDateColIndex,
        endDateColIndex,
        limit,
      );

    console.log(`Processing complete. ${processedRows.length} rows generated.`);

    // --- Display Warnings ---
    if (warningsSummary.length > 0) {
      console.warn("\nWarnings encountered during processing:");
      warningsSummary.forEach((w) => {
        console.warn(`  - ${w.type}: ${w.count}行`);
      });

      console.warn("\nDetailed Warnings:");
      detailedWarnings.forEach((dw) => {
        console.warn(`  - 行 ${dw.rowNumber}: [${dw.type}] ${dw.message}`);
      });
    } else {
      console.log("No warnings encountered.");
    }

    // --- CSV Writing Logic ---
    if (processedRows.length > 0) {
      console.log(`\nGenerating CSV content for output file: ${output}...`);
      const newHeader = ["EXPANDDATE", ...header];
      const outputCsvString = generateCSV(newHeader, processedRows);

      try {
        console.log(`Writing CSV to ${output}...`);
        // Remove the unsupported 'encoding' option
        await Deno.writeTextFile(output, outputCsvString);
        console.log(
          `Successfully wrote ${processedRows.length} expanded rows to ${output}`,
        );
      } catch (writeError) {
        console.error(`\nError writing output file to ${output}:`);
        if (writeError instanceof Error) {
          if (writeError.name === "PermissionDenied") {
            console.error(
              `  Permission denied to write file: ${output}`,
            );
          } else {
            console.error(`  ${writeError.message}`);
          }
        } else {
          console.error(`  An unexpected error occurred: ${writeError}`);
        }
        Deno.exit(1); // Exit if writing fails
      }
    } else {
      console.log("\nNo data to write to output file.");
    }

    console.log("\nCLI execution finished.");
  } catch (error) {
    console.error("\n--- An error occurred during execution ---");
    if (error instanceof Error) {
      // Handle specific Deno errors more gracefully
      if (error.name === "NotFound") {
        console.error(
          `Error: Input file not found. Path: ${error.message.split('"')[1]}`, // Attempt to extract path
        );
      } else if (error.name === "PermissionDenied") {
        console.error(
          `Error: Permission denied to read file. Path: ${
            error.message.split('"')[1]
          }`, // Attempt to extract path
        );
      } else {
        console.error(`Error: ${error.message}`);
        // Optionally print stack trace for unexpected errors
        // console.error(error.stack);
      }
    } else {
      console.error(`An unexpected error occurred: ${error}`);
    }
    // Avoid printing help message for file/processing errors
    Deno.exit(1);
  }
}

// Run the main function
main();
