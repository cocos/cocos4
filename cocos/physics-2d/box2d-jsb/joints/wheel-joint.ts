/*
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.

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
import { IWheelJoint } from '../../spec/i-physics-joint';
import { WheelJoint2D } from '../../framework';
import { b2Joint } from './joint-2d';
import { toRadian } from '../../../core';

export class b2WheelJoint extends b2Joint implements IWheelJoint {
    setDampingRatio (v: number): void {
        if (this._b2joint) {
            (this._b2joint as b2jsb.WheelJoint).SetSpringDampingRatio(v);
        }
    }
    setFrequency (v: number): void {
        if (this._b2joint) {
            (this._b2joint as b2jsb.WheelJoint).SetSpringFrequencyHz(v);
        }
    }

    // motor
    enableMotor (v: boolean): void {
        if (this._b2joint) {
            (this._b2joint as b2jsb.WheelJoint).EnableMotor(v);
        }
    }
    setMaxMotorTorque (v: number): void {
        if (this._b2joint) {
            (this._b2joint as b2jsb.WheelJoint).SetMaxMotorTorque(v);
        }
    }
    setMotorSpeed (v: number): void {
        if (this._b2joint) {
            (this._b2joint as b2jsb.WheelJoint).SetMotorSpeed(v);
        }
    }

    _createJointDef (): any {
        const comp = this._jointComp as WheelJoint2D;
        const def = new b2jsb.WheelJointDef();
        const anchorA = this._getAnchorA();
        const anchorB = this._getAnchorB();
        def.localAnchorA = { x: anchorA.x, y: anchorA.y };
        def.localAnchorB = { x: anchorB.x, y: anchorB.y };
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
