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
     * Variable common to each class for setting the module condition
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

        this.coreCondition = "loading";
        /* System log except console output uses winston */
        if (logger !== undefined) {
            this.winston = logger;
        } else {
            if (conf.file_output === true) {
                try {
                    this.winston = winston_init(conf.file_level_text, conf.file_path, conf.file_rotation);
                } catch (error: any) {
                    this.winston = undefined;
                    return this.lError("init", "winston_init", error.toString());
                }
            }
        }

        const core: ccLogType = {
            lib: new LogModule(),
            conf: conf,
            console_linefeed_pending: false,
            file_pending_message: ""
        }
        core.lib.winston = this.winston;

        const LOG = this.LogFunc(core, "Log", "init");
        LOG("Debug", "A message for checking the logger condition", {skipconsole : true});
        this.coreCondition = "active";
        core.lib.coreCondition = this.coreCondition;
        return this.lOK<ccLogType>(core);
    }

    public restart(core: ccLogType): gResult<ccLogType, gError> {
        const LOG = this.LogFunc(core, "Log", "restart");
        LOG("Info", "restart");

        const ret1 = this.init(core.conf);
        if (ret1.isFailure()) return ret1;
        const newCore: ccLogType = ret1.value;
        // reconnect is not needed
        
        return this.lOK<ccLogType>(newCore);
    }

    /**
     * The method to return the function that writes the log.
     * @param core - set ccLogType instance
     * @param moduleName - set caller's module name
     * @param methodName - set caller's method or function name
     * @returns return the unnamed function that writes the log. It must require type, and message arguments, and can set options.
     */
    public LogFunc(core: ccLogType, moduleName: string, methodName: string) {
        /**
         * @param type - set level string with logLevel type
         * @param message - set message
         * @param options - can set options with logOptions type
         */
        return function(type: logLevel, message: string, options?: logOptions) {
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
            let error: boolean;
            switch (type) {
                case "Error":
                    level = 3;
                    error = true;
                    break;
                case "Warning":
                    level = 4;
                    error = false;
                    break;
                case "Notice":
                    level = 5;
                    error = false;
                    break;
                case "Info":
                    level = 6;
                    error = false;
                    break;
                case "Debug":
                    level = 7;
                    error = true;
                    break;
                default: // An invalid string goes to normal
                    level = 5;
                    error = false;
                    break;
            }

            if ((core.conf.console_output === true) && (opts.skipconsole === false) && (level <= core.conf.console_level)) {
                if (core.console_linefeed_pending !== true) {
                    core.lib.writeConsole(core, core.lib.formatMessasge(moduleName, methodName, type, message, opts.lf, false), error);
                    if (opts.lf === true) {
                        core.console_linefeed_pending = false; // most way
                    } else {
                        core.console_linefeed_pending = true;
                    }
                } else {
                    core.lib.writeConsole(core, core.lib.formatMessasge(moduleName, methodName, type, message, opts.lf, true), error);
                    if (opts.lf === true) {
                        core.console_linefeed_pending = false;
                    } else {
                        core.console_linefeed_pending = true;
                    }
                }
            }
            if ((core.conf.file_output === true) && (opts.skipfile === false) && (level <= core.conf.file_level)) {
                if (opts.lf === false) {
                    core.file_pending_message = core.file_pending_message + message;
                } else if (core.file_pending_message.length !== 0) {
                    message = core.file_pending_message + message
                    core.lib.writeFile(core, core.lib.formatMessasge(moduleName, methodName, type, message, opts.lf, false), level);
                    core.file_pending_message = "";
                } else {
                    core.lib.writeFile(core, core.lib.formatMessasge(moduleName, methodName, type, message, opts.lf, false), level);
                }
            }
        }
    }

    /**
     * Format message string
     * @param moduleName - set caller's module name
     * @param methodName - set caller's method or function name
     * @param type - set log level as string
     * @param message - set the message
     * @param lf - put lf or not
     * @param following - the message is the message following previous message or not
     * @returns returns the message string to output
     */
    private formatMessasge(moduleName: string, methodName: string, type: string, message: string, lf: boolean, following: boolean): string {

        let msg: string;
        if (typeof(message) === "object") {
            msg = JSON.stringify(message);
        } else {
            msg = message.toString();
        }
        let end: string;
        if (lf === true) {
            end = '\n';
        } else {
            end = '';
        };

        if (following === true) {
            return msg + end;
        } else {
            const timeStr = new Date().toISOString();
            return timeStr + "|" + moduleName + "|" + methodName + "|" + type.toUpperCase() + "|" + msg + end;
        }
    }

    /**
     * Write a formetted message to the console
     * @param core - set ccLogType instance
     * @param messsage - set the formatted message
     * @param stderr - write to stderr or not
     * @returns returns always zero
     */
    private writeConsole(core: ccLogType, messsage: string, stderr: boolean): number {

        const color_set_code = core.conf.console_color_code;
        let color_reset_code = "";
        if (color_set_code.length !== 0) { color_reset_code = '\u001b[0m'; }

        if (stderr !== true) {
            process.stdout.write(color_set_code + messsage + color_reset_code);
        } else {
            process.stderr.write(color_set_code + messsage + color_reset_code);
        }

        return 0;
    }

    /**
     * Write a formatted message to the log file
     * @param core  - set ccLogType instance
     * @param message - set the formatted message
     * @param level - set the loglevel of the message
     * @returns returns negative number value when the winston module is not initialized
     */
    private writeFile(core: ccLogType, message: string, level: number): number {

        if (this.winston === undefined) { 
            console.error("Winston unknown error");
            return -1;
        }

        if (level <= 3) {
            this.winston.error(message);
        } else if (level === 4) {
            this.winston.warn(message);
        } else if (level === 5) {
            this.winston.info(message);
        } else if (level === 6) {
            this.winston.info(message);
        } else {
            this.winston.debug(message);
        }
        return 0;
    }

}