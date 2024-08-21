import { gResult, gSuccess, gFailure, gError } from "../utils";
import { ccEventType } from "../event";
import { ccLogType } from "../logger";
import { ccType } from "..";
import { internalEventFormat } from "../event";
import { randomUUID } from "crypto";

export function eOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

export function eError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("system", func, pos, message));
}

export class EventModuleMock {

    public init(): gResult<any, gError> {
        return eOK({
            lib: {
                async restart(core: ccEventType, log: ccLogType, w: ccType): Promise<gResult<ccEventType, gError>> {
                    return eOK(core)
                },
                registerInternalEvent(core: ccEventType, event: internalEventFormat, timerRunOnce?: boolean): gResult<string, unknown> {
                    return eOK<string>(event.eventId);
                },
                async unregisterAllInternalEvents(core: ccEventType): Promise<gResult<void, unknown>> {
                    return eOK<void>(undefined);
                },
                async getResult(core: ccEventType, eventId: string): Promise<gResult<internalEventFormat, gError>> {
                    const current: any = { eventId: randomUUID(), status: "done" };
                    return eOK<internalEventFormat>(current);0
                },
                async runInternalMethod(core: ccEventType, method: string, args: string[]): Promise<gResult<any, gError>> {
                    return eOK<boolean>(true);
                },
                async eventLoop(core: ccEventType, exitOnExhausted?: boolean): Promise<gResult<void, gError>> {
                    return eError("eventLoop", "exited", "unknown deactivate of the eventLoop");
                }
            }
        })
    }
}