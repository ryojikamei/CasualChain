/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { keyringConfigType } from "../config"
import { ccLogType } from "../logger"
import { ccSystemType } from "../system"
import { ccMainType } from "../main"
import { ccInType } from "../internode"

import * as core from "./core.js"
export import KeyringModule = core.KeyringModule

/**
 * Caching keys and certificates
 * - nodename: the nodename
 * - sign_key: only own node has private key on the memory
 * - sign_key_hex: sign_key by hex format
 * - verify_key: public key of its node
 * - verify_key_hex: verify key by hex format
 * - tls_crt: TLS certificate of its node
 */
export type cachedKeyFiles = {
    nodename?: string,
    sign_key?: string,
    sign_key_hex?: string,
    sign_key_paserk?: string,
    verify_key?: string,
    verify_key_hex?: string,
    verify_key_paserk?: string,
    tls_crt?: string
}

/**
 * The core object of the KeyringModule
 */
export type ccKeyringType = {
    lib: KeyringModule,
    conf: keyringConfigType,
    log: ccLogType,
    cache: cachedKeyFiles[],
    s: ccSystemType | undefined,
    m: ccMainType | undefined,
    i: ccInType | undefined
}