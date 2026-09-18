import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { config } from "../lib/config.js";

/**
 * Storage adapter interface. Kept intentionally narrow so we can swap the
 * local implementation for S3/Cloudinary later without touching route
 * handlers — only the wiring in `resolveStorage()` changes.
 */
export interface StorageAdapter {
  save(input: SaveInput): Promise<StoredFile>;
  delete(url: string): Promise<void>;
}

export interface SaveInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Optional subdirectory under the storage root, e.g. `bookings/ORD-8921`. */
  scope?: string;
}

export interface StoredFile {
  url: string; // Absolute URL callers can hand to the browser.
  key: string; // Storage-internal identifier the adapter can look up later.
  size: number;
  mimeType: string;
}

/**
 * Local-disk adapter for development. Writes into UPLOAD_DIR and serves via
 * the static /uploads mount registered in server.ts.
 */
export class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  async save({ buffer, originalName, mimeType, scope }: SaveInput): Promise<StoredFile> {
    const safeScope = (scope ?? "misc").replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = path.join(this.root, safeScope);
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(originalName) || "";
    const key = `${randomUUID()}${ext}`;
    const abs = path.join(dir, key);
    await fs.writeFile(abs, buffer);
    return {
      url: `/uploads/${safeScope}/${key}`,
      key: path.join(safeScope, key).replace(/\\/g, "/"),
      size: buffer.length,
      mimeType,
    };
  }

  async delete(url: string): Promise<void> {
    // Only accept URLs we minted, so a caller cannot ask us to delete an
    // arbitrary file on disk.
    if (!url.startsWith("/uploads/")) return;
    const rel = url.replace(/^\/uploads\//, "");
    const abs = path.join(this.root, rel);
    await fs.unlink(abs).catch(() => undefined);
  }
}

let cached: StorageAdapter | null = null;
export function resolveStorage(): StorageAdapter {
  if (!cached) {
    cached = new LocalDiskStorage(path.resolve(config.UPLOAD_DIR));
  }
  return cached;
}
