import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";
import { readAll } from "https://deno.land/std@0.224.0/io/read_all.ts"; // Import readAll
import { generateCSV, parseCSV } from "./src/csvParser.ts"; // Import parseCSV and generateCSV
import { formatDate, parseDate } from "./src/dateUtils.ts"; // Import date functions

const VERSION = "0.2.0"; // Define the CLI version

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
function decodeCsvText(buffer: Uint8Array, isVerbose: boolean): string { // Add isVerbose parameter
  try {
    // Check for UTF-8 BOM (EF BB BF)
    const bom = buffer.slice(0, 3);
    if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) {
      if (isVerbose) console.error("Decoding as UTF-8 (BOM detected)"); // Log to stderr if verbose
      return new TextDecoder("utf-8").decode(buffer.slice(3));
    } else {
      // No BOM detected, try UTF-8 first (more common)
      try {
        if (isVerbose) console.error("Attempting to decode as UTF-8 (no BOM)");
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          buffer,
        );
        if (isVerbose) console.error("Successfully decoded as UTF-8 (no BOM)");
        return decoded;
      } catch (utf8Error) {
        // If UTF-8 fails, try Shift_JIS
        if (isVerbose) {
          console.error(
            "UTF-8 (no BOM) decoding failed, attempting Shift_JIS",
            // utf8Error // Optionally log the error details if verbose
          );
        }
        try {
          if (isVerbose) console.error("Attempting to decode as Shift_JIS");
          const decoded = new TextDecoder("shift_jis", { fatal: true }).decode(
            buffer,
          );
          if (isVerbose) console.error("Successfully decoded as Shift_JIS");
          return decoded;
        } catch (shiftJisError) {
          console.error( // Always log the final failure
            "Failed to decode as both UTF-8 (no BOM) and Shift_JIS.",
            // shiftJisError // Optionally log the error details
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
CSV Date Expander CLI v${VERSION}

Expands CSV rows based on a date range specified in columns.
Reads from standard input and writes to standard output by default.

Usage:
  deno run --allow-read --allow-write cli.ts --start-col <number> --end-col <number> [options] [flags]
  cat input.csv | deno run --allow-read --allow-write cli.ts --start-col <number> --end-col <number> [options] [flags] > output.csv

Required Arguments:
  --start-col, -s <number> Column number (1-based) containing the start date.
  --end-col, -e <number>   Column number (1-based) containing the end date.

Options:
  --input, -i <path>     Path to the input CSV file (reads from stdin if omitted).
  --output, -o <path>    Path for the output CSV file (writes to stdout if omitted).
                         Output is always UTF-8 with BOM when writing to a file.
  --limit, -l <number>   Maximum number of expanded rows per input row (default: 365).

Flags:
  --verbose, -v          Enable verbose logging to stderr.
  --version, -V          Show version information.
  --help, -h             Show this help message.
`;

async function main() {
  let verbose = false; // Define verbose outside try block
  try {
    const parsedArgs = parseArgs(Deno.args, {
      string: ["input", "output", "start-col", "end-col", "limit"], // Changed file to input
      boolean: ["help", "verbose", "version"], // Added verbose, version
      alias: {
        "h": "help",
        "i": "input", // Changed f to i
        "s": "start-col",
        "e": "end-col",
        "l": "limit",
        "o": "output",
        "v": "verbose", // Added v
        "V": "version", // Added V
      },
      default: {
        // Keep defaults as strings or numbers as appropriate for parsing
        limit: "365",
        // Removed output default
        help: false,
        verbose: false, // Added verbose default
        version: false, // Added version default
      },
    });

    // Destructure args
    const { input, output, help, version } = parsedArgs; // verbose is already defined
    verbose = parsedArgs.verbose; // Assign value here
    const startColStr = parsedArgs["start-col"];
    const endColStr = parsedArgs["end-col"];
    const limitStr = parsedArgs["limit"];

    if (help) {
      console.log(HELP_MESSAGE);
      Deno.exit(0);
    }

    if (version) {
      console.log(`csv-date-expander-cli v${VERSION}`);
      Deno.exit(0);
    }

    // --- Basic Validation ---
    // Removed input check from here, it's optional now
    if (startColStr === undefined || endColStr === undefined) {
      console.error(
        "Error: Missing required arguments (--start-col, --end-col).\n",
      );
      console.error(HELP_MESSAGE);
      Deno.exit(1); // Exit code 1 for argument errors
    }

    // --- Parse and Validate Numeric Arguments ---
    const startCol = parseInt(startColStr, 10);
    const endCol = parseInt(endColStr, 10);
    const limit = parseInt(limitStr, 10);

    if (isNaN(startCol) || startCol <= 0) {
      console.error(
        `Error: --start-col must be a positive integer. Received: ${startColStr}`,
      );
      Deno.exit(1);
    }
    if (isNaN(endCol) || endCol <= 0) {
      console.error(
        `Error: --end-col must be a positive integer. Received: ${endColStr}`,
      );
      Deno.exit(1);
    }
    if (isNaN(limit) || limit <= 0) {
      console.error(
        `Error: --limit must be a positive integer. Received: ${limitStr}`,
      );
      Deno.exit(1);
    }

    // --- Input Reading ---
    let csvText: string;
    if (input) {
      if (verbose) console.error(`Reading file: ${input}...`); // Log to stderr if verbose
      try {
        const fileContentUint8Array = await Deno.readFile(input);
        if (verbose) console.error("Decoding file content...");
        csvText = decodeCsvText(fileContentUint8Array, verbose); // Pass verbose flag
      } catch (readError) {
        console.error(`\nError reading input file: ${input}`);
        if (readError instanceof Error) {
          if (readError.name === "NotFound") {
            console.error(`  File not found.`);
          } else if (readError.name === "PermissionDenied") {
            console.error(`  Permission denied.`);
          } else {
            console.error(`  ${readError.message}`);
          }
        } else {
          console.error(`  An unexpected error occurred: ${readError}`);
        }
        Deno.exit(2); // Exit code 2 for I/O errors
      }
    } else {
      if (verbose) console.error("Reading from standard input...");
      try {
        const stdinContentUint8Array = await readAll(Deno.stdin); // Use imported readAll
        if (stdinContentUint8Array.length === 0) {
          console.error("Error: Standard input is empty.");
          Deno.exit(1); // Exit code 1 for Argument/Usage error
        }
        if (verbose) console.error("Decoding stdin content...");
        csvText = decodeCsvText(stdinContentUint8Array, verbose); // Pass verbose flag
      } catch (stdinError) {
        console.error(`\nError reading from standard input:`);
        console.error(
          stdinError instanceof Error
            ? `  ${stdinError.message}`
            : `  ${stdinError}`,
        );
        Deno.exit(2); // Exit code 2 for I/O error
      }
    }

    // --- CSV Parsing ---
    if (verbose) console.error("Parsing CSV data...");
    const parsedData = parseCSV(csvText);

    if (!parsedData || parsedData.length === 0) {
      console.error(
        "Error: Input data is empty or could not be parsed as CSV.",
      );
      Deno.exit(3); // Exit code 3 for processing errors
    }

    const header = parsedData[0];
    const dataRows = parsedData.slice(1);

    if (verbose) {
      console.error(
        `CSV Parsed: ${header.length} columns, ${dataRows.length} data rows.`,
      );
    }

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

    if (verbose) {
      console.error("\nArguments and CSV parsed successfully:");
      console.error(`  Input Source: ${input ? input : "stdin"}`);
      console.error(
        `  Start Column: ${startCol} (Name: ${header[startDateColIndex]})`,
      );
      console.error(
        `  End Column: ${endCol} (Name: ${header[endDateColIndex]})`,
      );
      console.error(`  Limit: ${limit}`);
      console.error(`  Output Target: ${output ? output : "stdout"}`);
    }

    // --- Date Expansion Logic ---
    if (verbose) console.error("\nProcessing data rows...");
    const { processedRows, warningsSummary, detailedWarnings } =
      processDataRows(
        dataRows,
        header,
        startDateColIndex,
        endDateColIndex,
        limit,
      );

    if (verbose) {
      console.error(
        `Processing complete. ${processedRows.length} rows generated.`,
      );
    }

    // --- Display Warnings (to stderr) ---
    if (warningsSummary.length > 0) {
      console.error("\nWarnings encountered during processing:"); // Use console.error for warnings
      warningsSummary.forEach((w) => {
        console.error(`  - ${w.type}: ${w.count}行`);
      });

      console.error("\nDetailed Warnings:");
      detailedWarnings.forEach((dw) => {
        console.error(`  - 行 ${dw.rowNumber}: [${dw.type}] ${dw.message}`);
      });
    } else {
      if (verbose) console.error("No warnings encountered.");
    }

    // --- Output Writing Logic ---
    if (processedRows.length > 0) {
      if (verbose) console.error(`\nGenerating CSV content...`);
      const newHeader = ["EXPANDDATE", ...header];
      const outputCsvString = generateCSV(newHeader, processedRows);

      if (output) {
        // Write to file
        if (verbose) console.error(`Writing CSV to file: ${output}...`);
        try {
          // Add UTF-8 BOM before writing
          const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
          const dataBytes = new TextEncoder().encode(outputCsvString);
          const outputBuffer = new Uint8Array(bom.length + dataBytes.length);
          outputBuffer.set(bom, 0);
          outputBuffer.set(dataBytes, bom.length);

          await Deno.writeFile(output, outputBuffer); // Use writeFile for binary data
          if (verbose) {
            console.error(
              `Successfully wrote ${processedRows.length} expanded rows to ${output}`,
            );
          }
        } catch (writeError) {
          console.error(`\nError writing output file to ${output}:`);
          if (writeError instanceof Error) {
            if (writeError.name === "PermissionDenied") {
              console.error(`  Permission denied.`);
            } else {
              console.error(`  ${writeError.message}`);
            }
          } else {
            console.error(`  An unexpected error occurred: ${writeError}`);
          }
          Deno.exit(2); // Exit code 2 for I/O error
        }
      } else {
        // Write to standard output
        if (verbose) console.error("Writing CSV to standard output...");
        try {
          // No BOM for stdout
          await Deno.stdout.write(new TextEncoder().encode(outputCsvString));
        } catch (stdoutError) {
          console.error(`\nError writing to standard output:`);
          console.error(
            stdoutError instanceof Error
              ? `  ${stdoutError.message}`
              : `  ${stdoutError}`,
          );
          // Don't exit here, maybe the pipe broke, but processing was ok
          // Deno.exit(2); // I/O error - Decided against exiting here
          if (verbose) {
            console.error(
              "Standard output write may have failed (e.g., broken pipe).",
            );
          }
        }
      }
    } else {
      if (verbose) console.error("\nNo data to write to output.");
    }

    if (verbose) console.error("\nCLI execution finished successfully.");
  } catch (error) {
    // General error catching - already handled specific errors with exit codes
    console.error("\n--- An unexpected error occurred during execution ---");
    console.error(error instanceof Error ? error.message : error);
    // Accessing verbose here is now safe
    if (verbose && error instanceof Error && error.stack) {
      console.error(error.stack); // Print stack trace if verbose
    }
    // Use a generic error code if not already exited
    Deno.exit(1); // Exit code 1 for Generic error
  }
}

// Run the main function
main();
