/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { setInterval } from "timers/promises";
import { randomInt } from "crypto";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { eventConfigType } from "../config";
import { ccLogType } from "../logger";
import { internalEventFormat, ccEventType } from ".";
import { ccType, moduleCondition } from "../index.js";


/**
 * EventModule, simple timer for execution of methods or functions non-preemptively, so far.
 */
export class EventModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected eOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected eError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("event", func, pos, message));
    }

    /**
     * Variable common to each class for setting the module condition
     */
    protected coreCondition: moduleCondition = "unloaded";
    /**
     * Return current condition of the module
     * @returns returns a word that represent the condition of the module
     */
    public getCondition(): moduleCondition {
        return this.coreCondition;
    }
    /**
     * Overwrite the condition of the module
     * @param condition - set a word that represent the condition of the module
     */
    public setCondition(condition: moduleCondition): void {
        this.coreCondition = condition;
    }

    protected eventQueue: { internal: internalEventFormat[] }

    protected runcounter: number

    constructor() {
        this.eventQueue = { internal: [] };
        this.runcounter = 0;
    }

    /**
     * Initialize the EventModule
     * @param conf - set eventConfigType instance
     * @param log - set ccLogType instance
     * @param timerRunOnce - can set true when timer needs to stop after kicking the one task. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccEventType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public init(conf: eventConfigType, log: ccLogType, timerRunOnce?: boolean): gResult<ccEventType, unknown> {

        this.coreCondition = "loading";
        let core: ccEventType = {
            lib: new EventModule(),
            eventLoopIsActive: false,
            conf: conf,
            log: log,
            w: undefined
        }


        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:init");

        // asynchronus
        this.eventLoop(core, timerRunOnce);

        this.coreCondition = "initialized";
        core.lib.coreCondition = this.coreCondition;
        return this.eOK<ccEventType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccEventType instance
     * @param log - set ccLogType instance
     * @param w - set ccType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccEventType if it's success, and gError if it's failure.
     */
    public async restart(core: ccEventType, log: ccLogType, w: ccType): Promise<gResult<ccEventType, gError>> {
        const LOG = log.lib.LogFunc(log);
        LOG("Info", 0, "EventModule:restart");

        this.coreCondition = "unloaded";
        core.w?.s.lib.unregisterAutoTasks(core.w.s);
        const ret1 = this.init(core.conf, log);
        if (ret1.isFailure()) { return this.eError("restart", "init", "unknown error") };
        const newCore : ccEventType= ret1.value;
        // reconnect
        newCore.w = w;

        core.w?.s.lib.registerAutoTasks(core.w.s);
        this.coreCondition = "active";
        newCore.lib.coreCondition = this.coreCondition;
        return this.eOK(newCore);
    }

    /**
     * Register internal events, mainly for kicking blocking and health check tasks
     * @param core - set ccEventType instance
     * @param event - set a event with internalEventFormat
     * @param timerRunOnce - can set true when timer needs to stop after kicking the one task. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains eventId string if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public registerInternalEvent(core: ccEventType, event: internalEventFormat, timerRunOnce?: boolean): gResult<string, unknown> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:registerInternalEvent");

        core.lib.eventQueue.internal.push(event);
        LOG("Debug", 0, "DsModule:registerInternalEvent:list: " + JSON.stringify(core.lib.eventQueue.internal));

        // resume from unknown stop
        if (core.eventLoopIsActive === false) {
            core.lib.eventLoop(core, timerRunOnce);
        }

        return this.eOK<string>(event.eventId);
    }

    /**
     * Unregister internal events and wait for all events to finish
     * @param core - set ccEventType instance
     * @returns returns no useful values
     */
    public async unregisterAllInternalEvents(core: ccEventType): Promise<gResult<void, unknown>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:unregisterAllInternalEvents");

        core.lib.eventQueue.internal = [];

        let retry: number = 60;
        for await (const currentrun of setInterval(1000, this.runcounter, undefined)) {
            if (currentrun === 0) {
                return this.eOK<void>(undefined);
            } else {
                LOG("Notice", 0, "EventModule:some events are still running.");
                retry--;
            }
            if (retry === 0) {
                LOG("Warning", 0, "UserApi:gave up all events to finish.");
            }
        }
        return this.eOK<void>(undefined);
    }

    /**
     * Get the result of a run task
     * @param core - set ccEventType instance
     * @param eventId - set the eventId to get
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with internalEventFormat if it's success, and gError if it's failure.
     */
    public async getResult(core: ccEventType, eventId: string): Promise<gResult<internalEventFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:getResult for " + eventId);
        let ret: gResult<internalEventFormat, gError>;

        for (const event of core.lib.eventQueue.internal) {
            if (event.eventId === eventId) {
                try {
                    for await(const current of setInterval(500, event)) {
                        if (current.status === "done") {
                            return this.eOK<internalEventFormat>(current);
                        }
                    }
                } catch (error) {
                }
                return this.eError("getResult", "current_status", "unknown error");
            }
        }
        return this.eError("getResult", "eventQueue", "the eventId:" + eventId + " is not found.");
    }

    /**
     * Run a specified method in the system
     * @param core - set ccEventType instance
     * @param method - set one method name which is supported in this method
     * @param args - set arguments for the method
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result if it's success, and gError if it's failure.
     */
    private async runInternalMethod(core: ccEventType, method: string, args: string[]): Promise<gResult<any, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:runMethod");

        if (core.w === undefined) return this.eError("The cc module is down. It may be a bug.")

        switch (method) {
            case ("w.s.lib.postScanAndFixBlock"):
                return await core.w.s.lib.postScanAndFixBlock(core.w.s);
            case ("w.s.lib.postScanAndFixPool"):
                return await core.w.s.lib.postScanAndFixPool(core.w.s);
            case ("w.s.lib.postDeliveryPool"):
                return await core.w.s.lib.postDeliveryPool(core.w.s);
            case ("w.s.lib.postAppendBlocks"):
                return await core.w.s.lib.postAppendBlocks(core.w.s);
            default:
                return this.eError("Unknown method is called.");
        }
    }

    /**
     * The event loop
     * @param core - set ccEventType instance
     * @param exitOnExhausted - can set true if it should be exit when the queue becames empty
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    protected async eventLoop(core: ccEventType, exitOnExhausted?: boolean): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "EventModule:eventLoop started");

        try {
            core.eventLoopIsActive = true;
            for await (const eventQ of setInterval(1000, core.lib.eventQueue)) {
                for (let event of eventQ.internal) {
                    const currentTimeMs = new Date().valueOf();
                    if ((event.nextExecuteTimeMs === undefined) || 
                    ((event.nextExecuteTimeMs !== undefined) && (currentTimeMs >= event.nextExecuteTimeMs))) {
                        LOG("Info", 0, "EventModule:eventLoop:It's time to run " + event.methodPath);
                        try {
                            event.status = "run";
                            this.runcounter++;
                            event.executionResult = await core.lib.runInternalMethod(core, event.methodPath, event.methodArgs)
                            this.runcounter--;
                            event.status = "done";
                        } catch (error: any) {
                            this.runcounter--;
                            event.status = "error";
                            event.executionResult = this.eError("eventLoop", "method", error.toString());
                            LOG("Info", 0, "EventModule:eventLoop:registered internal method " + event.methodPath + " cannot be run properly:" + JSON.stringify(event.executionResult));
                        }
                        event.nextExecuteTimeMs = currentTimeMs + event.minIntervalMs + randomInt(0, 60000);
                    }
                }
                // for testing
                if (exitOnExhausted === true) {
                    core.eventLoopIsActive = false;
                    return this.eOK<void>(undefined);
                }
            }
        } catch (error: any) {
            core.eventLoopIsActive = false;
            return this.eError("eventLoop", "stopped", error.toString());
        }
        core.eventLoopIsActive = false;
        return this.eError("eventLoop", "exited", "unknown deactivate of the eventLoop");
    }

}
