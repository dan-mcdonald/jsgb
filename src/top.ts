export async function loadBootRom(): Promise<Uint8Array> {
  // https://gbdev.gg8.se/wiki/articles/Gameboy_Bootstrap_ROM
  const resp = await fetch("DMG_ROM.bin");
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

export async function loadCart(): Promise<Uint8Array> {
  const resp = await fetch("game.gb");
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}
