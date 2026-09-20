export const arabicMonths = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function youtubeEmbedUrl(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/) ?? null;
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function formatBytes(bytes?: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const contentTypeLabels: Record<string, string> = {
  video: "فيديو",
  image: "صورة",
  file: "ملف",
  link: "رابط",
  text: "شرح مكتوب",
};

export const postTypeLabels: Record<string, string> = {
  announcement: "إعلان",
  video: "فيديو",
  image: "صورة",
  file: "ملف",
  link: "رابط",
  text: "شرح",
};
