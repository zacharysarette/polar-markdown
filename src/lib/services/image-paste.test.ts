import { describe, it, expect } from "vitest";
import {
  isSupportedImageType,
  generateImageFilename,
  buildMarkdownImageRef,
  getImageFromTransfer,
  fileToBytes,
} from "./image-paste";

describe("isSupportedImageType", () => {
  it("returns true for supported types", () => {
    expect(isSupportedImageType("image/png")).toBe(true);
    expect(isSupportedImageType("image/jpeg")).toBe(true);
    expect(isSupportedImageType("image/gif")).toBe(true);
    expect(isSupportedImageType("image/webp")).toBe(true);
  });

  it("returns false for unsupported types", () => {
    expect(isSupportedImageType("image/svg+xml")).toBe(false);
    expect(isSupportedImageType("text/plain")).toBe(false);
    expect(isSupportedImageType("application/pdf")).toBe(false);
    expect(isSupportedImageType("")).toBe(false);
  });
});

describe("generateImageFilename", () => {
  it("generates .png for image/png", () => {
    const name = generateImageFilename("image/png");
    expect(name).toMatch(/^image-\d{8}-\d{6}-[0-9a-f]{4}\.png$/);
  });

  it("generates .jpg for image/jpeg", () => {
    const name = generateImageFilename("image/jpeg");
    expect(name).toMatch(/\.jpg$/);
  });

  it("generates .gif for image/gif", () => {
    const name = generateImageFilename("image/gif");
    expect(name).toMatch(/\.gif$/);
  });

  it("generates .webp for image/webp", () => {
    const name = generateImageFilename("image/webp");
    expect(name).toMatch(/\.webp$/);
  });

  it("generates unique names", () => {
    const a = generateImageFilename("image/png");
    const b = generateImageFilename("image/png");
    // Highly unlikely to be the same due to random hex
    expect(a).not.toBe(b);
  });
});

describe("buildMarkdownImageRef", () => {
  it("builds correct markdown syntax", () => {
    expect(buildMarkdownImageRef("photo.png")).toBe("![photo.png](assets/photo.png)");
  });

  it("handles filenames with special characters", () => {
    expect(buildMarkdownImageRef("my image.jpg")).toBe("![my image.jpg](assets/my image.jpg)");
  });
});

describe("getImageFromTransfer", () => {
  it("returns null when no files", () => {
    const dt = { files: [] as File[] } as unknown as DataTransfer;
    expect(getImageFromTransfer(dt)).toBeNull();
  });

  it("returns null when no image files", () => {
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const dt = { files: [file] } as unknown as DataTransfer;
    expect(getImageFromTransfer(dt)).toBeNull();
  });

  it("returns the first image file", () => {
    const txt = new File(["hello"], "test.txt", { type: "text/plain" });
    const img = new File(["fake"], "photo.png", { type: "image/png" });
    const dt = { files: [txt, img] } as unknown as DataTransfer;
    expect(getImageFromTransfer(dt)).toBe(img);
  });

  it("returns null for unsupported image types", () => {
    const svg = new File(["<svg>"], "icon.svg", { type: "image/svg+xml" });
    const dt = { files: [svg] } as unknown as DataTransfer;
    expect(getImageFromTransfer(dt)).toBeNull();
  });
});

describe("fileToBytes", () => {
  it("converts a file to a number array", async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([data], "test.png", { type: "image/png" });
    const bytes = await fileToBytes(file);
    expect(bytes).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("returns empty array for empty file", async () => {
    const file = new File([], "empty.png", { type: "image/png" });
    const bytes = await fileToBytes(file);
    expect(bytes).toEqual([]);
  });
});
