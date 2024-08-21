/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { logConfigType } from "../config";
import { LogModule } from "../logger/index.js";


export class logMock {
    public lib: LogModule;
    public conf: logConfigType;
    public status: number;
    public msg: {
        last_status: number;
        last_message: string;
        last_errormsg: string;
        last_resultmsg: string;
        pending_message: string;
    };

    constructor() {
        this.lib =  new LogModule(),
        this.conf = {
            console_level: 7,
            console_output: true,
            file_output: false,
            file_path: "",
            file_rotation: false,
            file_level: 7,
            file_level_text: ""
        },
        this.status =  -1,
        this.msg = {
            last_errormsg: "",
            last_message: "",
            last_resultmsg: "",
            last_status: 0,
            pending_message: ""
        }
    }
    
}