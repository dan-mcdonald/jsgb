import React from "react";
import {main} from "./top";

import { render } from "react-dom";
import App from "./App";

render(<App />, document.getElementById("root"));

await main();
