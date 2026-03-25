import { saveAs } from 'file-saver';

/**
 * Download the static template Excel file from the public folder
 * so users know how to structure their data.
 */
export async function downloadTemplate(): Promise<void> {
  const response = await fetch('/flashcard_template.xlsx');

  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  saveAs(blob, 'flashcard_template.xlsx');
}
