import { expect } from 'chai';
import { detect, headerOffset } from "../src/bess";
import { readFile } from "node:fs/promises"

describe("bess", (): void => {
  it("detect positive", async (): Promise<void> => {
    const bootend = await readFile("test/fixtures/bootend.sna");
    expect(detect(bootend)).to.equal(true);
  });

  it("detect negative blank", (): void => {
    const bootend = new Uint8Array(0x100);
    expect(detect(bootend)).to.equal(false);
  });

  it("detect negative empty", (): void => {
    const bootend = new Uint8Array(0);
    expect(detect(bootend)).to.equal(false);
  });

  it("headerOffset", async (): Promise<void> => {
    const bootend = await readFile("test/fixtures/bootend.sna");
    expect(headerOffset(bootend)).to.equal(0x0000665f);
  });
});
