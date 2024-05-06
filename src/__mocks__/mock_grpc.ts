/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

export class Server {
    public mockLastCall: string;

    public ServerUnaryCall: any;

    constructor() {
        this.mockLastCall = "constructor";
    }

    public addService() {
        this.mockLastCall = "addService";
    }

    public bindAsync() {
        this.mockLastCall = "bindAsync";
    }

    public ServerCredentials = {
        createInsecure: () => { return 0 }
    };
}

export class ServerUnaryCall {
    public LastNum: number;
    public LastStr: string;
    public LastObj: object;
    constructor() {
        this.LastNum = 3;
        this.LastStr = "";
        this.LastObj = {};
    }
    public request: any = {
        getDataasstring() { return this.LastStr },
        getParam() {
            return {
                getRemovepool(): boolean {
                    return true
                },
                getFailifunhealthy(): boolean {
                    return true
                },
                getReturnundefinedifnoexistent(): boolean {
                    return true
                }
            }
        }
    }
}


export function sendUnaryData(error: any, value?: any, trailer?: any, flags?: any): any {
    if (value === undefined) {
        return error;
    } else {
        return value;
    }
}
