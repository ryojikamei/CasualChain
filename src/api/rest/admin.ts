/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import express from "express";
import helmet from "helmet";

import { setInterval } from "timers/promises";
import { Server } from "http";

import { gResult, gSuccess, gFailure, gError } from "../../utils.js";

import { ccApiType } from "../index.js";
import { postCloseParcelInputSchema, postGenesisBlockInputSchema, postOpenParcelInputSchema, postScanAndFixInputSchema } from "../../system/zod.js";
import { editConfigurationInputSchema, getConfigurationInputSchema } from "../../config/zod.js";
import { SafeParseReturnType, ZodSchema } from "zod";

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

    private parseBody(body: any, schema: ZodSchema): gResult<any, gError> {
        if (body === undefined) { return this.adminOK(undefined); }
        try {
            return this.adminOK(schema.parse(body));
        } catch (error: any) {
            return this.adminError("Rest", "adminApi", "parseBody", JSON.stringify(error.issues));
        }
    }

    /**
     * Register API authentication and endpoints
     * @param acore - set ccApiType instance
     * @returns returns with gResult type that contains express.Express if it's success, and unknown if it's failure.
     */
    public async init(acore: ccApiType): Promise<gResult<express.Express, unknown>> {
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "admin");
        LOG("Info", "start");

        this.api.use(express.json({ limit: '16777216b' }));
        this.api.use(express.urlencoded({ extended: true, limit: '16777216b' }));
        const authUser = acore.conf.rest.adminapi_user;
        const authPassword = acore.conf.rest.adminapi_password;
        this.api.use(helmet({ strictTransportSecurity: false }));

        const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
            let token = "";
            if ((req.headers.authorization !== undefined) && (req.headers.authorization.split(" ")[0] === "Bearer")) {
                token = req.headers.authorization.split(" ")[1];
            } else {
                return next("No token is specified");
            }
            if (acore.k === undefined) { return next("Keyring Module is currently down."); }
            const ret = acore.k.lib.verifyWithPaseto(acore.k, token);
            if (ret.isFailure()) {
                return next(ret.value)
            } else {
                LOG("Info", "The authorization of " + authUser + " for administation APIs is successful.")
                next();
            }
        }
            
        this.api.post("/sys/login", (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-login");

            if ((req.body.user !== authUser) || (req.body.password !== authPassword)) {
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "signWithPaseto", pos: "frontend", detail: "Invalid user or password."}, message: "Invalid user or password." }
                return res.status(403).json(this.craftErrorResponse(errmsg, "/sys/login"));
            }
            if (acore.k !== undefined) {
                this.runcounter++;
                const target = { user: authUser, password: authPassword }
                const ret = acore.k.lib.signWithPaseto(acore.k, target);
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/login"));
                } else {
                    return res.status(200).json(ret.value);
                }
            } else {
                LOG("Warning", "Keyring Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "signWithPaseto", pos: "frontend", detail: "Keyring Module is currently down." }, message: "Keyring Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/login"));
            }
        })
                        
        this.api.post("/sys/deliverpooling", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-deliverpooling");
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
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postDeliveryPool", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/deliverpooling"));
            }
        });

        this.api.post("/sys/blocking", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-blocking");
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
                LOG("Warning", "System Module is currently down");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postAppendBlocks", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/blocking"));
            }
        });

        this.api.post("/sys/initbc", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-initbc");
            if (acore.s !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, postGenesisBlockInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/initbc"));
                }
                acore.s.lib.postGenesisBlock(acore.s, parseResult.value).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/initbc"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postGenesisBlock", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/initbc"));
            }
        });

        this.api.post("/sys/syncblocked", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-syncblocked");
            if (acore.s !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, postScanAndFixInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/syncblocked"));
                }
                acore.s.lib.postScanAndFixBlock(acore.s, parseResult.value).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/syncblocked"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postScanAndFixBlock", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncblocked"));
            }
        });

        this.api.post("/sys/syncpooling", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-syncpooling");
            if (acore.s !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, postScanAndFixInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/syncpooling"));
                }
                acore.s.lib.postScanAndFixPool(acore.s, parseResult.value).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/syncpooling"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postScanAndFixPool", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/syncpooling"));
            }
        });

        this.api.get("/sys/getconf", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-getconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, getConfigurationInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/getconf"));
                }
                const ret = acore.c.lib.getConfiguration(undefined, parseResult.value);
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/getconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
            }
        })

        this.api.get("/sys/getconf/:module", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-getconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, getConfigurationInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/getconf"));
                }
                const ret = acore.c.lib.getConfiguration(req.params.module, parseResult.value);
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/getconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "getConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/getconf"));
            }
        })

        this.api.post("/sys/editconf", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-setconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, editConfigurationInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/editconf"));
                }
                const [key, value] = Object.entries(parseResult.value)[0];
                const ret = acore.c.lib.setConfiguration(key, String(value));
                this.runcounter--;
                if (ret.isFailure()) {
                    return res.status(503).json(this.craftErrorResponse(ret.value, "/sys/editconf"));
                }
                return res.status(200).json(ret.value);
            } else {
                LOG("Warning", "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "setConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/editconf"));
            }
        })

        this.api.post("/sys/resetconf", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-resetconf");
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
                LOG("Warning", "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "reloadConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/resetconf"));
            }
        })

        this.api.post("/sys/applyconf", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-applyconf");
            if (acore.c !== undefined) {
                this.runcounter++;
                acore.c.lib.applyConfiguration();
                this.runcounter--;
                return res.status(200).json(undefined);
            } else {
                LOG("Warning", "Config Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "reloadConfiguration", pos: "frontend", detail: "Config Module is currently down." }, message: "Config Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/resetconf"));
            }
        })
        
        this.api.post("/sys/opentenant", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-opentenant");
            if (acore.s !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, postOpenParcelInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/opentenant"));
                }
                acore.s.lib.postOpenParcel(acore.s, parseResult.value).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/opentenant"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postOpenParcel", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/opentenant"));
            }
        });

        this.api.post("/sys/closetenant", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-closetenant");
            if (acore.s !== undefined) {
                this.runcounter++;
                const parseResult = this.parseBody(req.body, postCloseParcelInputSchema);
                if (parseResult.isFailure()) {
                    this.runcounter--;
                    return res.status(400).json(this.craftErrorResponse(parseResult.value, "/sys/closetenant"));
                }
                acore.s.lib.postCloseParcel(acore.s, parseResult.value).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/closetenant"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postCloseParcel", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/closetenant"));
            }
        });

        this.api.post("/sys/synccache", auth, (req: express.Request, res: express.Response) => {
            LOG("Info", "sys-synccache");
            if (acore.s !== undefined) {
                this.runcounter++;
                acore.s.lib.postSyncCaches(acore.s).then((data) => {
                    this.runcounter--;
                    if (data.isFailure()) {
                        return res.status(503).json(this.craftErrorResponse(data.value, "/sys/synccache"));
                    }
                    return res.status(200).json(data.value);
                })
            } else {
                LOG("Warning", "System Module is currently down.");
                const errmsg: gError = { name: "Error", origin: { module: "listener", func: "postSyncCaches", pos: "frontend", detail: "System Module is currently down." }, message: "System Module is currently down." }
                return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/synccache"));
            }
        });

        return this.adminOK<express.Express>(this.api);
    }

    /**
     * Listen the port to accept calls of REST-like APIs
     * @param acore - set ccApiType
     * @param api - set express.Express that can be get in the initialization process
     * @returns - returns the port number listening
     */
    public async listen(acore: ccApiType, api: express.Express): Promise<void> {
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "admin:listen");
        this.server = api.listen(acore.conf.rest.adminapi_port, () => {
            this.runningPort = acore.conf.rest.adminapi_port;
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
        const LOG = acore.log.lib.LogFunc(acore.log, "Rest", "admin:shutdown");
        LOG("Info", "start");

        const errmsg: gError= { name: "Error", origin: { module: "listener", func: "shutdown", pos: "frontend", detail: "Shutdown is in progress." }, message: "Shutdown is in progress." }

        this.api.post("/sys/login", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/login"));
        });
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
        this.api.post("/sys/opentenant", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/opentenant"));
        });
        this.api.post("/sys/closetenant", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/closetenant"));
        });
        this.api.post("/sys/synccache", (req: express.Request, res: express.Response) => {
            return res.status(503).json(this.craftErrorResponse(errmsg, "/sys/synccache"));
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
        return this.adminOK<void>(undefined);
    }

}
