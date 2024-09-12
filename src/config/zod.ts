/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { z } from "zod";
import { ConfigModule } from "./core";

export type wholeConfigType = {
    l: logConfigType,
    s: systemConfigType,
    m: mainConfigType,
    d: dsConfigType,
    a: apiConfigType,
    i: inConfigType,
    b: blockConfigType,
    k: keyringConfigType,
    e: eventConfigType
}

/**
 * The master configuration type
 */
export type ccConfigType = wholeConfigType & {
    lib: ConfigModule
}
/**
 * The configuration properties for LogModule
 */
export type logConfigType = {
    console_output: boolean,
    console_level: number,
    console_color: string,
    console_color_code: string,
    file_output: boolean,
    file_path: string,
    file_rotation: boolean,
    file_level: number,
    file_level_text: string
}
export const logConfigInputSchema = z.object({
    console_output: z.boolean(),
    console_level: z.string().max(255),
    console_color: z.string(),
    file_output: z.boolean(),
    file_path: z.string().max(1023).startsWith("/"),
    file_rotation: z.boolean(),
    file_level: z.string().max(255)
})
export type logConfigInputType = z.infer<typeof logConfigInputSchema>;

export const internalEventsInputSchema = z.object({
    postScanAndFixBlockMinInterval: z.number().max(10080).min(0),
    postScanAndFixPoolMinInterval: z.number().max(10080).min(0),
    postDeliveryPoolMinInterval: z.number().max(10080).min(0),
    postAppendBlocksMinInterval: z.number().max(10080).min(0)
})
/**
 * Internal event configuration
 */
export type internalEvents = z.infer<typeof internalEventsInputSchema>;

export const systemConfigInputSchema = z.object({
    node_mode: z.string().max(1024),
    events_internal: internalEventsInputSchema,
    enable_default_tenant: z.boolean(),
    administration_id: z.string().uuid(),
    default_tenant_id: z.string().uuid()
})
/**
 * The configuration property for SystemModule
 */
export type systemConfigType = z.infer<typeof systemConfigInputSchema>;

export const mainConfigInputSchema = z.object({
    default_tenant_id: z.string().uuid()
});
/**
 * The configuration property for MainModule
 */
export type mainConfigType = z.infer<typeof mainConfigInputSchema>;

export const dsConfigInputSchema = z.object({
    password_encryption: z.boolean(),
    mongo_host: z.string().max(255), // will be validated by mongodb
    mongo_port: z.number().min(-1).max(65535), // set -1 at using mongoms
    mongo_password: z.string().max(255),
    mongo_dbname: z.string().max(255),
    mongo_dbuser: z.string().max(255),
    mongo_authdb: z.string().max(255),
    mongo_blockcollection: z.string().max(255),
    mongo_poolcollection: z.string().max(255),
    queue_ondisk: z.boolean(),
    administration_id: z.string().uuid(),
    default_tenant_id: z.string().uuid(),
    enable_default_tenant: z.boolean()
})
/**
 * The configuration property for DsModule
 */
export type dsConfigType = z.infer<typeof dsConfigInputSchema>;

export const apiConfigInputSchema = z.object({
    rest: z.object({
        password_encryption: z.boolean(),
        userapi_port: z.number().min(0).max(65535),
        userapi_user: z.string().max(255),
        userapi_password: z.string().max(255),
        adminapi_port: z.number().min(0).max(65535),
        adminapi_user: z.string().max(255),
        adminapi_password: z.string().max(255),
        use_tls: z.boolean()
    })
})
/**
 * The configuration properties for ApiModule
 */
export type apiConfigType = z.infer<typeof apiConfigInputSchema>;

export const nodePropertyInputSchema = z.object({
    allow_outgoing: z.boolean(),
    nodename: z.string().max(255),
    host: z.string().max(255),
    rpc_port: z.number().min(0).max(65535),
    abnormal_count: z.number().optional(),
    use_tls_internode: z.boolean(),
    administration_id: z.string().uuid()
})
/**
 * The configuration properties for each node
 */
export type nodeProperty = z.infer<typeof nodePropertyInputSchema>;


export const inConfigInputSchema = z.object({
    self: z.object({
        nodename: z.string().max(255),
        rpc_port: z.number().min(0).max(65535),
        use_tls_internode: z.boolean()
    }),
    abnormalCountForJudging: z.number().safe().nonnegative(),
    nodes: z.array(nodePropertyInputSchema),
    administration_id: z.string().uuid(),
    default_tenant_id: z.string().uuid()
})
/**
 * The configuration properties for InModule
 */
export type inConfigType = z.infer<typeof inConfigInputSchema>;

export const Ca3PropertyInputSchema = z.object({
    minLifeTime: z.number().safe().positive(),
    maxLifeTime: z.number().safe().positive(),
    minSignNodes: z.number().safe().positive(),
    maxSignNodes: z.number().safe().positive()
})
/**
 * The configuration properties for CA3 algorithm
 */
export type Ca3Property = z.infer<typeof Ca3PropertyInputSchema>;

export const blockConfigInputSchema = z.object({
    ca3: Ca3PropertyInputSchema,
    administration_id: z.string().uuid(),
    default_tenant_id: z.string().uuid()
})
/**
 * The configuration properties for BlockModule
 */
export type blockConfigType = z.infer<typeof blockConfigInputSchema>;

export const keyringConfigInputSchema = z.object({
    create_keys_if_no_sign_key_exists: z.boolean(),
    sign_key_file: z.string().max(255),
    verify_key_file: z.string().max(255),
    tls_csr_file: z.string().max(255),
    tls_crt_file: z.string().max(255),
    tls_ca_key_file: z.string().max(255),
    tls_ca_crt_file: z.string().max(255),
    default_tenant_id: z.string().uuid()
})
/**
 * The configuration properties for KeyringModule
 */
export type keyringConfigType = z.infer<typeof keyringConfigInputSchema>;

export const eventConfigInputSchema = z.object({
    enable_internaltasks: z.boolean()
})
/**
 * The configuration property for EventModule
 */
export type eventConfigType = z.infer<typeof eventConfigInputSchema>;