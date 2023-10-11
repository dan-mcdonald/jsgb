export interface BusWrite {
  (addr: number, val: number): void;
}

export interface BusRead {
  (addr: number): number;
}

export interface Bus {
  readb: BusRead;
  writeb: BusWrite;
}

export function write16(bus: Bus, addr: number, val: number): void {
  bus.writeb(addr, val & 0xff);
  bus.writeb(addr + 1, val >> 8);
}

export function read16(bus: Bus, addr: number): number {
  return bus.readb(addr) | (bus.readb(addr + 1) << 8);
}
