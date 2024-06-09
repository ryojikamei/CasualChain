/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import * as core from "./core.js"
export import ConfigModule = core.ConfigModule;

import * as zod from "./zod.js"
export import ccConfigType = zod.ccConfigType;
export import logConfigType = zod.logConfigType;
export import logConfigInputType = zod.logConfigInputType;
export import internalEvents = zod.internalEvents;
export import systemConfigType = zod.systemConfigType;
export import mainConfigType = zod.mainConfigType;
export import dsConfigType = zod.dsConfigType;
export import apiConfigType = zod.apiConfigType;
export import nodeProperty = zod.nodeProperty;
export import inConfigType = zod.inConfigType;
export import Ca3Property = zod.Ca3Property;
export import blockConfigType = zod.blockConfigType;
export import keyringConfigType = zod.keyringConfigType;
export import eventConfigType = zod.eventConfigType;


export type getConfigurationOptions = {
    showPasswords?: boolean
}
