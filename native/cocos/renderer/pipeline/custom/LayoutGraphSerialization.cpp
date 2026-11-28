/*
 Copyright (c) 2021-2024 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com

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

/**
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 * The following section is auto-generated.
 * ========================= !DO NOT CHANGE THE FOLLOWING SECTION MANUALLY! =========================
 */
// NOLINTBEGIN(misc-include-cleaner)
// clang-format off
#include "cocos/renderer/pipeline/custom/ArchiveTypes.h"
#include "cocos/renderer/pipeline/custom/LayoutGraphSerialization.h"
#include "cocos/renderer/pipeline/custom/LayoutGraphTypes.h"
#include "cocos/renderer/pipeline/custom/details/SerializationUtils.h"
// clang-format on

namespace cc {

namespace render {

void save(OutputArchive& ar, const Descriptor& v) {
    save(ar, v.type);
    save(ar, v.count);
}

void load(InputArchive& ar, Descriptor& v) {
    load(ar, v.type);
    load(ar, v.count);
}

void save(OutputArchive& ar, const DescriptorBlock& v) {
    save(ar, v.descriptors);
    save(ar, v.uniformBlocks);
    save(ar, v.capacity);
    save(ar, v.count);
}

void load(InputArchive& ar, DescriptorBlock& v) {
    load(ar, v.descriptors);
    load(ar, v.uniformBlocks);
    load(ar, v.capacity);
    load(ar, v.count);
}

void save(OutputArchive& ar, const DescriptorBlockFlattened& v) {
    save(ar, v.descriptorNames);
    save(ar, v.uniformBlockNames);
    save(ar, v.descriptors);
    save(ar, v.uniformBlocks);
    save(ar, v.capacity);
    save(ar, v.count);
}

void load(InputArchive& ar, DescriptorBlockFlattened& v) {
    load(ar, v.descriptorNames);
    load(ar, v.uniformBlockNames);
    load(ar, v.descriptors);
    load(ar, v.uniformBlocks);
    load(ar, v.capacity);
    load(ar, v.count);
}

void save(OutputArchive& ar, const DescriptorBlockIndex& v) {
    save(ar, v.updateFrequency);
    save(ar, v.parameterType);
    save(ar, v.descriptorType);
    save(ar, v.visibility);
}

void load(InputArchive& ar, DescriptorBlockIndex& v) {
    load(ar, v.updateFrequency);
    load(ar, v.parameterType);
    load(ar, v.descriptorType);
    load(ar, v.visibility);
}

void save(OutputArchive& ar, const DescriptorGroupBlockIndex& v) {
    save(ar, v.updateFrequency);
    save(ar, v.parameterType);
    save(ar, v.descriptorType);
    save(ar, v.visibility);
    save(ar, v.accessType);
    save(ar, v.viewDimension);
    save(ar, v.sampleType);
    save(ar, v.format);
}

void load(InputArchive& ar, DescriptorGroupBlockIndex& v) {
    load(ar, v.updateFrequency);
    load(ar, v.parameterType);
    load(ar, v.descriptorType);
    load(ar, v.visibility);
    load(ar, v.accessType);
    load(ar, v.viewDimension);
    load(ar, v.sampleType);
    load(ar, v.format);
}

void save(OutputArchive& ar, const DescriptorDB& v) {
    save(ar, v.blocks);
    save(ar, v.groupBlocks);
}

void load(InputArchive& ar, DescriptorDB& v) {
    load(ar, v.blocks);
    load(ar, v.groupBlocks);
}

void save(OutputArchive& ar, const RenderPhase& v) {
    save(ar, v.shaders);
}

void load(InputArchive& ar, RenderPhase& v) {
    load(ar, v.shaders);
}

void save(OutputArchive& ar, const LayoutGraph& g) {
    uint32_t edges = 0;
    uint32_t counts[2]{};
    for (auto v : g.vertices()) {
        edges += g.out_degree(v);
        ++counts[static_cast<uint32_t>(g.kind(v))];
    }
    save(ar, g.num_vertices());
    save(ar, edges);
    for (auto n : counts) save(ar, n);
    for (auto v : g.vertices()) {
        save(ar, static_cast<uint32_t>(g.kind(v)));
        save(ar, g.get_parent(v));
        save(ar, g.getName(v));
        save(ar, g.getDescriptors(v));
        switch (g.kind(v)) {
        case LayoutGraph::Kind::RenderStage: save(ar, g.value(RenderStage_{}, v)); break;
        case LayoutGraph::Kind::RenderPhase: save(ar, g.value(RenderPhase_{}, v)); break;
        }
    }
}

void load(InputArchive& ar, LayoutGraph& g) {
    g.handles.clear();
    g.links.clear();
    g.names.clear();
    g.descriptors.clear();
    g.stages.clear();
    g.phases.clear();
    const auto readSize = [&ar]() -> uint32_t {
        const auto n = ar.readNumber();
        if (n >= 0 && n <= UINT32_MAX && n == static_cast<uint32_t>(n)) {
            return static_cast<uint32_t>(n);
        }
        throw std::runtime_error("Invalid graph archive size");
    };
    const auto size = readSize();
    auto edges = readSize();
    uint32_t counts[2];
    for (auto& n : counts) n = readSize();
    for (uint32_t i = 0; i < size; ++i) {
        const auto kind = readSize();
        const auto parent = readSize();
        if (kind >= 2 || counts[kind] == 0) throw std::runtime_error("Invalid graph archive kind");
        --counts[kind];
        if (parent != LayoutGraph::null_vertex()) {
            if (parent >= i || !edges) throw std::runtime_error("Invalid graph archive parent");
            --edges;
        }
        const auto readVertex = [&](auto tag) {
            const auto v = g.add_vertex(tag, {}, parent);
            load(ar, g.getName(v));
            load(ar, g.getDescriptors(v));
            load(ar, g.value(tag, v));
        };
        switch (static_cast<LayoutGraph::Kind>(kind)) {
        case LayoutGraph::Kind::RenderStage: readVertex(RenderStage_{}); break;
        case LayoutGraph::Kind::RenderPhase: readVertex(RenderPhase_{}); break;
        }
    }
    if (edges) throw std::runtime_error("Invalid graph archive edge count");
    for (auto n : counts) if (n) throw std::runtime_error("Invalid graph archive kind count");
}

void save(OutputArchive& ar, const UniformData& v) {
    save(ar, v.uniformID);
    save(ar, v.uniformType);
    save(ar, v.offset);
    save(ar, v.size);
}

void load(InputArchive& ar, UniformData& v) {
    load(ar, v.uniformID);
    load(ar, v.uniformType);
    load(ar, v.offset);
    load(ar, v.size);
}

void save(OutputArchive& ar, const UniformBlockData& v) {
    save(ar, v.bufferSize);
    save(ar, v.uniforms);
}

void load(InputArchive& ar, UniformBlockData& v) {
    load(ar, v.bufferSize);
    load(ar, v.uniforms);
}

void save(OutputArchive& ar, const NameLocalID& v) {
    save(ar, v.value);
}

void load(InputArchive& ar, NameLocalID& v) {
    load(ar, v.value);
}

void save(OutputArchive& ar, const DescriptorData& v) {
    save(ar, v.descriptorID);
    save(ar, v.type);
    save(ar, v.count);
}

void load(InputArchive& ar, DescriptorData& v) {
    load(ar, v.descriptorID);
    load(ar, v.type);
    load(ar, v.count);
}

void save(OutputArchive& ar, const DescriptorBlockData& v) {
    save(ar, v.type);
    save(ar, v.visibility);
    save(ar, v.offset);
    save(ar, v.capacity);
    save(ar, v.accessType);
    save(ar, v.viewDimension);
    save(ar, v.sampleType);
    save(ar, v.format);
    save(ar, v.descriptors);
}

void load(InputArchive& ar, DescriptorBlockData& v) {
    load(ar, v.type);
    load(ar, v.visibility);
    load(ar, v.offset);
    load(ar, v.capacity);
    load(ar, v.accessType);
    load(ar, v.viewDimension);
    load(ar, v.sampleType);
    load(ar, v.format);
    load(ar, v.descriptors);
}

void save(OutputArchive& ar, const DescriptorSetLayoutData& v) {
    save(ar, v.slot);
    save(ar, v.capacity);
    save(ar, v.uniformBlockCapacity);
    save(ar, v.samplerTextureCapacity);
    save(ar, v.descriptorBlocks);
    save(ar, v.uniformBlocks);
    save(ar, v.bindingMap);
}

void load(InputArchive& ar, DescriptorSetLayoutData& v) {
    load(ar, v.slot);
    load(ar, v.capacity);
    load(ar, v.uniformBlockCapacity);
    load(ar, v.samplerTextureCapacity);
    load(ar, v.descriptorBlocks);
    load(ar, v.uniformBlocks);
    load(ar, v.bindingMap);
}

void save(OutputArchive& ar, const DescriptorSetData& v) {
    save(ar, v.descriptorSetLayoutData);
    save(ar, v.descriptorSetLayoutInfo);
    // skip, descriptorSetLayout: IntrusivePtr<gfx::DescriptorSetLayout>
    // skip, descriptorSet: IntrusivePtr<gfx::DescriptorSet>
}

void load(InputArchive& ar, DescriptorSetData& v) {
    load(ar, v.descriptorSetLayoutData);
    load(ar, v.descriptorSetLayoutInfo);
    // skip, descriptorSetLayout: IntrusivePtr<gfx::DescriptorSetLayout>
    // skip, descriptorSet: IntrusivePtr<gfx::DescriptorSet>
}

void save(OutputArchive& ar, const PipelineLayoutData& v) {
    save(ar, v.descriptorSets);
    save(ar, v.descriptorGroups);
}

void load(InputArchive& ar, PipelineLayoutData& v) {
    load(ar, v.descriptorSets);
    load(ar, v.descriptorGroups);
}

void save(OutputArchive& ar, const ShaderBindingData& v) {
    save(ar, v.descriptorBindings);
}

void load(InputArchive& ar, ShaderBindingData& v) {
    load(ar, v.descriptorBindings);
}

void save(OutputArchive& ar, const ShaderLayoutData& v) {
    save(ar, v.layoutData);
    save(ar, v.bindingData);
}

void load(InputArchive& ar, ShaderLayoutData& v) {
    load(ar, v.layoutData);
    load(ar, v.bindingData);
}

void save(OutputArchive& ar, const TechniqueData& v) {
    save(ar, v.passes);
}

void load(InputArchive& ar, TechniqueData& v) {
    load(ar, v.passes);
}

void save(OutputArchive& ar, const EffectData& v) {
    save(ar, v.techniques);
}

void load(InputArchive& ar, EffectData& v) {
    load(ar, v.techniques);
}

void save(OutputArchive& ar, const ShaderProgramData& v) {
    save(ar, v.layout);
    // skip, pipelineLayout: IntrusivePtr<gfx::PipelineLayout>
}

void load(InputArchive& ar, ShaderProgramData& v) {
    load(ar, v.layout);
    // skip, pipelineLayout: IntrusivePtr<gfx::PipelineLayout>
}

void save(OutputArchive& ar, const RenderStageData& v) {
    save(ar, v.descriptorVisibility);
}

void load(InputArchive& ar, RenderStageData& v) {
    load(ar, v.descriptorVisibility);
}

void save(OutputArchive& ar, const RenderPhaseData& v) {
    save(ar, v.rootSignature);
    save(ar, v.shaderPrograms);
    save(ar, v.shaderIndex);
    // skip, pipelineLayout: IntrusivePtr<gfx::PipelineLayout>
}

void load(InputArchive& ar, RenderPhaseData& v) {
    load(ar, v.rootSignature);
    load(ar, v.shaderPrograms);
    load(ar, v.shaderIndex);
    // skip, pipelineLayout: IntrusivePtr<gfx::PipelineLayout>
}

void save(OutputArchive& ar, const LayoutGraphData& g) {
    uint32_t edges = 0;
    uint32_t counts[2]{};
    for (auto v : g.vertices()) {
        edges += g.out_degree(v);
        ++counts[static_cast<uint32_t>(g.kind(v))];
    }
    save(ar, g.num_vertices());
    save(ar, edges);
    for (auto n : counts) save(ar, n);
    for (auto v : g.vertices()) {
        save(ar, static_cast<uint32_t>(g.kind(v)));
        save(ar, g.get_parent(v));
        save(ar, g.getName(v));
        save(ar, g.getUpdate(v));
        save(ar, g.getLayout(v));
        switch (g.kind(v)) {
        case LayoutGraphData::Kind::RenderStage: save(ar, g.value(RenderStage_{}, v)); break;
        case LayoutGraphData::Kind::RenderPhase: save(ar, g.value(RenderPhase_{}, v)); break;
        }
    }
    save(ar, g.valueNames);
    save(ar, g.attributeIndex);
    save(ar, g.constantIndex);
    save(ar, g.shaderLayoutIndex);
    save(ar, g.effects);
}

void load(InputArchive& ar, LayoutGraphData& g) {
    g.handles.clear();
    g.links.clear();
    g.names.clear();
    g.updateFrequencies.clear();
    g.layouts.clear();
    g.stages.clear();
    g.phases.clear();
    g.valueNames.clear();
    g.attributeIndex.clear();
    g.constantIndex.clear();
    g.shaderLayoutIndex.clear();
    g.effects.clear();
    const auto readSize = [&ar]() -> uint32_t {
        const auto n = ar.readNumber();
        if (n >= 0 && n <= UINT32_MAX && n == static_cast<uint32_t>(n)) {
            return static_cast<uint32_t>(n);
        }
        throw std::runtime_error("Invalid graph archive size");
    };
    const auto size = readSize();
    auto edges = readSize();
    uint32_t counts[2];
    for (auto& n : counts) n = readSize();
    for (uint32_t i = 0; i < size; ++i) {
        const auto kind = readSize();
        const auto parent = readSize();
        if (kind >= 2 || counts[kind] == 0) throw std::runtime_error("Invalid graph archive kind");
        --counts[kind];
        if (parent != LayoutGraphData::null_vertex()) {
            if (parent >= i || !edges) throw std::runtime_error("Invalid graph archive parent");
            --edges;
        }
        const auto readVertex = [&](auto tag) {
            const auto v = g.add_vertex(tag, {}, parent);
            load(ar, g.getName(v));
            load(ar, g.getUpdate(v));
            load(ar, g.getLayout(v));
            load(ar, g.value(tag, v));
        };
        switch (static_cast<LayoutGraphData::Kind>(kind)) {
        case LayoutGraphData::Kind::RenderStage: readVertex(RenderStage_{}); break;
        case LayoutGraphData::Kind::RenderPhase: readVertex(RenderPhase_{}); break;
        }
    }
    if (edges) throw std::runtime_error("Invalid graph archive edge count");
    for (auto n : counts) if (n) throw std::runtime_error("Invalid graph archive kind count");
    load(ar, g.valueNames);
    load(ar, g.attributeIndex);
    load(ar, g.constantIndex);
    load(ar, g.shaderLayoutIndex);
    load(ar, g.effects);
}

} // namespace render

} // namespace cc
// NOLINTEND(misc-include-cleaner)
