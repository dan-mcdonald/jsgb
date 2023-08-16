import {initCPU, step, maskZ} from "../src/cpu";
import { expect } from 'chai';
import { BusRead, BusWrite } from "../src/bus";

describe("dec b", (): void => {
  const readb: BusRead = (_: number): number => 0x05;
  const writeb: BusWrite = (_: number, __: number): void => {};
  const bus = {readb, writeb};

  it("decrements 4 to 3", () => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    step(cpu, bus);
    expect(cpu.regs.b).to.equal(3);
  });

  it("clears Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    cpu.regs.f |= maskZ;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(0);
  });

  it("clears Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 4;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(0);
  });

  it("sets Z flag when previously set", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    cpu.regs.f |= maskZ;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(maskZ);
  });

  it("sets Z flag when previously clear", (): void => {
    const cpu = initCPU();
    cpu.regs.b = 1;
    expect(step(cpu, bus)).to.equal(4);
    expect(cpu.regs.f & maskZ).to.equal(maskZ);
  });
});

describe("swap a", (): void => {
  const readb = (addr: number): number => [0xcb, 0x37][addr];
  const writeb = (_: number, __: number): void => {};
  const bus = {readb, writeb};

  it("swaps a5 -> 5a", () => {
    const cpu = initCPU();
    cpu.regs.a = 0xa5;
    step(cpu, bus);
    expect(cpu.regs.a).to.equal(0x5a);
  });
});
