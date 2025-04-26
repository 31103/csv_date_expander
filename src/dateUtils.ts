/**
 * Parses a date string into a Date object.
 * Handles "M月D日" format (assumes current year) and standard formats like YYYY/MM/DD.
 * Uses UTC internally to avoid timezone issues during parsing and comparison.
 * @param dateString - The date string to parse.
 * @returns A Date object representing the UTC date, or null if parsing fails.
 */
export function parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    dateString = dateString.trim();
    const currentYear = new Date().getFullYear();

    // Try parsing "M月D日" format
    const japaneseMatch = dateString.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (japaneseMatch) {
        const month = parseInt(japaneseMatch[1], 10);
        const day = parseInt(japaneseMatch[2], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            // Create Date object using UTC values
            const date = new Date(Date.UTC(currentYear, month - 1, day));
            // Validate if the created date components match the input (handles invalid dates like Feb 30th)
            if (date.getUTCFullYear() === currentYear && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
                return date;
            }
        }
    }

    // Try parsing standard formats like YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD
    const standardizedDateString = dateString.replace(/[/\.]/g, '-'); // Replace common separators
    const parts = standardizedDateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        // Basic sanity check for year, month, day ranges
        if (year > 1000 && year < 3000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            // Create Date object using UTC values
            const date = new Date(Date.UTC(year, month - 1, day));
            // Validate if the created date components match the input
            if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
                return date;
            }
        }
    }

    // Fallback to Date constructor (less reliable, attempt UTC conversion)
    // This might interpret ambiguous formats differently, but we try to mitigate
    try {
        const date = new Date(standardizedDateString);
        if (!isNaN(date.getTime())) {
            // Convert the potentially local date to a UTC date object
            // This assumes the fallback parser interpreted the date correctly in the local timezone
            const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
             // Additional check: If parts were parsed, ensure the fallback result matches the year
             if (parts && parts.length === 3) {
                const year = parseInt(parts[0], 10);
                if (utcDate.getUTCFullYear() !== year) return null; // Avoid MM-DD-YYYY interpretation if year was present
            }
            return utcDate;
        }
    } catch (e) {
        // Ignore errors from fallback constructor
    }


    console.warn(`Could not parse date string: "${dateString}"`);
    return null; // Return null if all parsing attempts failed
}

/**
 * Formats a Date object into "YYYY/MM/DD" string using UTC values.
 * @param date - The Date object to format.
 * @returns The formatted date string.
 */
export function formatDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // getUTCMonth() is 0-indexed
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}