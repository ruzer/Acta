import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  brandingAssetLimits,
  type BrandingAssetKind,
} from "@requirements/contracts";

/*
 * Logos and favicons are raster images checked by their own bytes: the type the
 * browser reports, the extension or a name is never trusted. SVG is refused on
 * purpose (it can carry scripts); a vector mark can still be shipped as a static
 * file by the operator, as before.
 */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_END = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const bounds = {
  logo: { min: 16, max: 2000, square: false },
  logoSecondary: { min: 16, max: 2000, square: false },
  favicon: { min: 16, max: 512, square: true },
} as const;
export type InspectedImage = {
  contentType: string;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
};

function jpegSize(bytes: Buffer) {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = bytes.readUInt16BE(at + 2);
    const frame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (frame)
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      };
    at += 2 + length;
  }
  return null;
}
function icoSize(bytes: Buffer) {
  if (
    bytes.length < 22 ||
    bytes.readUInt16LE(0) !== 0 ||
    bytes.readUInt16LE(2) !== 1
  )
    return null;
  const count = bytes.readUInt16LE(4);
  if (count < 1 || count > 16 || bytes.length < 6 + 16 * count) return null;
  let width = 0;
  let height = 0;
  for (let i = 0; i < count; i++) {
    const entry = 6 + 16 * i;
    const size = bytes.readUInt32LE(entry + 8);
    const offset = bytes.readUInt32LE(entry + 12);
    if (size < 1 || offset + size > bytes.length) return null;
    width = Math.max(width, bytes[entry]! || 256);
    height = Math.max(height, bytes[entry + 1]! || 256);
  }
  return { width, height };
}
function reject(message: string): never {
  throw new BadRequestException(message);
}

export function inspectImage(
  kind: BrandingAssetKind,
  bytes: Buffer,
): InspectedImage {
  const limits = brandingAssetLimits[kind];
  if (bytes.length === 0) reject("El archivo está vacío.");
  if (bytes.length > limits.maxBytes)
    reject(
      `El archivo es demasiado grande: el máximo es ${Math.round(limits.maxBytes / 1024)} KB.`,
    );
  const head = bytes.subarray(0, 512).toString("latin1").trimStart();
  if (/^(<\?xml|<svg|<!doctype)/i.test(head) || /<svg[\s>]/i.test(head))
    reject(
      "Las imágenes SVG no se admiten por seguridad. Usa PNG o JPEG (o PNG o ICO para el favicon).",
    );
  let contentType: string;
  let size: { width: number; height: number } | null = null;
  if (bytes.subarray(0, 8).equals(PNG)) {
    contentType = "image/png";
    if (
      bytes.length > 33 &&
      bytes.readUInt32BE(8) === 13 &&
      bytes.toString("latin1", 12, 16) === "IHDR" &&
      bytes.subarray(-12).equals(PNG_END)
    )
      size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    contentType = "image/jpeg";
    size = jpegSize(bytes);
  } else if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1) {
    contentType = "image/x-icon";
    size = icoSize(bytes);
  } else
    reject(
      kind === "favicon"
        ? "Formato no admitido. Usa una imagen PNG o un archivo ICO."
        : "Formato no admitido. Usa una imagen PNG o JPEG.",
    );
  if (!(limits.types as readonly string[]).includes(contentType))
    reject(
      kind === "favicon"
        ? "Formato no admitido. Usa una imagen PNG o un archivo ICO."
        : "Formato no admitido. Usa una imagen PNG o JPEG.",
    );
  if (!size) reject("El archivo está dañado o incompleto.");
  const { min, max, square } = bounds[kind];
  if (size.width < min || size.height < min)
    reject(`La imagen es muy pequeña: usa al menos ${min} × ${min} píxeles.`);
  if (size.width > max || size.height > max)
    reject(`La imagen es muy grande: usa como máximo ${max} × ${max} píxeles.`);
  if (square && size.width !== size.height)
    reject("El favicon debe ser cuadrado.");
  return {
    contentType,
    ...size,
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
