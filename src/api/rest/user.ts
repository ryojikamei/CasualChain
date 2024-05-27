/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import express from "express";
import basicAuth from "express-basic-auth";

import { setInterval } from "timers/promises";

import { gResult, gSuccess, gFailure, gError } from "../../utils.js";

import { ccApiType } from "../index.js";

/**
 * Provide User APIs.
 * It provides following REST-like APIs:
 * 
 * - "/get/byjson": searches and gets data by JSON format, type GET.
 *   IN: sets the search condition by a key/value pair in JSON format in body.
 *   OUT: on success, returns response code 200 and transaction data in an array of JSON
 *        format, that is narrow down by the search condition.
 *        On fail, returns response code 503 with error detail.
 *   FYI: see getSearchByJson() in main module for understanding the essentials of processing.
 * 
 * - "/get/byoid/:oid(\\w{24})": searches and gets data that has the oid, type GET.
 *   IN: set a 24-character oid at the end of url. The body will be ignored.
 *   OUT: on success, returns response code 200 and single transaction data in JSON format,
 *        that have the specified oid. On fail, returns response code 503 with no 
 *        data.
 *   FYI: see getSearchByOid() in main module for understanding the essentials of processing.
 * 
 * - "/get/alltxs": gets all transaction data, type GET.
 *   IN: no options are needed.
 *   OUT: on success, returns response code 200 and transaction data in an array of JSON
 *        format. On fail, returns response code 503 with error detail.
 *   FYI: see getAll() in main module for understanding the essentials of processing.
 * 
 * - "/get/blocked": gets all already-blockchained data, type GET.
 *   IN: no options are needed.
 *   OUT: on success, returns response code 200 and transaction data in an array of JSON
 *        format. This API returns data in the blockchain structure. That is, the array
 *        may contains multiple or single blocks, and a block may contain multiple or 
 *        single transactions in 'data' section. The very first block is called the genesis
 *        block and contains no data. On fail, returns response code 503 with no 
 *        data.
 *   FYI: see getAllBlock() in main module for understanding the essentials of processing.
 * 
 * - "/get/pooling": gets all waiting data to blockchained, type GET.
 *   IN: no options are needed.
 *   OUT: on success, returns response code 200 and transaction data in an array of JSON
 *        format. On fail, returns response code 503 with error detail.
 *   FYI: see getAllPool() in main module for understanding the essentials of processing.
 *
 * - "/get/history/:oid(\\w{24})": gets the chain to the past of the specified transaction,
 *   type GET.
 *   IN: set a 24-character oid at the end of url. The body will be ignored.
 *   OUT: on success, returns an array of JSON that contains all transactions from the 
 *        specified transaction into the past. Note that future transactions are not
 *        included. On fail, returns response code 503 with error detail.
 *   FYI: see getHistoryByOid() in main module for understanding the essentials of processing.
 * 
 * - "/post/byjson": posts a transaction with JSON format, type POST.
 *   IN: set user data in JSON format, under 'data' key. Also, a transaction must have
 *       'type' key with a value. By default, key 'type' can have a value of one of three
 *       types. That is, 'new', 'update', or 'delete'. Transactions that have no relation
 *       to others have 'new'. An update transaction of a previous transaction is appended
 *       with 'update'. And the transaction whose purpose is to disable a series of 
 *       transactions is 'delete'. For 'update' and 'delete' transactions, an 'prev_id' key
 *       containing the value of oid of the previous transaction is required also.
 *   OUT: on success, returns response code 200 and oid in the body.
 *        On fail, returns response code 503 with error detail.
 */
export class ListnerV3UserApi {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected userOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param module - set the api name
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected userError(module: string, func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError(module, func, pos, message));
    }

    /**
     * Recreate error messages for external use.
     * @param errmsg - set the gError instance
     * @param api - set the api name
     * @returns returns crafted object
     */
    protected craftErrorResponse(errmsg: gError, api: string): object {
        return {
            api: api, 
            component: errmsg.origin.module,
            function: errmsg.origin.func,
            position: errmsg.origin.pos,
            detail: errmsg.message
        };
    }

    /**
     * The express API handler
     */
    protected api: express.Express;

    /**
     * Count the number of running APIs
     */
    protected runcounter: number;

    constructor() {
        this.api = express();
        this.runcounter = 0;
    }

    /**
     * Basic authentication helper method to return unauthorized response
     * @param req - request body 
     * @returns returns req.auth
     */
    private getUnauthorizedResponse(req: any): string {
        return req.auth
        ? ("Credentials " + req.auth.user + ":" + req.auth.password + " rejected")
        : "No credentials provided"
    }

    /**
     * Register basic authentication and API endpoints
     * @param acore - set ccApiType instance
     * @returns returns with gResult type that contains express.Express if it's success, and unknown if it's failure.
     */
    public async init(acore: ccApiType): Promise<gResult<express.Express, unknown>> {
        const LOG = acore.log.lib.LogFunc(acore.log);
        LOG("Info", 0, "UserApi:init");

        this.api.use(express.json({ limit: '16777216b' }));
        this.api.use(express.urlencoded({ extended: true, limit: '16777216b' }));
        const authUser = acore.conf.rest.userapi_user;
        const authPassword = acore.conf.rest.userapi_password;
        this.api.use(basicAuth({users: {[authUser]:authPassword}, unauthorizedResponse: this.getUnauthorizedResponse}));

        this.api.get("/get/byjson", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-byjson");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getSearchByJson(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/byjson"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getSearchByJson", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/getbyjson"));
            }
        });

        this.api.get("/get/byoid/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-byoid");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getSearchByOid(acore.m, req.params.oid, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/byoid"));
                    }
                    let outMsg = data.value;
                    if (outMsg === undefined) outMsg = []
                    return res.status(200).json(outMsg);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getSearchByOid", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/byoid"));
            }
        });

        this.api.get("/get/alltxs", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-alltxs");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getAll(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/alltxs"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAll", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/alltxs"));
            }
        });

        this.api.get("/get/blocked", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-blocked");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getAllBlock(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/blocked"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAllBlock", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/blocked"));
            }
        });

        this.api.get("/get/pooling", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-pooling");
            if (acore.m !== undefined) {
                acore.m.lib.getAllPool(acore.m, req.body).then((data) => {
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/pooling"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAllPool", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/pooling"));
            }
        });

        this.api.get("/get/history/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:get-histrory");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getHistoryByOid(acore.m, req.params.oid, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/history"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getHistoryByOid", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/history"));
            }
        });

        this.api.post("/post/byjson", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:post-byjson");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.postByJson(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/post/byjson"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postByJson", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/post/byjson"));
            }
        });
        
        return this.userOK<express.Express>(this.api);
    }

    /**
     * Listen the port to accept calls of REST-like APIs
     * @param acore - set ccApiType
     * @param api - set express.Express that can be get in the initialization process
     * @returns - returns no useful return value
     */
    public async listen(acore: ccApiType, api: express.Express): Promise<void> {
        const LOG = acore.log.lib.LogFunc(acore.log);
        api.listen(acore.conf.rest.userapi_port, () => {
            LOG("Info", 0, "UserApi:Listen");
        })
    
    }

    /**
     * Block any further API access 
     * @param acore - set ccApiType
     * @param api - set express.Express that can be get in the initialization process
     * @returns - returns no useful return value
     */
    public async shutdown(acore: ccApiType): Promise<gResult<void, unknown>> {
        const LOG = acore.log.lib.LogFunc(acore.log);
        LOG("Info", 0, "UserApi:shutdown");

        const errmsg: gError= { name: "Error", origin: { module: "listener", func: "shutdown", pos: "frontend", detail: "Shutdown is in progress." }, message: "Shutdown is in progress." }

        this.api.get("/get/byjson", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/byjson"));
        });
        this.api.get("/get/byoid/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/byoid/:oid(\\w{24})"));
        });
        this.api.get("/get/alltxs", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/alltxs"));
        });
        this.api.get("/get/blocked", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/blocked"));
        });
        this.api.get("/get/pooling", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/pooling"));
        });
        this.api.get("/get/history/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/history/:oid(\\w{24})"));
        });
        this.api.post("/post/byjson", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/post/byjson"));
        });

        let retry: number = 60;
        for await (const currentrun of setInterval(1000, this.runcounter, undefined)) {
            if (currentrun === 0) {
                return this.userOK<void>(undefined);
            } else {
                LOG("Notice", 0, "UserApi:some APIs are still running.");
                retry--;
            }
            if (retry === 0) {
                LOG("Warning", 0, "UserApi:gave up all APIs to terminate.");
            }
        }

        return this.userOK<void>(undefined);
    }

}
