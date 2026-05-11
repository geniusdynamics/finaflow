// ABOUTME: Provides client-side validation and optimization for business logo uploads.
// ABOUTME: Normalizes logo payloads before API submission to keep page components minimal.
export const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const;
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_WIDTH = 512;

type OptimizedLogoPayload = {
  fileData: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function scaleDimensions(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_LOGO_WIDTH) {
    return { width, height };
  }

  const ratio = MAX_LOGO_WIDTH / width;
  return {
    width: MAX_LOGO_WIDTH,
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export function isAllowedLogoType(mimeType: string): boolean {
  return ALLOWED_LOGO_TYPES.includes(mimeType as (typeof ALLOWED_LOGO_TYPES)[number]);
}

export function validateLogoFileSizeBytes(size: number): boolean {
  return size <= MAX_LOGO_SIZE_BYTES;
}

export async function optimizeLogoFile(file: File): Promise<OptimizedLogoPayload> {
  if (!isAllowedLogoType(file.type)) {
    throw new Error("Unsupported logo format. Allowed: JPEG, PNG, SVG.");
  }

  if (!validateLogoFileSizeBytes(file.size)) {
    throw new Error("Logo exceeds 5MB maximum size.");
  }

  if (file.type === "image/svg+xml") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      fileData: bytesToBase64(bytes),
      mimeType: file.type,
      width: null,
      height: null,
      sizeBytes: file.size,
    };
  }

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      fileData: bytesToBase64(bytes),
      mimeType: file.type,
      width: null,
      height: null,
      sizeBytes: file.size,
    };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to optimize logo image.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to encode optimized logo."))),
      file.type,
      0.9
    );
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    fileData: bytesToBase64(bytes),
    mimeType: file.type,
    width,
    height,
    sizeBytes: blob.size,
  };
}
