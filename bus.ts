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
