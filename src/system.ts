import { Bus } from "./bus";
import { CPU } from "./cpu";
import { PPU } from "./ppu";

export type System = {
  cpu: CPU;
  ppu: PPU;
  bus: Bus;
}
