/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import axios from "axios";

export type responseType = {
    code: number,
    data: any,
    message: string,
    errormsg: string
}

export async function runAxios(cmd: string, method: string, bcapi: any, payload?: string, nodeNo?: number): Promise<responseType> {
    let baseURL: string
    let username: string
    let password: string
    if (cmd.startsWith("/sys/") === false) {
        switch (nodeNo) {
            case 2:
                baseURL = "http://" + bcapi.node2.host + ":" + bcapi.node2.userapi_port.toString();
                username = bcapi.node2.userapi_user;
                password = bcapi.node2.userapi_password;
                break;
            default:
                baseURL = "http://" + bcapi.node1.host + ":" + bcapi.node1.userapi_port.toString();
                username = bcapi.node1.userapi_user;
                password = bcapi.node1.userapi_password;
                break;
        }
    } else {
        switch (nodeNo) {
            case 2:
                baseURL = "http://" + bcapi.node2.host + ":" + bcapi.node2.adminapi_port.toString();
                username = bcapi.node2.adminapi_user;
                password = bcapi.node2.adminapi_password;
                break;
            default:
                baseURL = "http://" + bcapi.node1.host + ":" + bcapi.node1.adminapi_port.toString();
                username = bcapi.node1.adminapi_user;
                password = bcapi.node1.adminapi_password;
                break;
        }
    }
    
    let ret: responseType = {
        code: -1,
        data: "",
        message: "",
        errormsg: ""
    };
    let data: any = undefined;
    if (payload !== undefined) data = payload;
    await axios(cmd, {
        method: method,
        baseURL: baseURL,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        auth: {
            username: username,
            password: password
        },
        data: data
    })
    .then((onfullfilled) => {
        ret.code = onfullfilled.status;
        ret.data = onfullfilled.data;
    },(onrejected) => {
        if(onrejected.response) {
            ret.code = onrejected.response.status;
            ret.data = onrejected.response.data;
        } else {
            ret.code = -1;
        }

        ret.message = onrejected.code;
        ret.errormsg = onrejected.message;
    })

    return ret;
}