"use client";

import { formatLocalTime } from "@/utils/date";

interface LocalTimeProps {
  isoString: string;
  formatStr?: string;
}

export default function LocalTime({ isoString, formatStr = "HH:mm" }: LocalTimeProps) {
  if (!isoString) return <span>—</span>;

  let options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  };

  if (formatStr.includes("MMM") || formatStr.includes("yyyy") || formatStr.includes("dd")) {
    options = {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    };
  }

  const timeStr = formatLocalTime(isoString, options);
  return <span>{timeStr}</span>;
}
