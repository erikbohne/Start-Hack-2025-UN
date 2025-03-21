import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Triggers a file download in the browser
 */
export function downloadAsFile(data: any, filename: string, type: string = 'application/json') {
  // Convert to string if it's an object
  const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
  
  // Create a blob
  const blob = new Blob([content], { type });
  
  // Create a URL for the blob
  const url = URL.createObjectURL(blob);
  
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Append the link to the body
  document.body.appendChild(link);
  
  // Trigger a click on the link
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}