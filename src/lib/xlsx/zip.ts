/** Minimal ZIP central-directory reader used to check an .xlsx before full parsing. */
export type ZipEntry = { name: string; compressedSize: number; uncompressedSize: number };

export function listZipEntries(buf: Uint8Array): ZipEntry[] | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const minEocd = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const name = decoder.decode(buf.subarray(offset + 46, offset + 46 + nameLen));
    entries.push({ name, compressedSize, uncompressedSize });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
