export function formatLocalTime(
  isoString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hour12: false }
): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', options).format(date);
  } catch (e) {
    return '—';
  }
}
