import React, { Suspense } from "react";

import Emulator from "./Emulator";
import { loadBootRom, loadCart } from "./top";

export default function App() {
  const bootRomPromise = loadBootRom();
  const cartPromise = loadCart();

  return (
    <div className="App" style={{ backgroundColor: "#bbb" }}>
      <h1 style={{ color: "#eee" }}>DMG</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Emulator bootRomPromise={bootRomPromise} cartPromise={cartPromise} />
      </Suspense>
    </div>
  );
}
