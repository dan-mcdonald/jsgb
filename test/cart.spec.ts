import { expect } from 'chai';
import { decodeCartType, MBC } from "../src/cart";

describe("cart", (): void => {
  it("decodeCartType", (): void => {
    expect(decodeCartType(0x01)).to.deep.equal({mbc: MBC.MBC1, ram: false, battery: false});
    expect(decodeCartType(0x03)).to.deep.equal({mbc: MBC.MBC1, ram: true, battery: true});
  });
});
