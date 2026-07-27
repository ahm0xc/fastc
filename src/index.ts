import cac from "cac";

import { runSpeedTest } from "./commands";

const cli = cac("fastc");

cli.command("").action(runSpeedTest);

cli.help();
cli.parse();
