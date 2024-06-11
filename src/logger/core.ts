/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { Logger } from "winston";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccLogType, logLevel, logOptions } from "./index.js";
import { logConfigType } from "../config/index.js";
import { winston_init } from "./winston.js";
import { moduleCondition } from "../index.js";

/**
 * Core of logging functions
 */
export class LogModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected lOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected lError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("logger", func, pos, message));
    }

    /**
     * Inter-class variable to set module condition
     */
    protected coreCondition: moduleCondition = "unloaded";
    /**
     * Return current condition of the module
     * @returns returns a word that represent the condition of the module
     */
    public getCondition(): moduleCondition {
        return this.coreCondition;
    }
    /**
     * Overwrite the condition of the module
     * @param condition - set a word that represent the condition of the module
     */
    public setCondition(condition: moduleCondition): void {
        this.coreCondition = condition;
    }

    /**
     * The propery for winston logger
     */
    protected winston: Logger | undefined;

    /**
     * Initialize the logging module .
     * @param conf - set logConfigType instance
     * @param logger - can inject winston logger mock for testing
     * @returns returns with gResult type that contains ccLogType if it's success, and gError if it's failure.
     */
    public init(conf: logConfigType, logger?: Logger): gResult<ccLogType, gError> {
        let status: number = 0;

        this.coreCondition = "loading";
        /* System log except console output uses winston */
        if (logger !== undefined) {
            this.winston = logger;
        } else {
            if (conf.file_output === true) {
                try {
                    this.winston = winston_init(conf.file_level_text, conf.file_path, conf.file_rotation);
                } catch (error: any) {
                    status = -1;
                    this.winston = undefined;
                    return this.lError("init", "winston_init", error.toString());
                }
            }
        }

        const core: ccLogType = {
            lib: new LogModule(),
            conf: conf,
            status: status,
            msg: {
                last_status: 0,
                last_message: "",
                last_errormsg: "",
                last_resultmsg: "",
                pending_message: ""
            }
        }
        core.lib.winston = this.winston;

        const LOG = this.LogFunc(core)
        LOG("Debug", 0, "A message for checking the logger condition", {skipconsole : true});
        this.coreCondition = "active";
        core.lib.coreCondition = this.coreCondition;
        return this.lOK<ccLogType>(core);
    }

    public restart(core: ccLogType): gResult<ccLogType, gError> {
        const LOG = this.LogFunc(core);
        LOG("Info", 0, "LogModule:restart");

        const ret1 = this.init(core.conf);
        if (ret1.isFailure()) return ret1;
        const newCore: ccLogType = ret1.value;
        // reconnect is not needed
        
        return this.lOK<ccLogType>(newCore);
    }

    /**
     * The method to return the function that writes the log.
     * @param core - set ccLogType instance
     * @returns return the unnamed function that writes the log
     */
    public LogFunc(core: ccLogType) {
        return function(type: logLevel, status: number, message: string, options?: logOptions) {
            let opts: logOptions = {
                lf: undefined,
                skipconsole: undefined,
                skipfile: undefined
            }
            if (options !== undefined) opts = options;
            if (opts.lf === undefined) opts.lf = true;
            if (opts.skipconsole === undefined) opts.skipconsole = false;
            if (opts.skipfile === undefined) opts.skipfile = false;
            let level: number;
            switch (type) {
                case "Error":
                    level = 3;
                    break;
                case "Warning":
                    level = 4;
                    break;
                case "Notice":
                    level = 5;
                    break;
                case "Info":
                    level = 6;
                    break;
                case "Debug":
                    level = 7;
                    break;
                default: // An invalid string goes to normal
                    level = 6;
                    break;
            }
            core.lib.sendMsg(core, status, message, level, opts.lf, opts.skipconsole, opts.skipfile);
        }
    }

    /**
     * The internal method that write message to both the console and the log file.
     * @param core - set ccLogType instance
     * @param status - set status value to remember. Normal is 0
     * @param message - set the message
     * @param level - set filter level. The syslog level values from 3 to 7 are acceptable
     * @param lf - set false if it needs not to send LF
     * @param skipconsole - set true if it needs not to show message on the console
     * @param skipfile - set true if it needs not to write message to the log file
     * @returns returns the msg object that contains last status and messages that are classified
     */
    protected sendMsg(
        core: ccLogType, 
        status: number,
        message: any,
        level: number, /* 3:ERR, 4:WARNING, 5:NOTICE, 6:INFO, 7:DEBUG */
        lf: boolean,
        skipconsole: boolean,
        skipfile: boolean
        ) {

            let msg: string;
            if (typeof(message) === "object") {
                msg = JSON.stringify(message)
            } else {
                msg = message.toString()
            }

            let end: string;
            if (lf === true) {
                end = '\n';
            } else {
                end = '';
            };

            let msgTagText: string;
            switch (level) {
                case 3:
                    msgTagText = "ERR: ";
                    core.msg.last_errormsg =  msg;
                    core.msg.last_message = ""
                    core.msg.last_resultmsg = "";
                    core.msg.last_status = status;
                    if ((level <= core.conf.console_level) && (skipconsole === false)) {
                        process.stderr.write(msgTagText + core.msg.last_errormsg + end);
                    }
                    if ((core.conf.file_output === true) && (level <= core.conf.file_level) && (skipfile === false)) {
                        if ((lf === true) && (core.msg.pending_message === "") && (core.lib.winston !== undefined)) {
                            core.lib.winston.error(msg);
                        } else if ((lf === true) && (core.msg.pending_message !== "") && (core.lib.winston !== undefined)) { // flush
                            core.lib.winston.error(core.msg.pending_message + msg);
                            core.msg.pending_message = "";
                        } else { // lf === false
                            core.msg.pending_message = core.msg.pending_message + msg;
                        }
                    }
                    break;
                case 4:
                    msgTagText = "WARNING: ";
                    core.msg.last_errormsg =  ""
                    core.msg.last_message = msg;
                    core.msg.last_resultmsg = "";
                    core.msg.last_status = status;
                    if ((level <= core.conf.console_level) && (skipconsole === false)) {
                        process.stdout.write(msgTagText + core.msg.last_message + end);
                    }
                    if ((core.conf.file_output === true) && (level <= core.conf.file_level) && (skipfile === false)) {
                        if ((lf === true) && (core.msg.pending_message === "") && (this.winston !== undefined)) {
                            this.winston.warn(msg);
                        } else if ((lf === true) && (core.msg.pending_message !== "") && (this.winston !== undefined)) { // flush
                            this.winston.warn(core.msg.pending_message + msg);
                            core.msg.pending_message = "";
                        } else { // lf === false
                            core.msg.pending_message = core.msg.pending_message + msg;
                        }
                    }
                    break;
                case 5:
                    msgTagText = "NOTICE: ";
                    core.msg.last_errormsg =  ""
                    core.msg.last_message = msg;
                    core.msg.last_resultmsg = "";
                    core.msg.last_status = status;
                    if ((level <= core.conf.console_level) && (skipconsole === false)) {
                        process.stdout.write(core.msg.last_message + end); // Do not print "NOTICE: "
                    }
                    if ((core.conf.file_output === true) && (level <= core.conf.file_level) && (skipfile === false)) {
                        if ((lf === true) && (core.msg.pending_message === "") && (this.winston !== undefined)) {
                            //this.winston.notice(msg);
                            this.winston.info(msg);
                        } else if ((lf === true) && (core.msg.pending_message !== "") && (this.winston !== undefined)) { // flush
                            //this.winston.notice(core.msg.pending_message + msg);
                            this.winston.info(core.msg.pending_message + msg);
                            core.msg.pending_message = "";
                        } else { // lf === false
                            core.msg.pending_message = core.msg.pending_message + msg;
                        }
                    }
                    break;
                case 6:
                    msgTagText = "INFO: ";
                    core.msg.last_errormsg =  ""
                    core.msg.last_message = msg;
                    core.msg.last_resultmsg = "";
                    core.msg.last_status = status;
                    if ((level <= core.conf.console_level) && (skipconsole === false)) {
                        process.stdout.write(msgTagText + core.msg.last_message + end);
                    }
                    if ((core.conf.file_output === true) && (level <= core.conf.file_level) && (skipfile === false)) {
                        if ((lf === true) && (core.msg.pending_message === "") && (this.winston !== undefined)) {
                            this.winston.info(msg);
                        } else if ((lf === true) && (core.msg.pending_message !== "") && (this.winston !== undefined)) { // flush
                            this.winston.info(core.msg.pending_message + msg);
                            core.msg.pending_message = "";
                        } else { // lf === false
                            core.msg.pending_message = core.msg.pending_message + msg;
                        }
                    }
                    break;
                case 7:
                    msgTagText = "DEBUG: ";
                    core.msg.last_errormsg =  msg;
                    core.msg.last_message = ""
                    core.msg.last_resultmsg = "";
                    core.msg.last_status = status;
                    if ((level <= core.conf.console_level) && (skipconsole === false)) {
                        process.stderr.write(msgTagText + core.msg.last_errormsg + end);
                    }
                    if ((core.conf.file_output === true) && (level <= core.conf.file_level) && (skipfile === false)) {
                        if ((lf === true) && (core.msg.pending_message === "") && (this.winston !== undefined)) {
                            this.winston.debug(msg);
                        } else if ((lf === true) && (core.msg.pending_message !== "") && (this.winston !== undefined)) { // flush
                            this.winston.debug(core.msg.pending_message + msg);
                            core.msg.pending_message = "";
                        } else { // lf === false
                            core.msg.pending_message = core.msg.pending_message + msg;
                        }
                    }
                    break;
                default: // Result
                    core.msg.last_errormsg =  ""
                    core.msg.last_message = "";
                    core.msg.last_status = 0;
                    core.msg.last_resultmsg = msg;
                    break;
            }
            return core.msg;
        }
}