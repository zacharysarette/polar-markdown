const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function isSupportedImageType(mime: string): boolean {
  return SUPPORTED_TYPES.has(mime);
}

export function generateImageFilename(mime: string): string {
  const ext = MIME_TO_EXT[mime] ?? "png";
  const now = new Date();
  const date = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, "0")
    + String(now.getDate()).padStart(2, "0");
  const time = String(now.getHours()).padStart(2, "0")
    + String(now.getMinutes()).padStart(2, "0")
    + String(now.getSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  return `image-${date}-${time}-${rand}.${ext}`;
}

export function buildMarkdownImageRef(filename: string): string {
  return `![${filename}](assets/${filename})`;
}

export function getImageFromTransfer(dataTransfer: DataTransfer): File | null {
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (isSupportedImageType(file.type)) {
      return file;
    }
  }
  return null;
}

export async function fileToBytes(file: File): Promise<number[]> {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}
