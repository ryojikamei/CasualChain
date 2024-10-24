/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";

import { execa } from "execa";
import { ed25519 } from "@noble/curves/ed25519";
import { generateKeys, sign, verify } from "paseto-ts/v4";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccKeyringType } from ".";
import { keyringConfigType } from "../config";
import { ccLogType } from "../logger/index.js";

import { objTx } from "../datastore";
import { postJsonOptions } from "../main";
import { moduleCondition } from "../index.js";
import { AnyARecord } from "dns";
import { Payload } from "paseto-ts/lib/types";

/**
 * The tag string for the transaction of public keys
 */
export const tag_pubkey_data = "system.v3.keyring.config.pubkey";

/**
 * The tag string for the transaction of tls cetificates
 */
export const tag_tlscrt_data = "system.v3.keyring.config.tlscrt";

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

        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "init");
        LOG("Info", "start");

        const privateKey = this.configPath + conf.sign_key_file;
        if (existsSync(privateKey) === false) {
            if (conf.create_keys_if_no_sign_key_exists === true) {
                LOG("Notice", "The private key file is not found. Generate a key pair");
                await core.lib.generateKeyPair(core, this.configPath);
            } else {
                LOG("Error", "The private key file is not found");
                return this.kError("init", "generateKeyPair", "The private key file is not found");
            }
        }

        // for TLS/gRPC
        const private_openssl = await readFile(this.configPath + conf.sign_key_file, "utf-8");
        const public_openssl = await readFile(this.configPath + conf.verify_key_file, "utf-8");
        // for noble-curves
        const private_noble = Buffer.from(private_openssl.split(/\n/)[1].slice(0,32)).toString("hex");
        const public_noble = Buffer.from(ed25519.getPublicKey(private_noble)).toString("hex")
        // for PASETO
        const pasetoKeys = generateKeys("public"); 

        const CertificateSigningRequest = this.configPath + conf.tls_csr_file;
        if (existsSync(CertificateSigningRequest) === false) {
            if (conf.create_keys_if_no_sign_key_exists === true) {
                LOG("Notice", "Certificate files are not found. Generate certificates");
                await core.lib.generateCertificates(core, this.configPath);
            } else {
                LOG("Error", "Certificate files are not found");
                return this.kError("init", "generateCertificates", "The certificate files are not found");
            }
        }

        //const csr_cache = await readFile(this.configPath + conf.tls_csr_file, "utf-8");
        const crt_cache = await readFile(this.configPath + conf.tls_crt_file, "utf-8");

        core.cache.push({
            nodename: "self",
            sign_key: private_openssl,
            sign_key_hex: private_noble,
            sign_key_paserk: pasetoKeys.secretKey,
            verify_key: public_openssl,
            verify_key_hex: public_noble,
            verify_key_paserk: pasetoKeys.publicKey,
            tls_crt: crt_cache
        });

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
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "restart");
        LOG("Info", "start");

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
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "generateKeyPair");
        LOG("Info", "start");

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
            LOG("Warning", private_ret.stderr);
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
            LOG("Warning", public_ret.stderr);
            return this.kError("generateKeyPair", "public_ret:" + code.toString(), public_ret.stderr);
        }

        return this.kOK<void>(undefined);
    }

    public async generateCertificates(core: ccKeyringType, keypath: string): Promise<gResult<boolean, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "generateCertificates");
        LOG("Info", "start");

        const bin: string = "openssl";

        const csr_args: string[] = ['req', '-new', '-key', keypath + core.conf.sign_key_file, '-subj', 
        '/CN=localhost', '-config', keypath + "SANconfig.txt",
        '-out', keypath + core.conf.tls_csr_file ];
        const csr_ret = await execa(bin, csr_args, { shell: false });
        if (csr_ret.exitCode !== 0) {
            let code = 0;
            if (csr_ret.exitCode === undefined) {
                code = -100;
            } else {
                code = csr_ret.exitCode;
            }
            LOG("Warning", csr_ret.stderr);
            return this.kError("generateCertificates", "csr_ret:" + code.toString(), csr_ret.stderr);
        }

        const crt_args: string[] = ['x509', '-days', '3652', '-req', '-sha256', '-in', keypath + core.conf.tls_csr_file, 
        '-CA', keypath + core.conf.tls_ca_crt_file, '-CAkey', keypath + core.conf.tls_ca_key_file, '-set_serial', '01', 
        '-extensions', 'SAN', '-extfile', keypath + "SANconfig.txt", '-out', keypath + core.conf.tls_crt_file];
        const crt_ret = await execa(bin, crt_args, { shell: false });
        if (crt_ret.exitCode !== 0) {
            let code = 0;
            if (crt_ret.exitCode === undefined) {
                code = -100;
            } else {
                code = crt_ret.exitCode;
            }
            LOG("Warning", crt_ret.stderr);
            return this.kError("generateCertificates", "crt_ret:" + code.toString(), crt_ret.stderr);
        }

        return this.kOK<boolean>(true);
    }

    /**
     * Store owning public keys and certificates into the blockchain.
     * @param core - set ccKeyringType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postSelfPublicKeys(core: ccKeyringType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "postSelfPublicKeys");
        LOG("Info", "start");

        if ((core.cache[0] === undefined) || (core.cache[0].nodename !== "self")) {
            LOG("Error", "The modules is not initialized properly!");
            return this.kError("postSelfPublicKeys", "prerequisite", "The modules is not initialized properly!");
        }

        if ((core.m === undefined) || (core.s === undefined) || (core.i === undefined)) {
            return this.kError("postSelfPublicKeys", "getSearchByJson", "The system module or main module or internode module is down");
        }

        // public key
        const ret1 = await core.m.lib.getSearchByJson<objTx>(core.m, {key: "cc_tx", value: tag_pubkey_data, ignoreGenesisBlockIsNotFound: true, matcherType: "strict", tenant: core.conf.default_tenant_id});
        if (ret1.isFailure()) return ret1;
        let skipPubkey: boolean = false;
        for (const tx of ret1.value) {
            if (tx.data === undefined) {
                continue;
            } else {
                const data: any = tx.data;
                if (data.nodename === core.cache[0].nodename) {
                    LOG("Warning", "Public key for " + data.nodename + " is already posted. Skip.");
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
                compatDateTime: true,
                tenant: core.conf.default_tenant_id
            }
            const ret2 = await core.m.lib.postByJson(core.m, register_data);
            if (ret2.isFailure()) return ret2;
    
            // immediately deliver to other node
            const ret3 = await core.s.lib.postDeliveryPool(core.s, true);
            if (ret3.isFailure()) return ret3;
        }

        // tls cert
        const ret4 = await core.m.lib.getSearchByJson<objTx>(core.m, {key: "cc_tx", value: tag_tlscrt_data, ignoreGenesisBlockIsNotFound: true, matcherType: "strict", tenant: core.conf.default_tenant_id});
        if (ret4.isFailure()) return ret4;
        let skipTlscrt: boolean = false;
        for (const tx of ret4.value) {
            if (tx.data === undefined) {
                continue;
            } else {
                const data: any = tx.data;
                if (data.nodename === core.cache[0].nodename) {
                    LOG("Warning", "Certificate for " + data.nodename + " is already posted. Skip.");
                    skipTlscrt = true;
                }
            }
        }
        if (skipTlscrt === false) {
            const register_data: postJsonOptions = {
                type: "new",
                data: {
                    cc_tx: tag_tlscrt_data,
                    nodename: core.i.conf.self.nodename,
                    payload: core.cache[0].tls_crt
                },
                compatDateTime: true,
                tenant: core.conf.default_tenant_id
            }
            const ret5 = await core.m.lib.postByJson(core.m, register_data);
            if (ret5.isFailure()) return ret5;
    
            // immediately deliver to other node
            const ret6 = await core.s.lib.postDeliveryPool(core.s, true);
            if (ret6.isFailure()) return ret6;
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
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "refreshPublicKeyCache");
        LOG("Info", "start");

        let ret1;
        while (true) {
            if (core.m !== undefined) {
                ret1 = await core.m.lib.getSearchByJson(core.m, {key: "cc_tx", value: tag_pubkey_data, sortOrder: -1, excludeBlocked: true, tenant: core.conf.default_tenant_id});
                if (ret1.isFailure()) return ret1;
                if (ret1.value.length === 0) {
                    LOG("Notice", "No verify keys have been published yet");
                    return this.kError("refreshPublicKeyCache", "getSearchByJson", "No verify keys have been published yet");
                } else {
                    let ring_bc: any;
                    // NOTE: at last the oldest one is cached
                    for (ring_bc of ret1.value) {
                        let found: boolean = false;
                        for (let index = 0; index < core.cache.length; index++) {
                            if ((ring_bc.data.nodename !== undefined) && (ring_bc.data.nodename === core.cache[index].nodename)) {
                                found = true;
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
                LOG("Notice", "Waiting for initial key is published.");
                setTimeout(() => {
                    // Do nothing
                }, 1000);
            }
        };

        let ret2;
        while (true) {
            if (core.m !== undefined) {
                ret2 = await core.m.lib.getSearchByJson(core.m, {key: "cc_tx", value: tag_tlscrt_data, sortOrder: -1, excludeBlocked: true, tenant: core.conf.default_tenant_id});
                if (ret2.isFailure()) return ret2;
                if (ret2.value.length === 0) {
                    LOG("Notice", "No tls certs have been published yet");
                    return this.kError("refreshPublicKeyCache", "getSearchByJson", "No tls certs have been published yet");
                } else {
                    let ring_bc: any;
                    // NOTE: at last the oldest one is cached
                    for (ring_bc of ret2.value) {
                        for (let index = 0; index < core.cache.length; index++) {
                            if  ((ring_bc.data.nodename !== undefined) && (ring_bc.data.nodename === core.cache[index].nodename)) {
                                core.cache[index].tls_crt = ring_bc.data.payload;
                            }
                        }
                    }
                }
            } else {
                return this.kError("refreshPublicKeyCache", "getSearchByJson_tlscrt", "The main module is down");
            }
            if ((waitOnStartUp !== true) || (ret2.value.length !== 0)) {
                break;
            } else {
                LOG("Notice", "Waiting for initial crt is published.");
                setTimeout(() => {
                    // Do nothing
                }, 1000);
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
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "signByPrivateKey");
        LOG("Info", "start:" + trackingId);

        if (core.cache[0].sign_key_hex === undefined) {
            return this.kError("signByPrivateKey", "sign_key_hex", "The private key is invalid");
        }
        let signature: string = "";
        try {
            const targetHex = Buffer.from(JSON.stringify(target)).toString("hex");
            signature = Buffer.from(ed25519.sign(targetHex, core.cache[0].sign_key_hex)).toString("hex");
            LOG("Debug", "KeyringModule:signByPrivateKey:target:" + JSON.stringify(target));
            LOG("Debug", "KeyringModule:signByPrivateKey:sign_key_hex:" + core.cache[0].sign_key_hex);
            LOG("Debug", "KeyringModule:signByPrivateKey:signature:" + signature);
            LOG("Debug", "KeyringModule:signByPrivateKey:verify_key_hex:" + core.cache[0].verify_key_hex);
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
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "verifyByPublicKey");
        if (trackingId !== undefined) {
            LOG("Info", "start:" + trackingId);
        } else {
            LOG("Info", "start");
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
                LOG("Debug", "KeyringModule:verifyByPublicKey:nodename:" + nodename);
                LOG("Debug", "KeyringModule:verifyByPublicKey:nodename:" + JSON.stringify(core.cache));
                LOG("Info", "The public key is not found or nodename is malformed");
                return this.kError("verifyByPublicKey", "refreshPublicKeyCache", "The public key is not found or nodename is malformed");
            }
        }

        const targetHex = Buffer.from(JSON.stringify(target)).toString("hex");
        try {
            LOG("Debug", "KeyringModule:verifyByPublicKey:target:" + JSON.stringify(target));
            LOG("Debug", "KeyringModule:verifyByPublicKey:verify_key_hex:" + publicKey);
            LOG("Debug", "KeyringModule:verifyByPublicKey:signature:" + signature);
            return this.kOK<boolean>(ed25519.verify(signature, targetHex, publicKey));
        } catch (error: any) {
            return this.kError("verifyByPublicKey", "verify", error.toString());
        }
    }

    /**
     * Sign with PASETO to generate a token
     * @param core - set ccKeyringType instance
     * @param target - the target object to sign
     * @returns returns with gResult, that contains the token string if it's success, and gError if it's failure.
     */
    public signWithPaseto<T extends { [key: string]: any; }>(core: ccKeyringType, target: T & Payload): gResult<string, gError> {
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "signWithPaseto");
        LOG("Info", "start");

        if (core.cache[0].sign_key_paserk === undefined) {
            return this.kError("signWithPaseto", "sign_key", "The private key is invalid");
        }
        try {
            return this.kOK(sign(core.cache[0].sign_key_paserk, target));
        } catch (error: any) {
            return this.kError("signWithPaseto", "sign", error.toString());
        }
    }

    public verifyWithPaseto(core: ccKeyringType, token: string): gResult<object, gError> {
        const LOG = core.log.lib.LogFunc(core.log, "Keyring", "verifyWithPaseto");
        LOG("Info", "start:" + token);

        if (core.cache[0].verify_key_paserk === undefined) {
            return this.kError("verifyWithPaseto", "verify_key", "The public key is invalid");
        }
        try {
            const { payload, footer } = verify(core.cache[0].verify_key_paserk, token);
            return this.kOK(payload);
        } catch (error: any) {
            return this.kError("verifyWithPaseto", "verify", error.toString());
        }
    }
}