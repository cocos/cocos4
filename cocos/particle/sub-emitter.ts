/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { ccclass, displayName, editable, range, serializable, type } from 'cc.decorator';
import { CCFloat, CCInteger, Enum } from '../core';
import { Node } from '../scene-graph/node';

export enum SubEmitterEvent {
    Birth,
    Death,
    Collision,
}
Enum(SubEmitterEvent);

@ccclass('cc.SubEmitter')
export class SubEmitter {
    /** Node containing the target CPU particle system. */
    @type(Node)
    @editable
    @displayName('Target Node')
    @serializable
    public emitter: Node | null = null;

    @type(SubEmitterEvent)
    @editable
    @displayName('Trigger Event')
    @serializable
    public event = SubEmitterEvent.Birth;

    @type(CCInteger)
    @editable
    @range([0, Number.POSITIVE_INFINITY, 1])
    @serializable
    public count = 1;

    /** Chance of emitting the whole burst for one matching parent event. */
    @type(CCFloat)
    @editable
    @range([0, 1, 0.01])
    @serializable
    public triggerProbability = 1;
}
