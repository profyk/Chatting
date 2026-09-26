import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import calendar from "dayjs/plugin/calendar";

dayjs.extend(relativeTime);
dayjs.extend(calendar);

export function listTime(iso?: string | null): string {
  if (!iso) return "";
  const d = dayjs(iso);
  if (d.isSame(dayjs(), "day")) return d.format("HH:mm");
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday";
  if (d.isAfter(dayjs().subtract(7, "day"))) return d.format("ddd");
  return d.format("DD/MM/YY");
}

export function messageTime(iso?: string | null): string {
  if (!iso) return "";
  return dayjs(iso).format("HH:mm");
}

export function daySeparator(iso?: string | null): string {
  if (!iso) return "";
  const d = dayjs(iso);
  if (d.isSame(dayjs(), "day")) return "Today";
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday";
  return d.format("dddd, D MMM YYYY");
}

export function lastSeen(iso?: string | null): string {
  if (!iso) return "offline";
  return `last seen ${dayjs(iso).fromNow()}`;
}

export function callTime(iso?: string | null): string {
  if (!iso) return "";
  const d = dayjs(iso);
  if (d.isSame(dayjs(), "day")) return `Today, ${d.format("HH:mm")}`;
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return `Yesterday, ${d.format("HH:mm")}`;
  return d.format("DD MMM, HH:mm");
}

export function duration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
