/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

export function winston_mock(level?: string): any {
    if (level === "errorSample") {
        throw new Error("errorSample");
    }
    return {
        error() { return undefined; },
        warn() { return undefined; },
        info() { return undefined; },
        debug() { return undefined; }
    };
}