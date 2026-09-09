/****************************************************************************
 Copyright (c) 2021-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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
****************************************************************************/
#pragma once

#include "base/std/optional.h"
#include "core/TypedArray.h"
#include "math/Vec3.h"
#include "math/Vec4.h"
#include "renderer/gfx-base/GFXDef.h"

namespace cc {

/**
 * @en
 * The definition of the parameter for building a primitive geometry.
 * @zh
 * 几何体参数选项。
 */
struct IGeometryOptions {
    /**
     * @en
     * Whether to include normal. Default to true.
     * @zh
     * 是否包含法线。默认为true。
     */
    bool includeNormal{true};

    /**
     * @en
     * Whether to include uv. Default to true.
     * @zh
     * 是否包含UV。默认为true。
     */
    bool includeUV{true};
};

struct CustomAttribute {
    gfx::Attribute attr;
    ccstd::vector<float> values;
};

/**
 * @en
 * The definition of the geometry, this struct can build a mesh.
 * @zh
 * 几何体信息。
 */
struct IGeometry {
    /**
     * @en
     * Vertex positions.
     * @zh
     * 顶点位置。
     */
    ccstd::vector<float> positions;

    /**
     * @en
     * Vertex normals.
     * @zh
     * 顶点法线。
     */
    ccstd::optional<ccstd::vector<float>> normals;

    /**
     * @en
     * Texture coordinates.
     * @zh
     * 纹理坐标。
     */
    ccstd::optional<ccstd::vector<float>> uvs;

    /**
     * @en
     * Vertex Tangents.
     * @zh
     * 顶点切线。
     */
    ccstd::optional<ccstd::vector<float>> tangents;

    /**
     * @en
     * Vertex colors.
     * @zh
     * 顶点颜色。
     */
    ccstd::optional<ccstd::vector<float>> colors;

    /**
     * @en
     * specify vertex attributes, use (positions|normals|uvs|colors) as keys
     * @zh
     * 顶点属性。
     */
    ccstd::optional<gfx::AttributeList> attributes;

    /**
     * @en
     * Custom attributes
     * @zh
     * 定制属性列表。
     */
    ccstd::optional<ccstd::vector<CustomAttribute>> customAttributes;

    /**
     * @en
     * Bounding sphere radius.
     * @zh
     * 包围球半径。
     */
    ccstd::optional<float> boundingRadius;

    /**
     * @en
     * Min position.
     * @zh
     * 最小位置。
     */
    ccstd::optional<Vec3> minPos;

    /**
     * @en
     * Max position.
     * @zh
     * 最大位置。
     */
    ccstd::optional<Vec3> maxPos;

    /**
     * @en
     * Geometry indices, if one needs indexed-draw.
     * @zh
     * 几何索引，当使用索引绘制时。
     */
    ccstd::optional<ccstd::vector<uint32_t>> indices; //cjh uint16_t ?

    /**
     * @en
     * Topology of the geometry vertices. Default is TRIANGLE_LIST.
     * @zh
     * 几何顶点的拓扑图元。默认值是TRIANGLE_LIST。
     */
    ccstd::optional<gfx::PrimitiveMode> primitiveMode;

    /**
     * @en
     * whether rays casting from the back face of this geometry could collide with it
     * @zh
     * 是否是双面，用于判断来自于几何体背面的射线检测。
     */
    ccstd::optional<bool> doubleSided;
};

struct DynamicCustomAttribute {
    gfx::Attribute attr;
    /**
     * @en
     * The raw vertex data for this custom attribute. Unlike the standard attributes
     * (positions/normals/uvs/tangents/colors) which are always float-based, a custom
     * attribute's physical GPU format (gfx::Attribute::format) can be any integer or
     * float format (e.g. RGBA16UI for joint indices). To avoid forcing every custom
     * attribute through a lossy/unnecessary "integer -> float -> integer" round trip,
     * `values` accepts any concrete TypedArray variant so callers can supply data whose
     * element type already matches the target GPU format (fast memcpy path). Supplying a
     * Float32Array still works for FLOAT-typed formats (backward compatible).
     * @zh
     * 该定制属性的原始顶点数据。与标准属性（positions/normals/uvs/tangents/colors，始终为
     * float）不同，定制属性的物理 GPU 格式（gfx::Attribute::format）可以是任意整型或浮点格式
     * （例如 RGBA16UI 用于骨骼关节索引）。为了避免强制所有定制属性都经历不必要甚至有损的
     * “整数 -> 浮点 -> 整数”往返转换，`values` 支持任意具体的 TypedArray 类型，调用者可以直接传入
     * 与目标 GPU 格式匹配的原生类型数组（走快速 memcpy 路径）。传入 Float32Array 对于 FLOAT
     * 类型格式仍然有效（向后兼容）。
     */
    TypedArray values;
};

/**
 * @en
 * The definition of the dynamic geometry, this struct can build a dynamic mesh.
 * @zh
 * 几何体信息。
 */
struct IDynamicGeometry {
    /**
     * @en
     * Vertex positions: 3 float components.
     * @zh
     * 顶点位置：3个float分量。
     */
    Float32Array positions;

    /**
     * @en
     * Vertex normals: 3 float components.
     * @zh
     * 顶点法线：3个float分量。
     */
    ccstd::optional<Float32Array> normals;

    /**
     * @en
     * Texture coordinates: 2 float components.
     * @zh
     * 纹理坐标：2个float分量。
     */
    ccstd::optional<Float32Array> uvs;

    /**
     * @en
     * Vertex Tangents: 4 float components.
     * @zh
     * 顶点切线：4个float分量。
     */
    ccstd::optional<Float32Array> tangents;

    /**
     * @en
     * Vertex colors: 4 float components.
     * @zh
     * 顶点颜色：4个float分量。
     */
    ccstd::optional<Float32Array> colors;

    /**
     * @en
     * Custom attributes
     * @zh
     * 定制属性列表。
     */
    ccstd::optional<ccstd::vector<DynamicCustomAttribute>> customAttributes;

    /**
     * @en
     * Min position, it is more efficient to calculate bounding box by user.
     * @zh
     * 最小位置。包围盒大小由用户提供，更高效。
     */
    ccstd::optional<Vec3> minPos;

    /**
     * @en
     * Max position, it is more efficient to calculate bounding box by user.
     * @zh
     * 最大位置。包围盒大小由用户提供，更高效。
     */
    ccstd::optional<Vec3> maxPos;

    /**
     * @en
     * 16 bits Geometry indices, if one needs indexed-draw.
     * @zh
     * 16位几何索引，当使用索引绘制时。
     */
    ccstd::optional<Uint16Array> indices16;

    /**
     * @en
     * 32 bits Geometry indices, if one needs indexed-draw.
     * @zh
     * 32位几何索引，当使用索引绘制时。
     */
    ccstd::optional<Uint32Array> indices32;

    /**
     * @en
     * Topology of the geometry vertices. Default is TRIANGLE_LIST.
     * @zh
     * 几何顶点的拓扑图元。默认值是TRIANGLE_LIST。
     */
    ccstd::optional<gfx::PrimitiveMode> primitiveMode;

    /**
     * @en
     * whether rays casting from the back face of this geometry could collide with it
     * @zh
     * 是否是双面，用于判断来自于几何体背面的射线检测。
     */
    ccstd::optional<bool> doubleSided;
};

} // namespace cc
