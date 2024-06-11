/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

/*
 * CasualChain: a blockchain core system that doesn't have any incentive features inside
 * - Man shall not live by crypto currency alone
 */
    
import figlet from "figlet"

import { gResult, gError } from "./utils.js";

import { CC } from "./cc.js";
import { ccType } from "./index.js";

/**
 * The main
 */
async function main(): Promise<gResult<ccType, gError>> {
    console.log(figlet.textSync("CasualChain"));

    const lib: CC = new CC();
    const ret = await lib.init();
    if (ret.isFailure()) { return ret };
    return ret;
}
const ret = await main()
if (ret.isFailure()) {
    console.log(JSON.stringify(ret));
    process.exit(-1);
};
const core = ret.value;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
    console.log("");
    console.log("Signal " + signal.toString() + " received. Shutting down...");
    const ret = await core.lib.shutdown();
    if (ret.isFailure()) {
        console.log("WARNING: Shutdown process is aborted:");
        console.log(JSON.stringify(ret.value));
    } else {
        process.exit(0);
    }
}
process.on("SIGINT", (signal) => {shutdown(signal)});
process.on("SIGTERM", (signal) => {shutdown(signal)});
process.on("SIGQUIT", (signal) => {shutdown(signal)});

await core.lib.systemLoop();