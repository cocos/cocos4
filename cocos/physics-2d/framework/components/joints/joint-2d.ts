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

import { EDITOR_NOT_IN_PREVIEW } from 'internal:constants';
import { Vec2, _decorator, tooltip, serializable } from '../../../../core';
import { RigidBody2D } from '../rigid-body-2d';
import { IJoint2D } from '../../../spec/i-physics-joint';
import { EJoint2DType, PHYSICS_2D_PTM_RATIO } from '../../physics-types';
import { createJoint } from '../../physics-selector';
import { Component } from '../../../../scene-graph';

const { ccclass, type } = _decorator;

@ccclass('cc.Joint2D')
export class Joint2D extends Component {
    /**
     * @en
     * All registered 2D joints.
     * @zh
     * 所有已注册的 2D 关节。
     */
    static readonly joints: Joint2D[] = [];

    /**
     * @en
     * The position of Joint2D in the attached rigid body's local space.
     * @zh
     * 在自身刚体的本地空间中，Joint2D的位置。
     */
    @serializable
    @tooltip('i18n:physics2d.joint.anchor')
    anchor = new Vec2();

    /**
     * @en
     * The position of Joint2D in the connected rigid body's local space.
     * @zh
     * 在连接刚体的本地空间中，Joint2D的位置。
     */
    @serializable
    @tooltip('i18n:physics2d.joint.connectedAnchor')
    connectedAnchor = new Vec2();

    /**
     * @en
     * whether collision is turned on between two rigid bodies connected by a joint.
     * @zh
     * 关节连接的两刚体之间是否开启碰撞。
     */
    @serializable
    @tooltip('i18n:physics2d.joint.collideConnected')
    collideConnected = false;

    /**
     * @en
     * The jointed rigid body, null means link to a static rigid body at the world origin.
     * @zh
     * 关节连接的刚体，为空时表示连接到位于世界原点的静态刚体。
     */
    @type(RigidBody2D)
    @serializable
    @tooltip('i18n:physics2d.joint.connectedBody')
    connectedBody: RigidBody2D | null = null;

    /**
     * @en
     * Gets the attached body's anchor after node scale is applied, in Box2D local units.
     * @zh
     * 获取自身刚体锚点。返回值已经按节点世界缩放换算，并转换为 Box2D 使用的物理单位。
     * @param out @en Optional output vector. A new Vec2 is created when it is not provided. @zh 可选，输出向量。未传入时会创建新的 Vec2。
     * @returns @en The scaled local anchor in Box2D units. @zh 已缩放并转换为物理单位的本地锚点。
     * @engineInternal
     * @mangle
     */
    _getAnchorA (out: Vec2 = new Vec2()): Vec2 {
        const scale = this.node.worldScale;
        out.x = this.anchor.x * scale.x / PHYSICS_2D_PTM_RATIO;
        out.y = this.anchor.y * scale.y / PHYSICS_2D_PTM_RATIO;
        return out;
    }

    /**
     * @en
     * Gets the connected body's anchor after node scale is applied, in Box2D local units.
     * @zh
     * 获取连接刚体锚点。连接刚体为空时保持世界原点静态刚体语义，不应用节点缩放；返回值会转换为 Box2D 物理单位。
     * @param out @en Optional output vector. A new Vec2 is created when it is not provided. @zh 可选，输出向量。未传入时会创建新的 Vec2。
     * @returns @en The scaled connected local anchor in Box2D units. @zh 已缩放并转换为物理单位的连接锚点。
     * @engineInternal
     * @mangle
     */
    _getAnchorB (out: Vec2 = new Vec2()): Vec2 {
        const body = this.connectedBody;
        const node = body && body.isValid ? body.node : null;
        const scale = node ? node.worldScale : null;
        out.x = this.connectedAnchor.x * (scale ? scale.x : 1) / PHYSICS_2D_PTM_RATIO;
        out.y = this.connectedAnchor.y * (scale ? scale.y : 1) / PHYSICS_2D_PTM_RATIO;
        return out;
    }

    /**
     * @en
     * the Joint2D attached rigid-body.
     * @zh
     * 关节所绑定的刚体组件。
     */
    _body: RigidBody2D | null = null;
    get body (): RigidBody2D | null {
        return this._body;
    }

    get impl (): IJoint2D | null {
        return this._joint;
    }

    protected _joint: IJoint2D | null = null;

    /**
     * @en
     * the type of this joint.
     * @zh
     * 此关节的类型。
     */
    TYPE = EJoint2DType.None;

    /**
     * @en
     * Rebuilds all joints whose anchors may be affected by the rigid body's scale.
     * @zh
     * 重建所有会受指定刚体缩放影响的关节。
     * @param body @en The scaled rigid body. @zh 发生缩放变化的刚体。
     * @engineInternal
     * @mangle
     */
    static _applyScale (body: RigidBody2D): void {
        const joints = Joint2D.joints;
        for (let i = 0; i < joints.length; i++) {
            const joint = joints[i];
            if (!joint.isValid || (joint.connectedBody && !joint.connectedBody.isValid)) {
                continue;
            }
            const selfBody = joint._body || joint.getComponent(RigidBody2D);
            if (selfBody === body || joint.connectedBody === body) {
                joint.apply();
            }
        }
    }

    protected override onLoad (): void {
        if (!EDITOR_NOT_IN_PREVIEW) {
            this._joint = createJoint(this.TYPE);
            this._joint.initialize(this);

            this._body = this.getComponent(RigidBody2D);
            Joint2D.joints.push(this);
        }
    }

    protected override onEnable (): void {
        if (this._joint && this._joint.onEnable) {
            this._joint.onEnable();
        }
    }

    protected override onDisable (): void {
        if (this._joint && this._joint.onDisable) {
            this._joint.onDisable();
        }
    }

    protected override start (): void {
        if (this._joint && this._joint.start) {
            this._joint.start();
        }
    }

    protected override onDestroy (): void {
        const i = Joint2D.joints.indexOf(this);
        if (i >= 0) {
            Joint2D.joints.splice(i, 1);
        }
        if (this._joint && this._joint.onDestroy) {
            this._joint.onDestroy();
        }
    }

    /**
     * @en
     * If the physics engine is box2d, need to call this function to apply current changes to joint, this will regenerate inner box2d joint.
     * @zh
     * 如果物理引擎是 box2d, 需要调用此函数来应用当前 joint 中的修改。
     */
    apply (): void {
        if (this._joint && this._joint.apply) {
            this._joint.apply();
        }
    }
}
