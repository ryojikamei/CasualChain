/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import clone from "clone";

import nodeConfig from "config";
import crypto from "crypto";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { systemConfigType, ccConfigType, logConfigType, logConfigInputType, mainConfigType, dsConfigType, eventConfigType, apiConfigType, inConfigType, blockConfigType, keyringConfigType, keyringConfigInputSchema, inConfigInputSchema, blockConfigInputSchema, systemConfigInputSchema, dsConfigInputSchema, apiConfigInputSchema, eventConfigInputSchema, logConfigInputSchema, wholeConfigType } from "./zod.js";
import { getConfigurationOptions, configCache } from "./index.js";
import { moduleCondition } from "../index.js";

/**
 * ConfigModule: read configuration file and provide a tree of configuration.
 * Because read errors are critical, the entire process is terminated immediately
 */
export class ConfigModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected cOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected cError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("config", func, pos, message));
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
     * Inter-class variable to save updated configuration
     */
    protected confCache: configCache | undefined
    /**
     * Return data of the module
     * @returns 
     */
    public getData(): gResult<configCache, gError> {
        if (this.confCache === undefined) { return this.cError("getData", "confCache", "unknown condition"); };
        return this.cOK(this.confCache);
    }
    /**
     * Overwrite data of the module
     * @param data 
     */
    public setData(data: configCache): void { this.confCache = data; }

    /**
     * Reads all items in the configuration file.
     * @returns returns with gResult type that contains wholeConfigType if it's success, and gError if it's failure.
     */
    public async loadConfig(): Promise<gResult<wholeConfigType, gError>> {
        let li: logConfigInputType;
        try {
            console.log("Reading configuration from " + nodeConfig.util.getEnv("NODE_CONFIG_DIR") + "/" + nodeConfig.util.getEnv("NODE_CONFIG_ENV"));
            li = logConfigInputSchema.parse({
                console_output: nodeConfig.get("logger.console_output"),
                console_level: nodeConfig.get("logger.console_level"),
                file_output: nodeConfig.get("logger.file_output"),
                file_path: nodeConfig.get("logger.file_path"),
                file_rotation: nodeConfig.get("logger.file_rotation"),
                file_level: nodeConfig.get("logger.file_level"),
            })
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "logger", detail);
        }
        let console_level_number = -1;
        const console_level_string: string = li.console_level;
        switch (console_level_string.toLowerCase()) {
            case "emergency" || "emerg" || "0":
                console_level_number = 0;
                break;
            case "alert" || "1":
                console_level_number = 1;
                break;
            case "critical" || "crit" || "2":
                console_level_number = 2;
                break;
            case "error" || "err" || "3":
                console_level_number = 3;
                break;
            case "warning" || "warn" || "4":
                console_level_number = 4;
                break;
            case "notice" || "5":
                console_level_number = 5;
                break;
            case "infomational" || "info" || "6":
                console_level_number = 6;
                break;
            case "debug" || "7":
                console_level_number = 7;
                break;
            default: // An invalid string goes to normal
                console_level_number = 6;
                break;
        }
        let file_level_number = -1;
        let file_level_text = "";
        const file_level_string: string = li.file_level;
        switch (file_level_string.toLowerCase()) {
            case "emergency" || "emerg" || "0":
                file_level_number = 0;
                file_level_text = "emerg";
                break;
            case "alert" || "1":
                file_level_number = 1;
                file_level_text = "alert";
                break;
            case "critical" || "crit" || "2":
                file_level_number = 2;
                file_level_text = "crit";
                break;
            case "error" || "err" || "3":
                file_level_number = 3;
                file_level_text = "error";
                break;
            case "warning" || "warn" || "4":
                file_level_number = 4;
                file_level_text = "warn";
                break;
            case "notice" || "5":
                file_level_number = 5;
                file_level_text = "notice";
                break;
            case "infomational" || "info" || "6":
                file_level_number = 6;
                file_level_text = "info";
                break;
            case "debug" || "7":
                file_level_number = 7;
                file_level_text = "debug";
                break;
            default: // An invalid string goes to normal
                file_level_number = 6;
                break;
        }
        const l: logConfigType = {
            console_output: li.console_output,
            console_level: console_level_number,
            file_output: li.file_output,
            file_path: li.file_path,
            file_rotation: li.file_rotation,
            file_level: file_level_number,
            file_level_text: file_level_text
        }
        let k: keyringConfigType;
        try {
            k = keyringConfigInputSchema.parse({
                create_keys_if_no_sign_key_exists: nodeConfig.get("keyring.create_keys_if_no_sign_key_exists"),
                sign_key_file: nodeConfig.get("keyring.sign_key_file"),
                verify_key_file: nodeConfig.get("keyring.verify_key_file")
            })
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "keyring", detail);
        }

        let i: inConfigType;
        try {
            i = inConfigInputSchema.parse({
                self: {
                    nodename: nodeConfig.get("internode.self.nodename"),
                    rpc_port: nodeConfig.get("internode.self.rpc_port")
                },
                nodes: nodeConfig.get("internode.nodes")
            })
            for (const node of i.nodes) {
                node.abnormal_count = 0;
            }
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "internode", detail);
        }

        let b: blockConfigType;
        try {
            b = blockConfigInputSchema.parse({
                ca3: nodeConfig.get("block.ca3"),
            })
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "block", detail);
        }

        let s: systemConfigType;
        try {
            s = systemConfigInputSchema.parse({
                node_mode: nodeConfig.get("system.node_mode"),
                events_internal: nodeConfig.get("system.events_internal")
            })
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "system", detail);
        }

        let m: mainConfigType;
        m = {};

        let d: dsConfigType;
        try {
            d = dsConfigInputSchema.parse({
                password_encryption: nodeConfig.get("datastore.password_encryption"),
                mongo_host: nodeConfig.get("datastore.mongo_host"),
                mongo_port: nodeConfig.get("datastore.mongo_port"),
                mongo_dbname: nodeConfig.get("datastore.mongo_dbname"),
                mongo_dbuser: nodeConfig.get("datastore.mongo_dbuser"),
                mongo_password: nodeConfig.get("datastore.mongo_password"),
                mongo_authdb: nodeConfig.get("datastore.mongo_authdb"),
                mongo_blockcollection: nodeConfig.get("datastore.mongo_blockcollection"),
                mongo_poolcollection: nodeConfig.get("datastore.mongo_poolcollection")
            })
            if (d.password_encryption === true) {
                const ret1 = await this.getDecryptedPassword(d.mongo_password);
                if (ret1.isFailure()) {
                    return ret1;
                } else {
                    d.mongo_password = ret1.value;
                }
            }
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "datastore", detail);
        }

        let a: apiConfigType;
        try {
            a = apiConfigInputSchema.parse({
                rest: {
                    password_encryption: nodeConfig.get("api.rest.password_encryption"),
                    userapi_port: nodeConfig.get("api.rest.userapi_port"),
                    userapi_user: nodeConfig.get("api.rest.userapi_user"),
                    userapi_password: nodeConfig.get("api.rest.userapi_password"),
                    adminapi_port: nodeConfig.get("api.rest.adminapi_port"),
                    adminapi_user: nodeConfig.get("api.rest.adminapi_user"),
                    adminapi_password: nodeConfig.get("api.rest.adminapi_password")
                }
            })
            if (a.rest.password_encryption === true) {
                const ret2 = await this.getDecryptedPassword(a.rest.userapi_password);
                if (ret2.isFailure()) {
                    return ret2;
                } else {
                    a.rest.userapi_password = ret2.value;
                }
                const ret3 = await this.getDecryptedPassword(a.rest.adminapi_password);
                if (ret3.isFailure()) {
                    return ret3;
                } else {
                    a.rest.adminapi_password = ret3.value;
                }
            }
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "api", detail);
        }

        let e: eventConfigType;
        try {
            e = eventConfigInputSchema.parse({
                enable_internaltasks: nodeConfig.get("event.enable_internaltasks")
            })
        } catch (error: any) {
            let detail: string;
            try {
                detail = error.toString();
            } catch (error: any) {
                detail = error.flatten();
            }
            return this.cError("init", "event", detail);
        }

        const wholeConfig: wholeConfigType = {
            l: l, // logConfigType
            s: s, // systemConfigType
            m: m, // mainConfigType
            d: d, // dsConfigType
            a: a, // apiConfigType
            i: i, // inConfigType
            b: b, // blockConfigType
            k: k, // keyringConfigType
            e: e  // eventConfigType
        }

        this.confCache = { conf: wholeConfig, recentChanges: [], fromFileChanges: [] };
        return this.cOK<wholeConfigType>(wholeConfig);
    }

    /**
     * Initialization of ConfigModule
     * @returns returns with gResult type that contains ccConfigType if it's success, and gError if it's failure.
     */
    public async init(): Promise<gResult<ccConfigType, gError>> {

        this.coreCondition = "loading";
        const ret = await this.loadConfig();
        if (ret.isFailure()) return ret;
        const core = {...ret.value, ...{ lib: new ConfigModule() }};
        this.coreCondition = "active";

        core.lib.confCache = this.confCache;
        core.lib.coreCondition = this.coreCondition;

        return this.cOK<ccConfigType>(core);
    }

    public async restart(): Promise<gResult<ccConfigType, gError>> {

        const ret = await this.init();
        if (ret.isFailure()) return ret;
        const newCore = ret.value;
        
        return this.cOK(newCore);
    }

    /**
     * Reload settings from the configuration files
     * @param core - set ccConfigType instance
     * @returns  returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async reloadConfiguration(): Promise<gResult<void, gError>> {

        if (this.confCache === undefined) { return this.cError("reloadConfiguration", "confCache", "unknown condition"); };

        if (this.confCache.fromFileChanges.length > 0 ) this.coreCondition = "reloadNeeded";
        return this.cOK<void>(undefined);
    }

    /**
     * Get all or specific settings
     * @param core - set ccConfigType instance
     * @param modName - can set module name to narrow down
     * @param showPasswords - can set true when you check passwords
     * @returns returns with gResult, that is wrapped by a Promise, that contains the target object if it's success, and gError if it's failure.
     */
    public getConfiguration(modName?: string, options?: getConfigurationOptions): gResult<object, gError> {

        if (modName === undefined) modName = "";
        let showPasswords: boolean = false;
        if (options?.showPasswords !== undefined) showPasswords = options.showPasswords;

        if (this.confCache === undefined) { return this.cError("getConfiguration", "confCache", "unknown condition"); };
        let conf = clone(this.confCache.conf);

        if (showPasswords === false) {
            conf.a.rest.adminapi_password = "********";
            conf.a.rest.userapi_password = "********";
            conf.d.mongo_password = "********";
        }

        modName = modName.toLowerCase();
        switch (modName) {
            case "":
                return this.cOK(conf);
            case "a":
            case "api":
                return this.cOK(conf.a);
            case "b":
            case "block":
                return this.cOK(conf.b);
            case "c":
            case "config":
                return this.cOK({});
            case "d":
            case "datastore":
            case "ds":
                return this.cOK(conf.d);
            case "e":
            case "event":
                return this.cOK(conf.e);
            case "i":
            case "internode":
            case "in":
                return this.cOK(conf.i);
            case "k":
            case "keyring":
                return this.cOK(conf.k);
            case "l":
            case "logger":
                return this.cOK(conf.l);
            case "m":
            case "main":
                return this.cOK(conf.m);
            case "s":
            case "system":
                return this.cOK(conf.s);
            default:
                return this.cError("getConfiguration", "modName", "Unknown module name:" + modName);
        }
    }

    /**
     * Temporary measures.
     * @param nodename 
     * @param property 
     * @param value 
     */
    public setNodeConfiguration(nodename: string, property: string, value: string): gResult<void, gError> {

        if (this.confCache === undefined) { return this.cError("setConfiguration", "confCache", "unknown condition"); };

        for (const node of this.confCache.conf.i.nodes) {
            if (node.nodename === nodename) {
                switch (property) {
                    case "nodename":
                        node.nodename = value;
                        break;
                    case "rpc_port":
                        node.rpc_port = Number(value);
                        break;
                    case "allow_outgoing":
                        if (value === "false") { node.allow_outgoing = false; } 
                        if (value === "true") { node.allow_outgoing = true; }
                        break;
                    case "host":
                        node.host = value;
                        break;
                    case "abnormal_count":
                        node.abnormal_count = Number(value);
                        break;
                    default:
                        break;
                }
            }
        }
        if (this.confCache.recentChanges.length === 0) {
            // No one editing, apply immediately
            this.confCache.recentChanges.push("c");
            this.applyConfiguration();
        } else {
            this.confCache.recentChanges.push("c");
        }
        return this.cOK(undefined);
    }

    /**
     * Set specific settings
     * @param core - set ccConfigType instance
     * @param key - set the property name to set value
     * @param value - set the value for the property
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public setConfiguration(key: string, value: string): gResult<void, gError> {

        if (this.confCache === undefined) { return this.cError("setConfiguration", "confCache", "unknown condition"); };

        const props = key.split(".");
        let curr: any = this.confCache.conf;
        let index;
        for (index = 0; index < props.length - 1; index++) {
            if (curr.hasOwnProperty(props[index]) === false) {
                return this.cError("setConfiguration", "hasOwnProperty", "Unknown property name: core." + key);
            }
            curr = curr[props[index]];
        }

        switch (typeof(curr[props[props.length - 1]])) {
            case "string":
                curr[props[props.length - 1]] = String(value);
                if (this.confCache.recentChanges.includes(props[0]) === false) { this.confCache.recentChanges.push(props[0]); };
                return this.cOK(undefined);
            case "number":
                const val = Number(value);
                if (Number.isSafeInteger(val) === false) return this.cError("setConfiguration", "setNumber", "It's not a valid number");
                curr[props[props.length - 1]] = val;
                if (this.confCache.recentChanges.includes(props[0]) === false) { this.confCache.recentChanges.push(props[0]); };
                return this.cOK(undefined);
            case "boolean":
                if (value.toLowerCase() === "true") {
                    curr[props[props.length - 1]] = true;
                } else {
                    curr[props[props.length - 1]] = false;
                }
                if (this.confCache.recentChanges.includes(props[0]) === false) { this.confCache.recentChanges.push(props[0]); };
                return this.cOK(undefined);
            default:
                return this.cError("setConfiguration", "setUnsupported", "unsupported type");
        }
    }

    public applyConfiguration(): gResult<void, unknown> {

        if (this.confCache === undefined) { return this.cError("applyConfiguration", "confCache", "unknown condition"); };

        if (this.confCache.recentChanges.length > 0) {
            this.confCache.fromFileChanges = Array.from(new Set([...this.confCache.fromFileChanges, ...this.confCache.recentChanges]));
            this.coreCondition = "pulldataNeeded";
        }

        return this.cOK(undefined);
    }

    /**
     * Encrypt plain password string
     * @param plainPassword - set original plain password string to encrypt
     * @returns returns with gResult, that is wrapped by a Promise, that contains the encrypted string if it's success, and gError if it's failure.
     */
    public async getEncryptedPassword(plainPassword: string): Promise<gResult<string, gError>> {
        try {
            const iv = crypto.randomBytes(16);
            const salt = crypto.randomBytes(16);
            const key = crypto.scryptSync("cc", salt, 32);
            const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
            const cipherText = Buffer.concat([cipher.update(plainPassword, "utf-8"), cipher.final()]).toString("hex");
            const cipherPassword =  iv.toString("hex") + "$" + salt.toString("hex") + "$" + cipherText;
            return this.cOK(cipherPassword);
        } catch (error: any) {
            return this.cError("getEncryptedPassword", "crypt", error.toString());            
        }
    }

    /**
     * Decrypt cipher password string
     * @param cipherPassword - set cipher password string to decrypt
     * @returns returns with gResult, that is wrapped by a Promise, that contains the decrypted string if it's success, and gError if it's failure.
     */
    public async getDecryptedPassword(cipherPassword: string): Promise<gResult<string, gError>> {
        try {
            const [ivStr, saltStr, cipherStr] = cipherPassword.split("$", 3);
            const iv = Buffer.from(ivStr, "hex");
            const salt = Buffer.from(saltStr, "hex");
            const cipher = Buffer.from(cipherStr, "hex");
            const key = crypto.scryptSync("cc", salt, 32);
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
            const plainPassword = decipher.update(cipher, undefined, "utf-8") + decipher.final("utf-8");
            return this.cOK(plainPassword);
        } catch (error: any) {
            return this.cError("getDecryptedPassword", "decrypt", error.toString());
        }
    }

}