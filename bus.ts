export interface BusWrite {
  (addr: number, val: number): void;
}

export interface BusRead {
  (addr: number): number;
}
