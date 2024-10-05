/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import express from "express";
import basicAuth from "express-basic-auth";
import clone from "clone";

import { setInterval } from "timers/promises";
import { Server } from "http";

import { gResult, gSuccess, gFailure, gError } from "../../utils.js";

import { ccApiType } from "../index.js";

/**
 * Provide User APIs.
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
     * Holding server
     */
    protected server: Server | undefined;

    /**
     * Holding port
     */
    protected runningPort: number;
    /**
     * Return the port number listening
     * @returns returns current listening port number
     */
    public getPort(): number { return this.runningPort };

    /**
     * Count the number of running APIs
     */
    protected runcounter: number;

    constructor() {
        this.api = express();
        this.runcounter = 0;
        this.runningPort = -1;
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
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "user");
        LOG("Info", "start");

        this.api.use(express.json({ limit: '16777216b' }));
        this.api.use(express.urlencoded({ extended: true, limit: '16777216b' }));
        const authUser = acore.conf.rest.userapi_user;
        const authPassword = acore.conf.rest.userapi_password;
        this.api.use(basicAuth({users: {[authUser]:authPassword}, unauthorizedResponse: this.getUnauthorizedResponse}));

        this.api.get("/get/byjson", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-byjson");
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
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getSearchByJson", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/getbyjson"));
            }
        });

        this.api.get("/get/byoid/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-byoid");
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
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getSearchByOid", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/byoid"));
            }
        });

        this.api.get("/get/alltxs", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-alltxs");
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
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAll", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/alltxs"));
            }
        });

        this.api.get("/get/blocked", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-blocked");
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
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAllBlock", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/blocked"));
            }
        });

        this.api.get("/get/pooling", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-pooling");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getAllPool(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/pooling"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAllPool", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/pooling"));
            }
        });

        this.api.get("/get/lastblock", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-lastblock");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getLastBlock(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/lastblock"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getLastBlock", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/lastblock"));
            }
        });

        this.api.get("/get/poolingdelivered", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-poolingdelivered");
            if (acore.m !== undefined) {
                this.runcounter++;
                acore.m.lib.getAllDeliveredPool(acore.m, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/poolingdelivered"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getAllDeliveredPool", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/poolingdelivered"));
            }
        });

        this.api.get("/get/totalnumber", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-totalnumber");
            if (acore.m !== undefined) {
                this.runcounter++;
                let opt = clone(req.body);
                opt.skippooling = true;
                acore.m.lib.getTransactionHeight(acore.m, opt).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/get/totalnumber"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getTransactionHeight", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/totalnumber"));
            }
        });

        this.api.get("/get/history/:oid(\\w{24})", (req: express.Request, res: express.Response) => {
            LOG("Info", "get-histrory");
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
                LOG("Warning", "Main Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getHistoryByOid", pos: "frontend", detail: "Main Module is currently down." }, message: "Main Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/get/history"));
            }
        });

        this.api.post("/post/byjson", (req: express.Request, res: express.Response) => {
            LOG("Info", "post-byjson");
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
                LOG("Warning", "Main Module is currently down.");
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
     * @returns - returns the port number listening
     */
    public async listen(acore: ccApiType, api: express.Express): Promise<void> {
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "user:listen");
        this.server = api.listen(acore.conf.rest.userapi_port, () => {
            this.runningPort = acore.conf.rest.userapi_port;
            LOG("Info", "start");
        })
    }

    /**
     * Block any further API access 
     * @param acore - set ccApiType
     * @param api - set express.Express that can be get in the initialization process
     * @returns - returns no useful return value
     */
    public async shutdown(acore: ccApiType): Promise<gResult<void, unknown>> {
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "user:shutdown");
        LOG("Info", "start");

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
        this.api.get("/get/lastblock", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/lastblock"));
        });
        this.api.get("/get/poolingdelivered", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/poolingdelivered"));
        });
        this.api.get("/get/totalnumber", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/get/totalnumber"));
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
                break;
            } else {
                LOG("Notice", "some APIs are still running.");
                retry--;
            }
            if (retry === 0) {
                LOG("Warning", "gave up all APIs to terminate.");
            }
        }

        this.server?.close(() => { this.runningPort = -1; });
        return this.userOK<void>(undefined);
    }

}
