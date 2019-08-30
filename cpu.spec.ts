import {initCPU, step, maskZ} from "./cpu";
import { expect } from 'chai';
import { BusRead, BusWrite } from "./bus";

describe("dec b", (): void => {
  const readb: BusRead = (addr: number): number => 0x05;
  const writeb: BusWrite = (addr: number, val: number): void => {};

  it("decrements 4 to 3", () => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    step(cpu, writeb, readb);
    expect(cpu.regs.b).to.equal(3);
  });

  it("clears Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    cpu.regs.f |= maskZ;
    expect(step(cpu, writeb, readb)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(0);
  });

  it("clears Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    expect(step(cpu, writeb, readb)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(0);
  });

  it("sets Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    cpu.regs.f |= maskZ;
    expect(step(cpu, writeb, readb)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(maskZ);
  });

  it("sets Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    expect(step(cpu, writeb, readb)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(maskZ);
  });

});
