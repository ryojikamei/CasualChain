/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { z } from "zod"

export const getJsonInputSchema = z.object({
    key: z.string(),
    value: z.any(),
    searchBlocks: z.boolean().optional(),
    excludeBlocked: z.boolean().optional(),
    excludePooling: z.boolean().optional(),
    excludeNonpropergate: z.boolean().optional(),
    ignoreGenesisBlockIsNotFound: z.boolean().optional(),
    sortOrder: z.number().optional(),
    matcherType: z.string().optional(),
    whole: z.boolean().optional(),
    constrainedSize: z.number().optional(),
    tenant: z.string().optional()
})
export type getJsonOptions = z.infer<typeof getJsonInputSchema>;

export const getTransactionOrBlockInputSchema = z.object({
    targetIsBlock: z.boolean().optional(),
    constrainedSize: z.number().optional(),
    tenant: z.string().optional()
})
export type getTransactionOrBlockOptions = z.infer<typeof getTransactionOrBlockInputSchema>;

export const getTransactionInputSchema = z.object({
    excludeNonpropergate: z.boolean().optional(),
    sortOrder: z.number().optional(),
    constrainedSize: z.number().optional(),
    tenant: z.string().optional()
})
export type getTransactionOptions = z.infer<typeof getTransactionInputSchema>;

export const getAllBlockInputSchema = z.object({
    sortOrder: z.number().optional(),
    bareTransaction: z.boolean().optional(),
    ignoreGenesisBlockIsNotFound: z.boolean().optional(),
    constrainedSize: z.number().optional(),
    tenant: z.string().optional()
})
export type getAllBlockOptions = z.infer<typeof getAllBlockInputSchema>;

export const getBlockInputSchema = z.object({
    sortOrder: z.number().optional(),
    ignoreGenesisBlockIsNotFound: z.boolean().optional(),
    constrainedSize: z.number().optional(),
    tenant: z.string().optional()
})
export type getBlockOptions = z.infer<typeof getBlockInputSchema>;

export const getTransactionHeightInputSchema = z.object({
    excludeBlocked: z.boolean().optional(),
    excludePooling: z.boolean().optional(),
    excludeNonpropergate: z.boolean().optional(),
    tenant: z.string().optional()
})
export type getTransactionHeightOptions = z.infer<typeof getTransactionHeightInputSchema>;

export const postJsonInputSchema = z.object({
    type: z.string(),
    prev_id: z.string().optional(),
    data: z.any(),
    compatDateTime: z.boolean().optional(),
    tenant: z.string().optional()
})
export type postJsonOptions = z.infer<typeof postJsonInputSchema>;