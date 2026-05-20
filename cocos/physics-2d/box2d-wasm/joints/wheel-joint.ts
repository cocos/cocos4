/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

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

import { B2 } from '../instantiated';
import { IWheelJoint } from '../../spec/i-physics-joint';
import { WheelJoint2D } from '../../framework';
import { B2Joint } from './joint-2d';
import { toRadian } from '../../../core';

/** @mangle */
export class B2WheelJoint extends B2Joint implements IWheelJoint {
    setFrequency (v: number): void {
        if (this._b2joint) {
            (this._b2joint as B2.WheelJoint as any).SetSpringFrequencyHz(v);
        }
    }
    setDampingRatio (v: number): void {
        if (this._b2joint) {
            (this._b2joint as B2.WheelJoint as any).SetSpringDampingRatio(v);
        }
    }

    // motor
    enableMotor (v: boolean): void {
        if (this._b2joint) {
            (this._b2joint as B2.WheelJoint).EnableMotor(v);
        }
    }
    setMaxMotorTorque (v: number): void {
        if (this._b2joint) {
            (this._b2joint as B2.WheelJoint).SetMaxMotorTorque(v);
        }
    }
    setMotorSpeed (v: number): void {
        if (this._b2joint) {
            (this._b2joint as B2.WheelJoint).SetMotorSpeed(v);
        }
    }

    _createJointDef (): any {
        const comp = this._jointComp as WheelJoint2D;
        const def = new B2.WheelJointDef();
        const localAnchorA = this._getLocalAnchorA();
        const localAnchorB = this._getLocalAnchorB();
        def.localAnchorA = { x: localAnchorA.x, y: localAnchorA.y };
        def.localAnchorB = { x: localAnchorB.x, y: localAnchorB.y };
        const angle = toRadian(comp.angle);
        def.localAxisA = { x: Math.cos(angle), y: Math.sin(angle) };
        def.maxMotorTorque = comp.maxMotorTorque;
        def.motorSpeed = toRadian(comp.motorSpeed);
        def.enableMotor = comp.enableMotor;
        def.dampingRatio = comp.dampingRatio;
        def.frequencyHz = comp.frequency;
        return def;
    }
}
