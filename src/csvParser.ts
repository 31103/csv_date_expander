/**
 * Basic CSV parser. Splits by lines, then by commas.
 * Handles simple cases, trims whitespace. Does NOT handle quoted fields containing commas or newlines correctly.
 * For more robust parsing, a dedicated library would be needed.
 * @param text - The CSV text content.
 * @returns An array of arrays representing rows and cells.
 */
export function parseCSV(text: string): string[][] {
  // Normalize line endings and trim whitespace
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split(
    "\n",
  );
  // Split each line by comma and trim each cell
  return lines.map((line) => line.split(",").map((cell) => cell.trim()));
}

/**
 * Generates a CSV string from header and data arrays.
 * Handles potential commas, quotes, and newlines in data by quoting fields
 * according to RFC 4180 rules.
 * @param header - Array of header strings.
 * @param data - Array of arrays representing data rows.
 * @returns The generated CSV string.
 */
export function generateCSV(
  header: string[],
  data: (string | number | Date | null | undefined)[][],
): string {
  /**
   * Escapes a single field for CSV output.
   * If the field contains a comma, double quote, or newline, it's enclosed in double quotes.
   * Existing double quotes within the field are doubled.
   * @param field - The value to escape.
   */
  const escapeCsvField = (
    field: string | number | Date | null | undefined,
  ): string => {
    // Convert field to string, handling null/undefined
    const stringField = field instanceof Date
      ? field.toISOString()
      : String(field ?? "");

    // Check if quoting is necessary
    if (/[",\n\r]/.test(stringField)) {
      // Enclose in double quotes and double any existing double quotes
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    // Return the field as is if no special characters are found
    return stringField;
  };

  // Map header and data rows using the escape function
  const csvRows = [
    header.map(escapeCsvField).join(","), // Process header row
    ...data.map((row) => row.map(escapeCsvField).join(",")), // Process data rows
  ];

  // Join all rows with newline characters
  return csvRows.join("\n");
}
