import { render } from "ink";
import App from "./views/App";

const args = process.argv.slice(2);
let command = args[0];
let arg = args[1];

render(<App initialCommand={command} initialArg={arg} />);
