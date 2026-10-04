/** Read container duration without decoding audio or running external binaries. */
export function audioDuration(
  data: Buffer,
): { seconds: number; mime: string; name: string } | null {
  if (data.length < 32) return null;
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WAVE"
  ) {
    let bytesPerSecond = 0,
      bytes = 0;
    for (let offset = 12; offset + 8 <= data.length; ) {
      const size = data.readUInt32LE(offset + 4),
        tag = data.toString("ascii", offset, offset + 4);
      if (offset + 8 + size > data.length) return null;
      if (tag === "fmt " && size >= 16) {
        if (data.readUInt16LE(offset + 8) !== 1) return null; // PCM only
        bytesPerSecond = data.readUInt32LE(offset + 16);
      }
      if (tag === "data") bytes += size;
      offset += 8 + size + (size % 2);
    }
    return bytesPerSecond && bytes
      ? {
          seconds: bytes / bytesPerSecond,
          mime: "audio/wav",
          name: "destination.wav",
        }
      : null;
  }
  if (data.toString("ascii", 4, 8) !== "ftyp") return null;
  let seconds = 0,
    hasMedia = false,
    invalid = false;
  function boxes(start: number, end: number, depth = 0) {
    for (let offset = start; offset + 8 <= end; ) {
      const shortSize = data.readUInt32BE(offset),
        tag = data.toString("ascii", offset + 4, offset + 8);
      const header = shortSize === 1 ? 16 : 8;
      if (offset + header > end) {
        invalid = true;
        return;
      }
      const size =
        shortSize === 1
          ? Number(data.readBigUInt64BE(offset + 8))
          : shortSize || end - offset;
      if (size < header || !Number.isSafeInteger(size) || offset + size > end) {
        invalid = true;
        return;
      }
      const body = offset + header;
      if (tag === "mdat" && size > header) hasMedia = true;
      if (tag === "moov" && depth === 0) boxes(body, offset + size, 1);
      if (tag === "mvhd" && depth === 1) {
        const v = data[body];
        if (v > 1 || size - header < (v === 1 ? 32 : 20)) {
          invalid = true;
          return;
        }
        const scale = data.readUInt32BE(body + (v === 1 ? 20 : 12));
        const duration =
          v === 1
            ? Number(data.readBigUInt64BE(body + 24))
            : data.readUInt32BE(body + 16);
        if (!scale || !Number.isSafeInteger(duration)) {
          invalid = true;
          return;
        }
        seconds = duration / scale;
      }
      offset += size;
    }
  }
  boxes(0, data.length);
  return !invalid && hasMedia && seconds > 0
    ? { seconds, mime: "audio/mp4", name: "destination.m4a" }
    : null;
}
