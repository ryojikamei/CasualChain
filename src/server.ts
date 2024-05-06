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

import { CC } from "./cc.js";

/**
 * The main
 */
async function main() {
    console.log(figlet.textSync("CasualChain"));

    const lib: CC = new CC();
    const core = await lib.init();


}
main()
