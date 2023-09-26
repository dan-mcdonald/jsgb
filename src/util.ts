export function hex(n: number): string {
  return n.toString(16);
}

export function hex8(n: number): string {
  return hex(n).padStart(2, '0').toUpperCase();
}

export function hex16(n: number): string {
  return hex(n).padStart(4, '0').toUpperCase();
}

export function u8tos8(u8: number): number {
  if((0x80 & u8) === 0) {
    return u8;
  }
  return -(0xFF ^ u8) - 1;
}

export function make16(hi: number, lo: number): number {
  return hi << 8 | lo;
}

export function break16(word: number): [number, number] {
  return [word >> 8, word & 0xff];
}
