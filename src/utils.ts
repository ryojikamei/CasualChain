/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { ulid } from "ulid";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { setTimeout } from "timers/promises";


/**
 * A random ObjectId or ObjectId-like string generator
 * @returns returns 3 useful functions
 * - byObj: returns ObjectId
 * - byOldObj: returns old ObjectId format
 * - byString: returns ObjectId-like plain hex string
 */
export function randomOid() {
    let oid = new ObjectId(Buffer.from(ulid()).toString("hex").substring(0, 24));
    return {
        byObj() { return oid },
        byOldObj() { return { $oid: oid.toHexString() } },
        byStr() { return oid.toHexString() }
    }
}

/**
 * A random string generator that has 16 charactors
 * @returns random string that has 16 charactors
 */
export function randomString16() {
    return randomBytes(16).toString("base64").substring(0, 16);
}

/**
 * A random string generator that has 24 charactors
 * @returns random string that has 24 charactors
 */
export function randomString24() {
    return randomBytes(24).toString("base64").substring(0, 24);
}

/**
 * A random string generator that has 64 charactors
 * @returns random string that has 64 charactors
 */
export function randomString64() {
    return randomBytes(64).toString("base64").substring(0, 64);
}

/**
 * A simple sleep implementation
 * @param ms specify sleep time in milliseconds
 */
export async function sleep(ms: number) {
    await setTimeout(ms);
}

/**
 * The generic gResult type
 */
export type gResult<T, E> = gSuccess<T, E> | gFailure<T, E>;
/**
 * The generic gSuccess class
 */
export class gSuccess<T, E> {
    constructor(readonly value: T) {}
    type = "success" as const;
    isSuccess(): this is gSuccess<T, E> {
        return true;
    }
    isFailure(): this is gFailure<T, E> {
        return false;
    }
}
/**
 * The generic gFailure class
 */
export class gFailure<T, E> {
    constructor(readonly value: E) {}
    type = "failure" as const;
    isSuccess(): this is gSuccess<T, E> {
        return false;
    }
    isFailure(): this is gFailure<T, E> {
        return true;
    }
}

/**
 * The generic gError class
 */
export class gError extends Error {
    public origin: {
        module: string,
        func: string,
        pos: string | undefined,
        detail: string | undefined
    };
    constructor(module: string, func: string, pos?: string, message?: string) {
        super(message);
        this.origin = {
            module: module,
            func: func,
            pos: pos,
            detail: message
        }
    };
}