import { readFile } from "fs/promises";

export function loadBootRom(): Promise<Uint8Array> {
  return readFile("dist/DMG_ROM.bin");
}

export function loadCart(): Promise<Uint8Array> {
  return readFile("test/fixtures/cpu_instrs.gb");
}
