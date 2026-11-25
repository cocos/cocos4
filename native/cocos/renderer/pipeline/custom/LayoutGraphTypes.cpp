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
#include "LayoutGraphTypes.h"
#include <utility>

namespace cc {

namespace render {

DescriptorDB::DescriptorDB(const allocator_type& alloc)
: blocks(alloc),
  groupBlocks(alloc) {}

DescriptorDB::DescriptorDB(DescriptorDB&& rhs, const allocator_type& alloc)
: blocks(std::move(rhs.blocks), alloc),
  groupBlocks(std::move(rhs.groupBlocks), alloc) {}

DescriptorDB::DescriptorDB(DescriptorDB const& rhs, const allocator_type& alloc)
: blocks(rhs.blocks, alloc),
  groupBlocks(rhs.groupBlocks, alloc) {}

RenderPhase::RenderPhase(const allocator_type& alloc)
: shaders(alloc) {}

RenderPhase::RenderPhase(RenderPhase&& rhs, const allocator_type& alloc)
: shaders(std::move(rhs.shaders), alloc) {}

RenderPhase::RenderPhase(RenderPhase const& rhs, const allocator_type& alloc)
: shaders(rhs.shaders, alloc) {}

LayoutGraph::LayoutGraph(const LayoutGraph& rhs, const allocator_type& alloc)
: handles(rhs.handles, alloc), links(rhs.links, alloc), names(rhs.names, alloc), descriptors(rhs.descriptors, alloc), stages(rhs.stages, alloc), phases(rhs.phases, alloc) {}

LayoutGraph::LayoutGraph(LayoutGraph&& rhs, const allocator_type& alloc)
: handles(std::move(rhs.handles), alloc), links(std::move(rhs.links), alloc), names(std::move(rhs.names), alloc), descriptors(std::move(rhs.descriptors), alloc), stages(std::move(rhs.stages), alloc), phases(std::move(rhs.phases), alloc) {}

LayoutGraph::vertex_descriptor LayoutGraph::add_vertex(const RenderStage_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, parent);
}

LayoutGraph::vertex_descriptor LayoutGraph::add_vertex(const RenderPhase_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, parent);
}

std::pair<LayoutGraph::edge_descriptor, bool> LayoutGraph::add_edge(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (static_cast<std::uintmax_t>(u) >= links.size() || static_cast<std::uintmax_t>(v) >= links.size() ||
        links[v].parent != null_vertex() || u >= v) return {{null_vertex(), null_vertex()}, false};
    auto& parent = links[u];
    auto& child = links[v];
    auto* slot = &parent.firstChild;
    while (*slot != null_vertex() && *slot < v) slot = &links[*slot].nextSibling;
    child.nextSibling = *slot;
    if (*slot == null_vertex()) parent.lastChild = v;
    *slot = v;
    child.parent = u;
    ++parent.childCount;
    return {{u, v}, true};
}

void LayoutGraph::remove_edge(edge_descriptor e) noexcept {
    if (!edge(e.source, e.target).second) return;
    auto& parent = links[e.source];
    auto& child = links[e.target];
    auto previous = null_vertex();
    auto* slot = &parent.firstChild;
    while (*slot != e.target) {
        previous = *slot;
        slot = &links[previous].nextSibling;
    }
    *slot = child.nextSibling;
    if (parent.lastChild == e.target) parent.lastChild = previous;
    child.parent = child.nextSibling = null_vertex();
    --parent.childCount;
}

LayoutGraph::vertex_descriptor LayoutGraph::locate_child(vertex_descriptor parent, std::string_view name) const noexcept {
    const auto count = this->names.size();
    if (parent == null_vertex()) {
        for (std::size_t i = 0; i < count; ++i) {
            const auto v = static_cast<vertex_descriptor>(i);
            if (get_parent(v) == null_vertex() && std::string_view{this->getName(v)} == name) return v;
        }
    } else if (static_cast<std::uintmax_t>(parent) < count) {
        for (const auto link : child_links(parent)) {
            const auto v = child(link);
            if (std::string_view{this->getName(v)} == name) return v;
        }
    }
    return null_vertex();
}

LayoutGraph::vertex_descriptor LayoutGraph::locate(std::string_view refPath, vertex_descriptor start) const noexcept {
    if (refPath.empty()) return null_vertex();
    if (refPath.front() == '/') {
        start = null_vertex();
    } else if (start != null_vertex() && static_cast<std::uintmax_t>(start) >= this->names.size()) {
        return null_vertex();
    }

    while (!refPath.empty()) {
        const auto slash = refPath.find('/');
        const auto segment = refPath.substr(0, slash);
        refPath.remove_prefix(slash == std::string_view::npos ? refPath.size() : slash + 1);
        if (segment.empty() || segment == ".") continue;
        if (segment == "..") {
            if (start == null_vertex()) return null_vertex();
            start = get_parent(start);
        } else {
            start = locate_child(start, segment);
            if (start == null_vertex()) return null_vertex();
        }
    }
    return start;
}

ccstd::pmr::string LayoutGraph::path(vertex_descriptor v) const {
    if (v != null_vertex() && static_cast<std::uintmax_t>(v) >= this->names.size()) {
        throw std::out_of_range("invalid LayoutGraph vertex");
    }
    ccstd::pmr::string result(get_allocator());
    std::size_t length = 0;
    for (auto u = v; u != null_vertex(); u = get_parent(u)) {
        const auto size = this->getName(u).size();
        if (size >= result.max_size() - length) throw std::length_error("graph path too long");
        length += size + 1;
    }
    result.resize(length);
    for (auto u = v; u != null_vertex(); u = get_parent(u)) {
        const auto& segment = this->getName(u);
        length -= segment.size();
        segment.copy(result.data() + length, segment.size());
        result[--length] = '/';
    }
    return result;
}

UniformBlockData::UniformBlockData(const allocator_type& alloc)
: uniforms(alloc) {}

UniformBlockData::UniformBlockData(UniformBlockData&& rhs, const allocator_type& alloc)
: bufferSize(rhs.bufferSize),
  uniforms(std::move(rhs.uniforms), alloc) {}

UniformBlockData::UniformBlockData(UniformBlockData const& rhs, const allocator_type& alloc)
: bufferSize(rhs.bufferSize),
  uniforms(rhs.uniforms, alloc) {}

DescriptorBlockData::DescriptorBlockData(const allocator_type& alloc)
: descriptors(alloc) {}

DescriptorBlockData::DescriptorBlockData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, DescriptorTypeOrder typeIn, gfx::ShaderStageFlagBit visibilityIn, uint32_t capacityIn, gfx::MemoryAccessBit accessTypeIn, gfx::ViewDimension viewDimensionIn, gfx::SampleType sampleTypeIn, gfx::Format formatIn) // NOLINT
: type(typeIn),
  visibility(visibilityIn),
  capacity(capacityIn),
  accessType(accessTypeIn),
  viewDimension(viewDimensionIn),
  sampleType(sampleTypeIn),
  format(formatIn),
  descriptors(alloc) {}

DescriptorBlockData::DescriptorBlockData(DescriptorTypeOrder typeIn, gfx::ShaderStageFlagBit visibilityIn, uint32_t capacityIn, const allocator_type& alloc) // NOLINT
: type(typeIn),
  visibility(visibilityIn),
  capacity(capacityIn),
  descriptors(alloc) {}

DescriptorBlockData::DescriptorBlockData(DescriptorBlockData&& rhs, const allocator_type& alloc)
: type(rhs.type),
  visibility(rhs.visibility),
  offset(rhs.offset),
  capacity(rhs.capacity),
  accessType(rhs.accessType),
  viewDimension(rhs.viewDimension),
  sampleType(rhs.sampleType),
  format(rhs.format),
  descriptors(std::move(rhs.descriptors), alloc) {}

DescriptorBlockData::DescriptorBlockData(DescriptorBlockData const& rhs, const allocator_type& alloc)
: type(rhs.type),
  visibility(rhs.visibility),
  offset(rhs.offset),
  capacity(rhs.capacity),
  accessType(rhs.accessType),
  viewDimension(rhs.viewDimension),
  sampleType(rhs.sampleType),
  format(rhs.format),
  descriptors(rhs.descriptors, alloc) {}

DescriptorSetLayoutData::DescriptorSetLayoutData(const allocator_type& alloc)
: descriptorBlocks(alloc),
  uniformBlocks(alloc),
  bindingMap(alloc) {}

DescriptorSetLayoutData::DescriptorSetLayoutData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t slotIn, uint32_t capacityIn, ccstd::pmr::vector<DescriptorBlockData> descriptorBlocksIn, PmrUnorderedMap<NameLocalID, gfx::UniformBlock> uniformBlocksIn, PmrFlatMap<NameLocalID, uint32_t> bindingMapIn) // NOLINT
: slot(slotIn),
  capacity(capacityIn),
  descriptorBlocks(std::move(descriptorBlocksIn), alloc),
  uniformBlocks(std::move(uniformBlocksIn), alloc),
  bindingMap(std::move(bindingMapIn), alloc) {}

DescriptorSetLayoutData::DescriptorSetLayoutData(DescriptorSetLayoutData&& rhs, const allocator_type& alloc)
: slot(rhs.slot),
  capacity(rhs.capacity),
  uniformBlockCapacity(rhs.uniformBlockCapacity),
  samplerTextureCapacity(rhs.samplerTextureCapacity),
  descriptorBlocks(std::move(rhs.descriptorBlocks), alloc),
  uniformBlocks(std::move(rhs.uniformBlocks), alloc),
  bindingMap(std::move(rhs.bindingMap), alloc) {}

DescriptorSetData::DescriptorSetData(const allocator_type& alloc)
: descriptorSetLayoutData(alloc),
  descriptorSetLayoutInfo(), // NOLINT(readability-redundant-member-init)
  descriptorSetLayout(), // NOLINT(readability-redundant-member-init)
  descriptorSet() {} // NOLINT(readability-redundant-member-init)

DescriptorSetData::DescriptorSetData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc)
: descriptorSetLayoutData(alloc),
  descriptorSetLayoutInfo(), // NOLINT(readability-redundant-member-init)
  descriptorSetLayout(), // NOLINT(readability-redundant-member-init)
  descriptorSet() {} // NOLINT(readability-redundant-member-init)

DescriptorSetData::DescriptorSetData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, DescriptorSetLayoutData descriptorSetLayoutDataIn, IntrusivePtr<gfx::DescriptorSetLayout> descriptorSetLayoutIn, IntrusivePtr<gfx::DescriptorSet> descriptorSetIn) // NOLINT
: descriptorSetLayoutData(std::move(descriptorSetLayoutDataIn), alloc),
  descriptorSetLayoutInfo(), // NOLINT(readability-redundant-member-init)
  descriptorSetLayout(std::move(descriptorSetLayoutIn)),
  descriptorSet(std::move(descriptorSetIn)) {}

DescriptorSetData::DescriptorSetData(DescriptorSetData&& rhs, const allocator_type& alloc)
: descriptorSetLayoutData(std::move(rhs.descriptorSetLayoutData), alloc),
  descriptorSetLayoutInfo(std::move(rhs.descriptorSetLayoutInfo)),
  descriptorSetLayout(std::move(rhs.descriptorSetLayout)),
  descriptorSet(std::move(rhs.descriptorSet)) {}

PipelineLayoutData::PipelineLayoutData(const allocator_type& alloc)
: descriptorSets(alloc),
  descriptorGroups(alloc) {}

PipelineLayoutData::PipelineLayoutData(PipelineLayoutData&& rhs, const allocator_type& alloc)
: descriptorSets(std::move(rhs.descriptorSets), alloc),
  descriptorGroups(std::move(rhs.descriptorGroups), alloc) {}

ShaderBindingData::ShaderBindingData(const allocator_type& alloc)
: descriptorBindings(alloc) {}

ShaderBindingData::ShaderBindingData(ShaderBindingData&& rhs, const allocator_type& alloc)
: descriptorBindings(std::move(rhs.descriptorBindings), alloc) {}

ShaderLayoutData::ShaderLayoutData(const allocator_type& alloc)
: layoutData(alloc),
  bindingData(alloc) {}

ShaderLayoutData::ShaderLayoutData(ShaderLayoutData&& rhs, const allocator_type& alloc)
: layoutData(std::move(rhs.layoutData), alloc),
  bindingData(std::move(rhs.bindingData), alloc) {}

TechniqueData::TechniqueData(const allocator_type& alloc)
: passes(alloc) {}

TechniqueData::TechniqueData(TechniqueData&& rhs, const allocator_type& alloc)
: passes(std::move(rhs.passes), alloc) {}

EffectData::EffectData(const allocator_type& alloc)
: techniques(alloc) {}

EffectData::EffectData(EffectData&& rhs, const allocator_type& alloc)
: techniques(std::move(rhs.techniques), alloc) {}

ShaderProgramData::ShaderProgramData(const allocator_type& alloc)
: layout(alloc),
  pipelineLayout() {} // NOLINT(readability-redundant-member-init)

ShaderProgramData::ShaderProgramData(ShaderProgramData&& rhs, const allocator_type& alloc)
: layout(std::move(rhs.layout), alloc),
  pipelineLayout(std::move(rhs.pipelineLayout)) {}

RenderStageData::RenderStageData(const allocator_type& alloc)
: descriptorVisibility(alloc) {}

RenderStageData::RenderStageData(RenderStageData&& rhs, const allocator_type& alloc)
: descriptorVisibility(std::move(rhs.descriptorVisibility), alloc) {}

RenderPhaseData::RenderPhaseData(const allocator_type& alloc)
: rootSignature(alloc),
  shaderPrograms(alloc),
  shaderIndex(alloc),
  pipelineLayout() {} // NOLINT(readability-redundant-member-init)

RenderPhaseData::RenderPhaseData(RenderPhaseData&& rhs, const allocator_type& alloc)
: rootSignature(std::move(rhs.rootSignature), alloc),
  shaderPrograms(std::move(rhs.shaderPrograms), alloc),
  shaderIndex(std::move(rhs.shaderIndex), alloc),
  pipelineLayout(std::move(rhs.pipelineLayout)) {}

LayoutGraphData::LayoutGraphData(LayoutGraphData&& rhs, const allocator_type& alloc)
: handles(std::move(rhs.handles), alloc), links(std::move(rhs.links), alloc), names(std::move(rhs.names), alloc), updateFrequencies(std::move(rhs.updateFrequencies), alloc), layouts(std::move(rhs.layouts), alloc), stages(std::move(rhs.stages), alloc), phases(std::move(rhs.phases), alloc), valueNames(std::move(rhs.valueNames), alloc), attributeIndex(std::move(rhs.attributeIndex), alloc), constantIndex(std::move(rhs.constantIndex), alloc), shaderLayoutIndex(std::move(rhs.shaderLayoutIndex), alloc), effects(std::move(rhs.effects), alloc), constantMacros(std::move(rhs.constantMacros)) {}

LayoutGraphData::vertex_descriptor LayoutGraphData::add_vertex(const RenderStage_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, parent);
}

LayoutGraphData::vertex_descriptor LayoutGraphData::add_vertex(const RenderPhase_& tag, std::string_view value, vertex_descriptor parent) {
    return add_vertex(tag, std::piecewise_construct, std::tuple<>{}, std::forward_as_tuple(value), std::tuple<>{}, std::tuple<>{}, parent);
}

std::pair<LayoutGraphData::edge_descriptor, bool> LayoutGraphData::add_edge(vertex_descriptor u, vertex_descriptor v) noexcept {
    if (static_cast<std::uintmax_t>(u) >= links.size() || static_cast<std::uintmax_t>(v) >= links.size() ||
        links[v].parent != null_vertex() || u >= v) return {{null_vertex(), null_vertex()}, false};
    auto& parent = links[u];
    auto& child = links[v];
    auto* slot = &parent.firstChild;
    while (*slot != null_vertex() && *slot < v) slot = &links[*slot].nextSibling;
    child.nextSibling = *slot;
    if (*slot == null_vertex()) parent.lastChild = v;
    *slot = v;
    child.parent = u;
    ++parent.childCount;
    return {{u, v}, true};
}

void LayoutGraphData::remove_edge(edge_descriptor e) noexcept {
    if (!edge(e.source, e.target).second) return;
    auto& parent = links[e.source];
    auto& child = links[e.target];
    auto previous = null_vertex();
    auto* slot = &parent.firstChild;
    while (*slot != e.target) {
        previous = *slot;
        slot = &links[previous].nextSibling;
    }
    *slot = child.nextSibling;
    if (parent.lastChild == e.target) parent.lastChild = previous;
    child.parent = child.nextSibling = null_vertex();
    --parent.childCount;
}

LayoutGraphData::vertex_descriptor LayoutGraphData::locate_child(vertex_descriptor parent, std::string_view name) const noexcept {
    const auto count = this->names.size();
    if (parent == null_vertex()) {
        for (std::size_t i = 0; i < count; ++i) {
            const auto v = static_cast<vertex_descriptor>(i);
            if (get_parent(v) == null_vertex() && std::string_view{this->getName(v)} == name) return v;
        }
    } else if (static_cast<std::uintmax_t>(parent) < count) {
        for (const auto link : child_links(parent)) {
            const auto v = child(link);
            if (std::string_view{this->getName(v)} == name) return v;
        }
    }
    return null_vertex();
}

LayoutGraphData::vertex_descriptor LayoutGraphData::locate(std::string_view refPath, vertex_descriptor start) const noexcept {
    if (refPath.empty()) return null_vertex();
    if (refPath.front() == '/') {
        start = null_vertex();
    } else if (start != null_vertex() && static_cast<std::uintmax_t>(start) >= this->names.size()) {
        return null_vertex();
    }

    while (!refPath.empty()) {
        const auto slash = refPath.find('/');
        const auto segment = refPath.substr(0, slash);
        refPath.remove_prefix(slash == std::string_view::npos ? refPath.size() : slash + 1);
        if (segment.empty() || segment == ".") continue;
        if (segment == "..") {
            if (start == null_vertex()) return null_vertex();
            start = get_parent(start);
        } else {
            start = locate_child(start, segment);
            if (start == null_vertex()) return null_vertex();
        }
    }
    return start;
}

ccstd::pmr::string LayoutGraphData::path(vertex_descriptor v) const {
    if (v != null_vertex() && static_cast<std::uintmax_t>(v) >= this->names.size()) {
        throw std::out_of_range("invalid LayoutGraphData vertex");
    }
    ccstd::pmr::string result(get_allocator());
    std::size_t length = 0;
    for (auto u = v; u != null_vertex(); u = get_parent(u)) {
        const auto size = this->getName(u).size();
        if (size >= result.max_size() - length) throw std::length_error("graph path too long");
        length += size + 1;
    }
    result.resize(length);
    for (auto u = v; u != null_vertex(); u = get_parent(u)) {
        const auto& segment = this->getName(u);
        length -= segment.size();
        segment.copy(result.data() + length, segment.size());
        result[--length] = '/';
    }
    return result;
}

} // namespace render

} // namespace cc
