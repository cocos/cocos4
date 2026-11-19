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

import { ccclass, displayOrder, range, serializable, tooltip, type } from 'cc.decorator';
import { Mat4, Vec3 } from '../../core';
import { ParticleSpace } from '../enum';
import { Particle, ParticleModuleBase, PARTICLE_MODULE_NAME } from '../particle';

/** CPU-only spherical force field. Positive strength repels; negative strength attracts. */
@ccclass('cc.ForceFieldModule')
export class ForceFieldModule extends ParticleModuleBase {
    @serializable
    private _enable = false;

    @displayOrder(0)
    public get enable (): boolean { return this._enable; }
    public set enable (value: boolean) {
        if (this._enable === value) return;
        this._enable = value;
        this.target?.enableModule(this.name, value, this);
    }

    @type(ParticleSpace)
    @serializable
    @tooltip('i18n:forceFieldModule.space')
    public space = ParticleSpace.Local;

    @serializable
    @tooltip('i18n:forceFieldModule.center')
    public center = new Vec3();

    @serializable
    @range([0, Number.POSITIVE_INFINITY, 0.1])
    @tooltip('i18n:forceFieldModule.radius')
    public radius = 5;

    @serializable
    @tooltip('i18n:forceFieldModule.strength')
    public strength = 1;

    @serializable
    @range([0, Number.POSITIVE_INFINITY, 0.1])
    @tooltip('i18n:forceFieldModule.falloff')
    public falloff = 1;

    public name = PARTICLE_MODULE_NAME.FORCE_FIELD;
    public needUpdate = true;
    private _toField = new Mat4();
    private _toSimulation = new Mat4();
    private _offset = new Vec3();
    private _transform = false;
    private _valid = true;

    /** Convert positions and accelerations using the particle simulation transform. */
    public update (space: number, worldTransform: Mat4): void {
        this._transform = space !== this.space;
        this._valid = true;
        if (!this._transform) return;
        // Collapsed transforms cannot be inverted.
        this._valid = Math.abs(Mat4.determinant(worldTransform)) > 1e-12;
        if (!this._valid) return;
        if (space === ParticleSpace.World) {
            Mat4.copy(this._toSimulation, worldTransform);
            Mat4.invert(this._toField, worldTransform);
        } else {
            Mat4.copy(this._toField, worldTransform);
            Mat4.invert(this._toSimulation, worldTransform);
        }
    }

    public animate (p: Particle, dt: number): void {
        if (!this._enable || !this._valid || this.radius <= 0 || this.strength === 0) return;
        const offset = this._offset;
        if (this._transform) {
            Vec3.transformMat4(offset, p.position, this._toField);
        } else {
            Vec3.copy(offset, p.position);
        }
        Vec3.subtract(offset, offset, this.center);
        const distance = offset.length();
        if (distance <= 1e-8 || distance >= this.radius) return;
        const attenuation = Math.pow(1 - distance / this.radius, Math.max(0, this.falloff));
        Vec3.multiplyScalar(offset, offset, this.strength * attenuation / distance);
        if (this._transform) Vec3.transformMat4Normal(offset, offset, this._toSimulation);
        Vec3.scaleAndAdd(p.velocity, p.velocity, offset, dt);
        Vec3.copy(p.ultimateVelocity, p.velocity);
    }
}
