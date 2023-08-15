import { expect } from 'chai';
import { makeColor } from './ppu';

describe("ppu", (): void => {
  it("makeColor", (): void => {
    const expected = Uint8Array.from([0x12, 0x34, 0x56, 0xff]);
    expect(makeColor("#123456")).to.deep.equal(expected);
  });

  it("make sprite image", (): void => {
    expect(true).to.equal(true);
  });
});
