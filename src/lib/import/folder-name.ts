/**
 * The date in a new-folder import's name — docs/07 §3.
 *
 * ISO date and 24-hour local time, deliberately not `Intl`: it names a folder
 * this extension creates in the user's browser, which outlives the UI language
 * it was created under.
 */
export function folderDate(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
