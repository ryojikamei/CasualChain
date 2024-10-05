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
    public console_linefeed_pending: boolean;
    public file_pending_message: string;

    constructor() {
        this.lib =  new LogModule(),
        this.conf = {
            console_level: 7,
            console_output: true,
            console_color: "None",
            console_color_code: "",
            file_output: false,
            file_path: "",
            file_rotation: false,
            file_level: 7,
            file_level_text: ""
        },
        this.console_linefeed_pending = false,
        this.file_pending_message = ""
    }
    
}