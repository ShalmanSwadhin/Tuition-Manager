import { formatDate } from "./date";
import type { DiaryContent } from "../types";

// wa.me wants the full international number, digits only. Bangladeshi
// numbers are usually written locally (01712345678), so add the 880 prefix.
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("880") && digits.length === 13) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `88${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
  return digits.length >= 8 ? digits : null;
}

export function diaryMessage(entry: DiaryContent, studentName: string, teacherName: string): string {
  const fields: [string, string | undefined][] = [
    ["Topic", entry.topic],
    ["Covered", entry.taughtToday],
    ["Homework", entry.homework],
    ["Next class", entry.nextPrep],
    ["Notes", entry.notes],
  ];
  return [
    `*Class diary — ${studentName}*`,
    `${formatDate(entry.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${entry.subject}`,
    ...fields.filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`),
    "",
    `— ${teacherName}`,
  ].join("\n");
}

// Opens WhatsApp (app on phones, web on desktop) with the message ready;
// the tutor presses send, so it goes from their own number. Without a
// number, WhatsApp asks which chat to send it to.
export function whatsappUrl(text: string, phone?: string): string {
  const number = phone ? toWhatsAppNumber(phone) : null;
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}
