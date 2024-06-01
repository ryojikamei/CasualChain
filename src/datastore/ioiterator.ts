/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { FindCursor, WithId, Document } from "mongodb";

/**
 * The cachedIoIterator implementation that treats an array like a general DB cursor
 */
export class cachedIoIterator<T extends object> {
    private array: Array<T>;
    private pos: number;
    private max: number;
    private outputSizeMax: number | undefined;
    private outputSizeCurrent: number;

    /**
     * The constructor of cachedIoIterator
     * @param array - set the target array with type T
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @param constrainedSize - can set the maximum output size. When the set number is exceeded, this will force the return of the termination status
     */
    constructor(array: Array<T>, __t?: string, constrainedSize?: number) {
        this.outputSizeMax = constrainedSize;
        this.outputSizeCurrent = 0;
        if (__t !== undefined) {
            this.array = array.filter((tx: any) => {
                return tx.tenant.toString() === __t
            });
        } else {
            this.array = array;
        }
        this.pos = 0;
        this.max = this.array.length - 1;
    }

    /**
     * Return the next data. When the last data is retrieved, done is true.
     * If more data is retrieved after the last data has been retrieved, the value will be undefined.
     * @returns returns the set of value and done. Done is true when the last data is retrieved
     */
    public async next(): Promise<IteratorResult<T | undefined>> {
        if (this.max < 0) { return { value: undefined, done: true }};
        if (this.pos > this.max) { return { value: undefined, done: true }};

        const doc: any = this.array[this.pos];
        if (this.pos === this.max) { 
            this.pos++;
            return { value: doc, done: true };
        };
        if (this.outputSizeMax === undefined) {
            this.pos++;
            return { value: doc, done: false };
        } else {
            if (doc.hasOwnProperty("data") === true) {
                this.outputSizeCurrent = this.outputSizeCurrent + Buffer.from(JSON.stringify(doc.data)).length;
                if (this.outputSizeCurrent > this.outputSizeMax) {
                    return { value: undefined, done: true };
                } else {
                    this.pos++;
                    return { value: doc, done: false };
                }
            } else {
                this.pos++;
                return { value: doc, done: false };
            }
        }
    }
    
    public async toArray(): Promise<Array<T>> {
        return this.array;
    }

    public async *[Symbol.asyncIterator](): AsyncIterator<IteratorResult<T | undefined>> {
        while (true) {
            const ret = await this.next();
            if (ret.value === undefined) break;
            yield ret;
        }
    }
}

/**
 * The directIoIterator implementation that treats DB result's output directly
 */
export class directIoIterator<T extends object> {
    private cursor: FindCursor<WithId<Document>>;
    private outputSizeMax: number | undefined;
    private outputSizeCurrent: number;

    constructor(asyncIterator: FindCursor<WithId<Document>>, constrainedSize?: number) {
        this.cursor = asyncIterator;
        this.outputSizeMax = constrainedSize;
        this.outputSizeCurrent = 0;
    }

    public async next(): Promise<IteratorResult<T | undefined>> {
        if (await this.cursor.hasNext() === false) {
            return { value: undefined, done: true };
        }

        const doc: any = await this.cursor.next();
        if (this.outputSizeMax === undefined) {
            if (await this.cursor.hasNext() === false) {
                return { value: doc, done: true };
            } else {
                return { value: doc, done: false };
            }
        } else {
            if (doc.hasOwnProperty("data") === true) {
                this.outputSizeCurrent = this.outputSizeCurrent + Buffer.from(JSON.stringify(doc.data)).length;
                if (this.outputSizeCurrent > this.outputSizeMax) {
                    return { value: undefined, done: true };
                } else {
                    if (await this.cursor.hasNext() === false) {
                        return { value: doc, done: true };
                    } else {
                        return { value: doc, done: false };
                    }
                }
            } else {
                if (await this.cursor.hasNext() === false) {
                    return { value: doc, done: true };
                } else {
                    return { value: doc, done: false };
                }
            }
        }
    }

    public async toArray(): Promise<WithId<Document>[]> {
        const arr: any = await this.cursor.toArray()
        return arr;
    }

    public async *[Symbol.asyncIterator](): AsyncIterator<IteratorResult<T | undefined>> {
        while (true) {
            const ret = await this.next();
            if (ret.value === undefined) break;
            yield ret;
        }
    }

}