/**
 * Converts "/today" to today's date in YYYY-MM-DD format.
 * If the input is not "/today", returns it unchanged.
 * @param eventName - The event name entered by the user
 * @returns The event name with "/today" replaced by today's date, or the original name
 */
export function normalizeEventName(eventName: string): string {
  if (eventName === '/today') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return eventName;
}




