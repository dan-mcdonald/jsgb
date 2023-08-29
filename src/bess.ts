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
  const vram = contents.slice(0, 0x4000);
  return {vram};
}

export function headerOffset(contents: Uint8Array): number {
  return asLEInt(getFooter(contents).slice(0, 4));
}

export function asLEInt(bytes: Uint8Array): number {
  return bytes.reduceRight((acc, value) => acc * 0x100 + value, 0);
}
