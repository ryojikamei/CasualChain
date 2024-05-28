/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

process.env.SUPPRESS_NO_CONFIG_WARNING="1"
process.env.NODE_CONFIG_STRICT_MODE="0";
process.env.NODE_CONFIG_ENV="prod_node2";

import childProcess from "child_process";


const node2 = childProcess.spawn("node", ["dist/server.js"], { detached: true, stdio: "inherit" });
console.log("== PID: " + node2.pid + " is starting ==");

function cleanup(signal: NodeJS.Signals) {
    if (node2.pid !== undefined) process.kill(node2.pid, signal);
}

process.on("SIGINT", (signal) => {cleanup(signal)});
process.on("SIGTERM", (signal) => {cleanup(signal)});
process.on("SIGQUIT", (signal) => {cleanup(signal)});