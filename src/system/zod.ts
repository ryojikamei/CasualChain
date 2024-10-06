/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { z } from "zod"


export const postGenesisBlockInputSchema = z.object({
    trytoreset: z.boolean()
})
export type postGenesisBlockOptions = z.infer<typeof postGenesisBlockInputSchema>;

export const postScanAndFixInputSchema = z.object({
    scanonly: z.boolean()
})
export type postScanAndFixOptions = z.infer<typeof postScanAndFixInputSchema>;

export const postOpenParcelInputSchema = z.object({
    adminId: z.string(),
    recallPhrase: z.string()
})
export type postOpenParcelOptions = z.infer<typeof postOpenParcelInputSchema>;

export const postCloseParcelInputSchema = z.object({
    adminId: z.string(),
    tenantId: z.string()
})
export type postCloseParcelOptions = z.infer<typeof postCloseParcelInputSchema>;