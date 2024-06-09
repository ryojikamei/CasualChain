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
 * Provide Administration APIs.
 */
export class ListnerV3AdminApi {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected adminOK<T>(response: T): gResult<T, never> {
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
    protected adminError(module: string, func: string, pos?: string, message?: string): gResult<never, gError> {
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
        LOG("Info", 0, "AdminApi:init");

        this.api.use(express.json({ limit: '16777216b' }));
        this.api.use(express.urlencoded({ extended: true, limit: '16777216b' }));
        const authUser = acore.conf.rest.adminapi_user;
        const authPassword = acore.conf.rest.adminapi_password;
        this.api.use(basicAuth({users: {[authUser]:authPassword}, unauthorizedResponse: this.getUnauthorizedResponse}));

        this.api.post("/sys/deliverpooling", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-deliverpooling");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postDeliveryPool(acore.s).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/deliverpooling"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postDeliveryPool", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/deliverpooling"));
            }
        });

        this.api.post("/sys/blocking", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-blocking");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postAppendBlocks(acore.s).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/blocking"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "System Module is currently down");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postAppendBlocks", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/blocking"));
            }
        });

        this.api.post("/sys/initbc", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-initbc");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postGenesisBlock(acore.s, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/initbc"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postGenesisBlock", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/initbc"));
            }
        });

        this.api.post("/sys/syncblocked", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-syncblocked");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postScanAndFixBlock(acore.s, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/syncblocked"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postScanAndFixBlock", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncblocked"));
            }
        });

        this.api.post("/sys/syncpooling", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-syncpooling");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postScanAndFixPool(acore.s, req.body).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/syncpooling"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postScanAndFixPool", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncpooling"));
            }
        });

        this.api.get("/sys/getconf", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-getconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const ret = acore.c.lib.getConfiguration(acore.c, undefined, req.body);
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/getconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", 1, "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
            }
        })

        this.api.get("/sys/getconf/:module", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-getconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const ret = acore.c.lib.getConfiguration(acore.c, req.params.module, req.body);
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/getconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", 1, "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
            }
        })

        this.api.post("/sys/editconf", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-setconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const [key, value] = Object.entries(req.body)[0];
                const ret = acore.c.lib.setConfiguration(acore.c, key, String(value));
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/editconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", 1, "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "setConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/editconf"));
            }
        })

        this.api.post("/sys/resetconf", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-resetconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                acore.c.lib.reloadConfiguration().then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/resetconf"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "reloadConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/resetconf"));
            }
        })

        this.api.post("/sys/applyconf", (req: express.Request, res: express.Response) => {
            LOG("Info", 0, "Api:sys-applyconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                acore.c.lib.reloadConfiguration().then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/applyconf"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", 1, "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "reloadConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/resetconf"));
            }
        })
        
        return this.adminOK<express.Express>(this.api);
    }

    /**
     * Listen the port to accept calls of REST-like APIs
     * @param acore - set ccApiType
     * @param api - set express.Express that can be get in the initialization process
     * @returns - returns no useful return value
     */
    public async listen(acore: ccApiType, api: express.Express): Promise<void> {
        const LOG = acore.log.lib.LogFunc(acore.log);
        api.listen(acore.conf.rest.adminapi_port, () => {
            LOG("Info", 0, "AdminApi:Listen");
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
        LOG("Info", 0, "AdminApi:shutdown");

        const errmsg: gError= { name: "Error", origin: { module: "listener", func: "shutdown", pos: "frontend", detail: "Shutdown is in progress." }, message: "Shutdown is in progress." }

        this.api.post("/sys/deliverpooling", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/deliverpooling"));
        });
        this.api.post("/sys/blocking", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/blocking"));
        });
        this.api.post("/sys/initbc", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/initbc"));
        });
        this.api.post("/sys/syncblocked", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncblocked"));
        });
        this.api.post("/sys/syncpooling", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncpooling"));
        });
        this.api.get("/sys/getconf", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
        });
        this.api.get("/sys/getconf/:prop", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
        });
        this.api.post("/sys/editonf", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/editconf"));
        });
        this.api.post("/sys/resetconf", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/resetconf"));
        });

        let retry: number = 60;
        for await (const currentrun of setInterval(1000, this.runcounter, undefined)) {
            if (currentrun === 0) {
                return this.adminOK<void>(undefined);
            } else {
                LOG("Notice", 0, "AdminApi:some APIs are still running.");
                retry--;
            }
            if (retry === 0) {
                LOG("Warning", 0, "AdminApi:gave up all APIs to terminate.");
            }
        }

        return this.adminOK<void>(undefined);
    }

}
