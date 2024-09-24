/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { existsSync } from "fs";
import { execa } from "execa";
import { ed25519 } from "@noble/curves/ed25519";
import { readFile } from "fs/promises";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccKeyringType } from ".";
import { keyringConfigType } from "../config";
import { ccLogType } from "../logger";

import { objTx } from "../datastore";
import { postJsonOptions } from "../main";
import { DEFAULT_PARSEL_IDENTIFIER } from "../system/index.js";
import { moduleCondition } from "../index.js";

/**
 * The tag string for the transaction of public keys
 */
export const tag_pubkey_data = "system.v3.keyring.config.pubkey";

/**
 * KeyringModule, it manages keys provide functions to sign and verify
 */
export class KeyringModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected kOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected kError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("keyring", func, pos, message));
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
     * Stub values for features not supported in the open source version
     */
    protected common_parsel: string
    constructor() {
        this.common_parsel = DEFAULT_PARSEL_IDENTIFIER;
    }

    private configPath = "config/";

    /**
     * The initialization of the KeyringModule.
     * @param conf - set the keyringConfigType instance
     * @param log - set ccLogType instance
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccKeyringType if it's success, and gError if it's failure.
     */
    public async init(conf: keyringConfigType, log: ccLogType): Promise<gResult<ccKeyringType, gError>> {

        this.coreCondition = "loading";
        let core: ccKeyringType = {
            lib: new KeyringModule(),
            conf: conf,
            log: log,
            cache: [],
            m: undefined,
            s: undefined,
            i: undefined
        }

        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:init");

        const privateKey = this.configPath + conf.sign_key_file;
        if (existsSync(privateKey) === false) {
            if (conf.create_keys_if_no_sign_key_exists === true) {
                LOG("Notice", 0, "The private key file is not found. Generate a key pair");
                await core.lib.generateKeyPair(core, this.configPath);
            } else {
                LOG("Error", -1, "The private key file is not found");
                return this.kError("init", "generateKeyPair", "The private key file is not found");
            }
        }

        const private_cache = await readFile(this.configPath + conf.sign_key_file, "utf-8");
        const public_cache = await readFile(this.configPath + conf.verify_key_file, "utf-8");

        core.cache.push({
            nodename: "self",
            sign_key: private_cache,
            sign_key_hex: Buffer.from(private_cache.split(/\n/)[1].slice(0,32)).toString("hex"),
            verify_key: public_cache,
            verify_key_hex: Buffer.from(public_cache.split(/\n/)[1]).toString("hex")
        });
        // noble-curves doen't accept pubkey from openssl
        // AND grpc doesn't accept keys from noble-curves
        if (core.cache[0].sign_key_hex !== undefined) {
            const pubKeyArr8: Uint8Array = ed25519.getPublicKey(core.cache[0].sign_key_hex);
            const pubKeyHexStr = Buffer.from(pubKeyArr8).toString("hex");
            core.cache[0].verify_key_hex = pubKeyHexStr;
        }

        this.coreCondition = "initialized"
        core.lib.coreCondition = this.coreCondition;
        return this.kOK<ccKeyringType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccKeyringType instance
     * @param log - set ccLogType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccKeyringType if it's success, and gError if it's failure.
     */
    public async restart(core: ccKeyringType, log: ccLogType): Promise<gResult<ccKeyringType, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:restart");

        const ret1 = await this.init(core.conf, log);
        if (ret1.isFailure()) { return ret1 };
        const newCore: ccKeyringType = ret1.value;

        const ret2 = await this.postSelfPublicKeys(core);
        if (ret2.isFailure()) { return ret2 };
        
        return this.kOK<ccKeyringType>(core);
    }

    /**
     * Generate keys and certificates by openssl with ed25519 cypher algorithm.
     * @param core - set ccKeyringType instance
     * @param keypath - set the directory where files are stored
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    private async generateKeyPair(core: ccKeyringType, keypath: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:generateKeyPair");

        const bin: string = "openssl";

        const private_args: string[] = ['genpkey', '-algorithm', 'ed25519', '-out', keypath + core.conf.sign_key_file];
        const private_ret = await execa(bin, private_args, { shell: false });
        if (private_ret.exitCode !== 0) {
            let code = 0;
            if (private_ret.exitCode === undefined) {
                code = -100;
            } else {
                code = private_ret.exitCode
            }
            LOG("Warning", code, private_ret.stderr);
            return this.kError("generateKeyPair", "private_ret:" + code.toString(), private_ret.stderr);
        }

        const public_args: string[] = ['pkey', '-in', keypath + core.conf.sign_key_file, '-pubout', '-out',
        keypath + core.conf.verify_key_file];
        const public_ret = await execa(bin, public_args, { shell: false });
        if (public_ret.exitCode !== 0) {
            let code = 0;
            if (public_ret.exitCode === undefined) {
                code = -100;
            } else {
                code = public_ret.exitCode
            }
            LOG("Warning", code, public_ret.stderr);
            return this.kError("generateKeyPair", "public_ret:" + code.toString(), public_ret.stderr);
        }

        return this.kOK<void>(undefined);
    }

    /**
     * Store owning public keys and certificates into the blockchain.
     * @param core - set ccKeyringType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postSelfPublicKeys(core: ccKeyringType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:postSelfPublicKeys");

        if ((core.cache[0] === undefined) || (core.cache[0].nodename !== "self")) {
            LOG("Error", -1, "The modules is not initialized properly!");
            return this.kError("postSelfPublicKeys", "prerequisite", "The modules is not initialized properly!");
        }

        // Search if previous data is exist or not.
        if ((core.m === undefined) || (core.s === undefined) || (core.i === undefined)) {
            return this.kError("postSelfPublicKeys", "getSearchByJson", "The system module or main module or internode module is down");
        }
        const ret1 = await core.m.lib.getSearchByJson<objTx>(core.m, {key: "cc_tx", value: tag_pubkey_data, ignoreGenesisBlockIsNotFound: true, matcherType: "strict"});
        if (ret1.isFailure()) return ret1;
        let skipPubkey: boolean = false;
        for (const tx of ret1.value) {
            if (tx.data === undefined) {
                continue;
            } else {
                const data: any = tx.data;
                if (data.nodename === core.cache[0].nodename) {
                     LOG("Warning", 1, "Public key for " + data.nodename + " is already posted. Skip.");
                    skipPubkey = true;
                }
            }
        }
        if (skipPubkey === false) {
            const register_data: postJsonOptions = {
                type: "new",
                data: {
                    cc_tx: tag_pubkey_data,
                    nodename: core.i.conf.self.nodename,
                    verify_key: core.cache[0].verify_key,
                    verify_key_hex: core.cache[0].verify_key_hex
                },
                compatDateTime: true
            }
            const ret2 = await core.m.lib.postByJson(core.m, register_data, this.common_parsel);
            if (ret2.isFailure()) return ret2;

            // immediately deliver to other node
            const ret3 = await core.s.lib.postDeliveryPool(core.s, true);
            if (ret3.isFailure()) return ret3;
        }

        this.coreCondition = "active";
        return this.kOK<void>(undefined);
    }

    /**
     * Get all public keys and certificate on the blockchain and cache them.
     * @param core - set ccKeyringType instance
     * @param waitOnStartUp - wait until everything are uploaded
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async refreshPublicKeyCache(core: ccKeyringType, waitOnStartUp?: boolean): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:refreshPublicKeyCache");

        let ret1;
        while (true) {
            if (core.m !== undefined) {
                ret1 = await core.m.lib.getSearchByJson(core.m, {key: "cc_tx", value: tag_pubkey_data, sortOrder: -1, excludeBlocked: true});
                if (ret1.isFailure()) return ret1;
                if (ret1.value.length === 0) {
                    LOG("Notice", -1, "No verify keys have been published yet");
                    return this.kError("refreshPublicKeyCache", "getSearchByJson_pubkey", "No verify keys have been published yet");
                } else {
                    let ring_bc: any;
                    for (ring_bc of ret1.value) {
                        let found: boolean = false;
                        for (let index = 0; index < core.cache.length; index++) {
                            if ((ring_bc.data.nodename !== undefined) && (ring_bc.data.nodename === core.cache[index].nodename)) {
                                found = true;
                                core.cache[index].nodename = ring_bc.data.nodename;
                                core.cache[index].verify_key = ring_bc.data.verify_key;
                                core.cache[index].verify_key_hex = ring_bc.data.verify_key_hex;
                            }
                        }
                        if (found === false) {
                            core.cache.push({nodename: ring_bc.data.nodename, verify_key: ring_bc.data.verify_key, verify_key_hex: ring_bc.data.verify_key_hex});
                        }
                    }
                }
            } else {
                return this.kError("refreshPublicKeyCache", "getSearchByJson_pubkey", "The main module is down");
            }
            if ((waitOnStartUp !== true) || (ret1.value.length !== 0)) {
                break;
            } else {
                LOG("Notice", 0, "Waiting for initial key is published.");
            }
        };
        return this.kOK<void>(undefined);
    }

    /**
     * Sign by its own private key.
     * @param core - set ccKeyringType instance
     * @param target - the target object to sign
     * @param trackingId - the tracking id of the target object
     * @returns returns with gResult, that is wrapped by a Promise, that contains signature string if it's success, and gError if it's failure.
     */
    public async signByPrivateKey(core: ccKeyringType, target: object, trackingId: string): Promise<gResult<string, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "KeyringModule:signByPrivateKey:" + trackingId);

        if (core.cache[0].sign_key_hex === undefined) {
            return this.kError("signByPrivateKey", "sign_key_hex", "The private key is invalid");
        }
        let signature: string = "";
        try {
            const targetHex = Buffer.from(JSON.stringify(target)).toString("hex");
            signature = Buffer.from(ed25519.sign(targetHex, core.cache[0].sign_key_hex)).toString("hex");
            LOG("Debug", 0, "KeyringModule:signByPrivateKey:target:" + JSON.stringify(target));
            LOG("Debug", 0, "KeyringModule:signByPrivateKey:sign_key_hex:" + core.cache[0].sign_key_hex);
            LOG("Debug", 0, "KeyringModule:signByPrivateKey:signature:" + signature);
            LOG("Debug", 0, "KeyringModule:signByPrivateKey:verify_key_hex:" + core.cache[0].verify_key_hex);
        } catch (error: any) {
            return this.kError("signByPrivateKey", "sign:", error.toString());
        }
        return this.kOK<string>(signature);
    }

    /**
     * Verify if the target object is malformed or not.
     * @param core - set ccKeyringType instance
     * @param signature - signature string
     * @param target - the target object to verify
     * @param nodename - set nodename to get pub key
     * @param trackingId - can set trackingId to trace
     * @returns returns with gResult, that is wrapped by a Promise, that contains boolean if it's success, and gError if it's failure.
     * On success, the value is true if the target object is not malformed, and false if it's malformed.
     */
    public async verifyByPublicKey(core: ccKeyringType, signature: string, target: object, nodename: string, trackingId?: string): Promise<gResult<boolean, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        if (trackingId !== undefined) {
            LOG("Info", 0, "KeyringModule:verifyByPublicKey:" + trackingId);
        } else {
            LOG("Info", 0, "KeyringModule:verifyByPublicKey");
        }

        let publicKey: string | undefined;
        for (const keys of core.cache) {
            if (nodename === keys.nodename) publicKey = keys.verify_key_hex;
        }

        if (publicKey === undefined) {
            // Update once
            const ret1 = await core.lib.refreshPublicKeyCache(core);
            if (ret1.isFailure()) {
                return ret1;
            }
            for (const keys of core.cache) {
                if (nodename === keys.nodename) publicKey = keys.verify_key_hex;
            }
            if (publicKey === undefined) {
                LOG("Debug", 0, "KeyringModule:verifyByPublicKey:nodename:" + nodename);
                LOG("Debug", 0, "KeyringModule:verifyByPublicKey:nodename:" + JSON.stringify(core.cache));
                LOG("Info", 0, "The public key is not found or nodename is malformed");
                return this.kError("verifyByPublicKey", "refreshPublicKeyCache", "The public key is not found or nodename is malformed");
            }
        }

        const targetHex = Buffer.from(JSON.stringify(target)).toString("hex");
        try {
            LOG("Debug", 0, "KeyringModule:verifyByPublicKey:target:" + JSON.stringify(target));
            LOG("Debug", 0, "KeyringModule:verifyByPublicKey:verify_key_hex:" + publicKey);
            LOG("Debug", 0, "KeyringModule:verifyByPublicKey:signature:" + signature);
            return this.kOK<boolean>(ed25519.verify(signature, targetHex, publicKey));
        } catch (error: any) {
            return this.kError("verifyByPublicKey", "verify", error.toString());
        }
    }
}