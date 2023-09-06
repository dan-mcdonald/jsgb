const encoder = new TextEncoder();

function arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

interface BESSFile {
  vram: Uint8Array
}

function getFooter(contents: Uint8Array): Uint8Array {
  return contents.slice(-8);
}

export function detect(contents: Uint8Array): boolean {
  const encoder = new TextEncoder();
  const footer = getFooter(contents);
  if (footer.length !== 8) {
    return false;
  }
  const footerMagic = footer.slice(4, 8);

  return arrayEqual(footerMagic, encoder.encode("BESS"));
}

export function load(contents: Uint8Array): BESSFile {
  if (!detect(contents)) {
    throw new Error("Not a BESS file");
  }
  let pos = headerOffset(contents);
  let done = false;
  let vram = new Uint8Array(0);
  while (!done) {
    const blockTag = contents.slice(pos, pos + 4);
    const blockLength = asLEInt(contents.slice(pos + 4, pos + 8));
    pos += 8;
    if (arrayEqual(blockTag, encoder.encode("END "))) {
      done = true;
    } else if (arrayEqual(blockTag, encoder.encode("CORE"))) {
      const vramSize = asLEInt(contents.slice(pos + 0xA0, pos + 0xA0 + 4));
      const vramOffset = asLEInt(contents.slice(pos + 0xA4, pos + 0xA4 + 4));
      vram = contents.slice(vramOffset, vramOffset + vramSize);
    }
    pos += blockLength;
  }
  return {vram};
}

export function headerOffset(contents: Uint8Array): number {
  return asLEInt(getFooter(contents).slice(0, 4));
}

export function asLEInt(bytes: Uint8Array): number {
  return bytes.reduceRight((acc, value) => acc * 0x100 + value, 0);
}
