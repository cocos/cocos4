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
#pragma once // NOLINT(portability-avoid-pragma-once)
#include <cstdint>
#include <limits>
#include <memory>
#include <stdexcept>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <utility>
#include <variant>
#include "LayoutGraphFwd.h"
#include "cocos/base/GraphDescriptor.h"
#include "cocos/base/GraphIterator.h"
#include "cocos/base/Ptr.h"
#include "cocos/base/TemplateUtils.h"
#include "cocos/base/std/container/map.h"
#include "cocos/base/std/container/string.h"
#include "cocos/base/std/container/vector.h"
#include "cocos/renderer/gfx-base/GFXDef-common.h"
#include "cocos/renderer/gfx-base/GFXDescriptorSet.h"
#include "cocos/renderer/gfx-base/GFXDescriptorSetLayout.h"
#include "cocos/renderer/gfx-base/GFXPipelineLayout.h"
#include "cocos/renderer/pipeline/custom/RenderCommonTypes.h"
#include "cocos/renderer/pipeline/custom/details/Map.h"
#include "cocos/renderer/pipeline/custom/details/Set.h"

namespace cc {

namespace render {

enum class LayoutType : uint8_t {
    VULKAN,
    WEBGPU,
};

struct Layout {
    inline static LayoutType type{LayoutType::VULKAN};
    inline static bool isWebGPU{false};
};

enum class DescriptorTypeOrder : uint8_t {
    UNIFORM_BUFFER,
    DYNAMIC_UNIFORM_BUFFER,
    SAMPLER_TEXTURE,
    SAMPLER,
    TEXTURE,
    STORAGE_BUFFER,
    DYNAMIC_STORAGE_BUFFER,
    STORAGE_IMAGE,
    INPUT_ATTACHMENT,
};

struct Descriptor {
    Descriptor(gfx::Type typeIn = gfx::Type::UNKNOWN) noexcept // NOLINT(google-explicit-constructor)
    : type(typeIn) {}

    gfx::Type type{gfx::Type::UNKNOWN};
    uint32_t count{1};
};

struct DescriptorBlock {
    ccstd::map<ccstd::string, Descriptor> descriptors;
    ccstd::map<ccstd::string, gfx::UniformBlock> uniformBlocks;
    uint32_t capacity{0};
    uint32_t count{0};
};

struct DescriptorBlockFlattened {
    ccstd::vector<ccstd::string> descriptorNames;
    ccstd::vector<ccstd::string> uniformBlockNames;
    ccstd::vector<Descriptor> descriptors;
    ccstd::vector<gfx::UniformBlock> uniformBlocks;
    uint32_t capacity{0};
    uint32_t count{0};
};

struct DescriptorBlockIndex {
    DescriptorBlockIndex(UpdateFrequency updateFrequencyIn = UpdateFrequency::PER_INSTANCE, ParameterType parameterTypeIn = ParameterType::CONSTANTS, DescriptorTypeOrder descriptorTypeIn = DescriptorTypeOrder::UNIFORM_BUFFER, gfx::ShaderStageFlagBit visibilityIn = gfx::ShaderStageFlagBit::NONE) noexcept // NOLINT(google-explicit-constructor)
    : updateFrequency(updateFrequencyIn),
      parameterType(parameterTypeIn),
      descriptorType(descriptorTypeIn),
      visibility(visibilityIn) {}

    UpdateFrequency updateFrequency{UpdateFrequency::PER_INSTANCE};
    ParameterType parameterType{ParameterType::CONSTANTS};
    DescriptorTypeOrder descriptorType{DescriptorTypeOrder::UNIFORM_BUFFER};
    gfx::ShaderStageFlagBit visibility{gfx::ShaderStageFlagBit::NONE};
};

inline bool operator<(const DescriptorBlockIndex& lhs, const DescriptorBlockIndex& rhs) noexcept {
    return std::forward_as_tuple(lhs.updateFrequency, lhs.parameterType, lhs.descriptorType, lhs.visibility) <
           std::forward_as_tuple(rhs.updateFrequency, rhs.parameterType, rhs.descriptorType, rhs.visibility);
}

struct DescriptorGroupBlockIndex {
    DescriptorGroupBlockIndex(UpdateFrequency updateFrequencyIn = UpdateFrequency::PER_INSTANCE, ParameterType parameterTypeIn = ParameterType::CONSTANTS, DescriptorTypeOrder descriptorTypeIn = DescriptorTypeOrder::UNIFORM_BUFFER, gfx::ShaderStageFlagBit visibilityIn = gfx::ShaderStageFlagBit::NONE, gfx::MemoryAccessBit accessTypeIn = gfx::MemoryAccessBit::READ_ONLY, gfx::ViewDimension viewDimensionIn = gfx::ViewDimension::UNKNOWN, gfx::SampleType sampleTypeIn = gfx::SampleType::FLOAT, gfx::Format formatIn = gfx::Format::UNKNOWN) noexcept // NOLINT(google-explicit-constructor)
    : updateFrequency(updateFrequencyIn),
      parameterType(parameterTypeIn),
      descriptorType(descriptorTypeIn),
      visibility(visibilityIn),
      accessType(accessTypeIn),
      viewDimension(viewDimensionIn),
      sampleType(sampleTypeIn),
      format(formatIn) {}

    UpdateFrequency updateFrequency{UpdateFrequency::PER_INSTANCE};
    ParameterType parameterType{ParameterType::CONSTANTS};
    DescriptorTypeOrder descriptorType{DescriptorTypeOrder::UNIFORM_BUFFER};
    gfx::ShaderStageFlagBit visibility{gfx::ShaderStageFlagBit::NONE};
    gfx::MemoryAccessBit accessType{gfx::MemoryAccessBit::READ_ONLY};
    gfx::ViewDimension viewDimension{gfx::ViewDimension::UNKNOWN};
    gfx::SampleType sampleType{gfx::SampleType::FLOAT};
    gfx::Format format{gfx::Format::UNKNOWN};
};

inline bool operator<(const DescriptorGroupBlockIndex& lhs, const DescriptorGroupBlockIndex& rhs) noexcept {
    return std::forward_as_tuple(lhs.updateFrequency, lhs.parameterType, lhs.descriptorType, lhs.visibility, lhs.accessType, lhs.viewDimension, lhs.sampleType, lhs.format) <
           std::forward_as_tuple(rhs.updateFrequency, rhs.parameterType, rhs.descriptorType, rhs.visibility, rhs.accessType, rhs.viewDimension, rhs.sampleType, rhs.format);
}

struct DescriptorDB {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {blocks.get_allocator().resource()};
    }

    DescriptorDB(const allocator_type& alloc); // NOLINT
    DescriptorDB(DescriptorDB&& rhs, const allocator_type& alloc);
    DescriptorDB(DescriptorDB const& rhs, const allocator_type& alloc);

    DescriptorDB(DescriptorDB&& rhs) noexcept = default;
    DescriptorDB(DescriptorDB const& rhs) = delete;
    DescriptorDB& operator=(DescriptorDB&& rhs) noexcept = default;
    DescriptorDB& operator=(DescriptorDB const& rhs) = default;

    ccstd::pmr::map<DescriptorBlockIndex, DescriptorBlock> blocks;
    ccstd::pmr::map<DescriptorGroupBlockIndex, DescriptorBlock> groupBlocks;
};

struct RenderPhase {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {shaders.get_allocator().resource()};
    }

    RenderPhase(const allocator_type& alloc); // NOLINT
    RenderPhase(RenderPhase&& rhs, const allocator_type& alloc);
    RenderPhase(RenderPhase const& rhs, const allocator_type& alloc);

    RenderPhase(RenderPhase&& rhs) noexcept = default;
    RenderPhase(RenderPhase const& rhs) = delete;
    RenderPhase& operator=(RenderPhase&& rhs) noexcept = default;
    RenderPhase& operator=(RenderPhase const& rhs) = default;

    PmrTransparentSet<ccstd::pmr::string> shaders;
};

enum class RenderPassType : uint8_t {
    SINGLE_RENDER_PASS,
    RENDER_PASS,
    RENDER_SUBPASS,
};

struct Descriptors_ {};
struct Update_ {};
struct RenderStage_ {};
struct RenderPhase_ {};

struct LayoutGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->handles.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit LayoutGraph(const allocator_type& alloc) : handles(alloc), links(alloc), names(alloc), descriptors(alloc), stages(alloc), phases(alloc) {}
    LayoutGraph(const LayoutGraph& rhs, const allocator_type& alloc);
    LayoutGraph(LayoutGraph&& rhs, const allocator_type& alloc);
    LayoutGraph(LayoutGraph&&) noexcept = default;
    LayoutGraph(const LayoutGraph&) = delete;
    LayoutGraph& operator=(LayoutGraph&&) noexcept = default;
    LayoutGraph& operator=(const LayoutGraph&) = default;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using TreeEdge = graph::TreeEdge<vertex_descriptor>;
    using out_edge_iterator = graph::ChildIterator<edge_descriptor, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::ParentLinkIterator<edge_descriptor>;

    // AdjacencyGraph types
    using adjacency_iterator = graph::ChildIterator<edge_descriptor, true>;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // PolymorphicGraph types
    enum class Kind : uint8_t {
        RenderStage, // NOLINT(readability-identifier-naming)
        RenderPhase  // NOLINT(readability-identifier-naming)
    };

    // ReferenceGraph types
    using ownership_descriptor = edge_descriptor;
    using children_iterator = out_edge_iterator;
    using parent_iterator = in_edge_iterator;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }                                  // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }                                  // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { return child_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor out_degree(vertex_descriptor v) const noexcept { return num_children(v); }                     // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u != null_vertex() && static_cast<std::uintmax_t>(v) < this->links.size() && get_parent(v) == u) return {{u, v}, true};
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { return parent_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor in_degree(vertex_descriptor v) const noexcept { return num_parents(v); }                      // NOLINT(readability-identifier-naming)
    vertex_descriptor degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    graph::IteratorRange<adjacency_iterator> adjacent_vertices(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->names.size()); } // NOLINT(readability-identifier-naming)

    // MutableGraph
    vertex_descriptor add_vertex(const RenderStage_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const RenderPhase_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)

    template <class Tag, class PayloadArgs, class Args0, class Args1,
              std::enable_if_t<std::is_same_v<Tag, RenderStage_> ||
                                   std::is_same_v<Tag, RenderPhase_>,
                               int> = 0,
              class = std::void_t<typename std::tuple_size<std::decay_t<PayloadArgs>>::type,
                                  typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type>>
    vertex_descriptor add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsDescriptors, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                                                                                               // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                                                                                                               // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ccstd::pmr::string& getName(vertex_descriptor v) noexcept { return this->names[v]; }
    ccstd::pmr::string& get(const Name_& /*tag*/, vertex_descriptor v) noexcept { return getName(v); }

    ccstd::pmr::string const& getName(vertex_descriptor v) const noexcept { return this->names[v]; }
    ccstd::pmr::string const& get(const Name_& /*tag*/, vertex_descriptor v) const noexcept { return getName(v); }

    DescriptorDB& getDescriptors(vertex_descriptor v) noexcept { return this->descriptors[v]; }
    DescriptorDB& get(const Descriptors_& /*tag*/, vertex_descriptor v) noexcept { return getDescriptors(v); }

    DescriptorDB const& getDescriptors(vertex_descriptor v) const noexcept { return this->descriptors[v]; }
    DescriptorDB const& get(const Descriptors_& /*tag*/, vertex_descriptor v) const noexcept { return getDescriptors(v); }

    // PolymorphicGraph
    Kind kind(vertex_descriptor v) const { return this->handles.at(v).kind; }
    template <class Tag>
    bool holds(vertex_descriptor v) const noexcept {
        if (static_cast<std::uintmax_t>(v) >= this->handles.size()) return false;
        if constexpr (std::is_same_v<Tag, RenderStage_>) {
            return this->handles[v].kind == Kind::RenderStage;
        } else {
            static_assert(std::is_same_v<Tag, RenderPhase_>, "unknown graph tag");
            return this->handles[v].kind == Kind::RenderPhase;
        }
    }
    RenderPassType& value(const RenderStage_& /*tag*/, vertex_descriptor v) {
        if (!holds<RenderStage_>(v)) throw std::bad_variant_access{};
        return this->stages[this->handles[v].index];
    }
    RenderPassType const& value(const RenderStage_& /*tag*/, vertex_descriptor v) const {
        if (!holds<RenderStage_>(v)) throw std::bad_variant_access{};
        return this->stages[this->handles[v].index];
    }
    RenderPhase& value(const RenderPhase_& /*tag*/, vertex_descriptor v) {
        if (!holds<RenderPhase_>(v)) throw std::bad_variant_access{};
        return this->phases[this->handles[v].index];
    }
    RenderPhase const& value(const RenderPhase_& /*tag*/, vertex_descriptor v) const {
        if (!holds<RenderPhase_>(v)) throw std::bad_variant_access{};
        return this->phases[this->handles[v].index];
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RenderStage: return std::forward<Visitor>(visitor)(this->stages[handle.index]);
                case Kind::RenderPhase: return std::forward<Visitor>(visitor)(this->phases[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) const { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RenderStage: return std::forward<Visitor>(visitor)(this->stages[handle.index]);
                case Kind::RenderPhase: return std::forward<Visitor>(visitor)(this->phases[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    // ReferenceGraph
    vertex_descriptor child(ownership_descriptor link) const noexcept { return link.target; }                                   // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor get_parent(vertex_descriptor v) const noexcept { return v == null_vertex() ? v : this->links[v].parent; } // NOLINT(readability-identifier-naming)
    vertex_descriptor num_children(vertex_descriptor v) const noexcept { return this->links[v].childCount; }                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<children_iterator> child_links(vertex_descriptor v) const noexcept {                                   // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }
    vertex_descriptor parent(ownership_descriptor e) const noexcept { return e.source; }                                                            // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor num_parents(vertex_descriptor v) const noexcept { return get_parent(v) != null_vertex(); }                                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<parent_iterator> parent_links(vertex_descriptor v) const noexcept { return {{{get_parent(v), v}}, {{null_vertex(), v}}}; } // NOLINT(readability-identifier-naming)
    bool has_link(vertex_descriptor u, vertex_descriptor v) const noexcept { return edge(u, v).second; }                                            // NOLINT(readability-identifier-naming)

    // ParentGraph
    vertex_descriptor locate_child(vertex_descriptor parent, std::string_view name) const noexcept; // NOLINT(readability-identifier-naming)

    // AddressableGraph
    vertex_descriptor locate(std::string_view refPath, vertex_descriptor start = null_vertex()) const noexcept;
    bool exists(std::string_view refPath, vertex_descriptor start = null_vertex()) const noexcept {
        return locate(refPath, start) != null_vertex();
    }
    ccstd::pmr::string path(vertex_descriptor v) const;

    struct VertexHandle {
        Kind kind;
        vertex_descriptor index;
    };

    ccstd::pmr::vector<VertexHandle> handles;
    ccstd::pmr::vector<TreeEdge> links;
    ccstd::pmr::vector<ccstd::pmr::string> names;
    ccstd::pmr::vector<DescriptorDB> descriptors;
    ccstd::pmr::vector<RenderPassType> stages;
    ccstd::pmr::vector<RenderPhase> phases;
};

struct UniformData {
    UniformData(UniformID uniformIDIn = 0xFFFFFFFF, gfx::Type uniformTypeIn = gfx::Type::UNKNOWN, uint32_t offsetIn = 0) noexcept // NOLINT(google-explicit-constructor)
    : uniformID(uniformIDIn),
      uniformType(uniformTypeIn),
      offset(offsetIn) {}

    UniformID uniformID{0xFFFFFFFF};
    gfx::Type uniformType{gfx::Type::UNKNOWN};
    uint32_t offset{0};
    uint32_t size{0};
};

struct UniformBlockData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {uniforms.get_allocator().resource()};
    }

    UniformBlockData(const allocator_type& alloc); // NOLINT
    UniformBlockData(UniformBlockData&& rhs, const allocator_type& alloc);
    UniformBlockData(UniformBlockData const& rhs, const allocator_type& alloc);

    UniformBlockData(UniformBlockData&& rhs) noexcept = default;
    UniformBlockData(UniformBlockData const& rhs) = delete;
    UniformBlockData& operator=(UniformBlockData&& rhs) noexcept = default;
    UniformBlockData& operator=(UniformBlockData const& rhs) = default;

    uint32_t bufferSize{0};
    ccstd::pmr::vector<UniformData> uniforms;
};

struct NameLocalID {
    uint32_t value{0xFFFFFFFF};
};

inline bool operator==(const NameLocalID& lhs, const NameLocalID& rhs) noexcept {
    return std::forward_as_tuple(lhs.value) ==
           std::forward_as_tuple(rhs.value);
}

inline bool operator!=(const NameLocalID& lhs, const NameLocalID& rhs) noexcept {
    return !(lhs == rhs);
}

inline bool operator<(const NameLocalID& lhs, const NameLocalID& rhs) noexcept {
    return std::forward_as_tuple(lhs.value) <
           std::forward_as_tuple(rhs.value);
}

struct DescriptorData {
    DescriptorData(const NameLocalID& descriptorIDIn = {}, gfx::Type typeIn = gfx::Type::UNKNOWN, uint32_t countIn = 1) noexcept // NOLINT(google-explicit-constructor)
    : descriptorID(descriptorIDIn),
      type(typeIn),
      count(countIn) {}

    NameLocalID descriptorID;
    gfx::Type type{gfx::Type::UNKNOWN};
    uint32_t count{1};
};

struct DescriptorBlockData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptors.get_allocator().resource()};
    }

    DescriptorBlockData(const allocator_type& alloc); // NOLINT
    DescriptorBlockData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, DescriptorTypeOrder typeIn = DescriptorTypeOrder::UNIFORM_BUFFER, gfx::ShaderStageFlagBit visibilityIn = gfx::ShaderStageFlagBit::NONE, uint32_t capacityIn = 0, gfx::MemoryAccessBit accessTypeIn = gfx::MemoryAccessBit::READ_ONLY, gfx::ViewDimension viewDimensionIn = gfx::ViewDimension::UNKNOWN, gfx::SampleType sampleTypeIn = gfx::SampleType::FLOAT, gfx::Format formatIn = gfx::Format::UNKNOWN);
    DescriptorBlockData(DescriptorTypeOrder typeIn, gfx::ShaderStageFlagBit visibilityIn, uint32_t capacityIn, const allocator_type& alloc);
    DescriptorBlockData(DescriptorBlockData&& rhs, const allocator_type& alloc);
    DescriptorBlockData(DescriptorBlockData const& rhs, const allocator_type& alloc);

    DescriptorBlockData(DescriptorBlockData&& rhs) noexcept = default;
    DescriptorBlockData(DescriptorBlockData const& rhs) = delete;
    DescriptorBlockData& operator=(DescriptorBlockData&& rhs) noexcept = default;
    DescriptorBlockData& operator=(DescriptorBlockData const& rhs) = default;

    DescriptorTypeOrder type{DescriptorTypeOrder::UNIFORM_BUFFER};
    gfx::ShaderStageFlagBit visibility{gfx::ShaderStageFlagBit::NONE};
    uint32_t offset{0};
    uint32_t capacity{0};
    gfx::MemoryAccessBit accessType{gfx::MemoryAccessBit::READ_ONLY};
    gfx::ViewDimension viewDimension{gfx::ViewDimension::UNKNOWN};
    gfx::SampleType sampleType{gfx::SampleType::FLOAT};
    gfx::Format format{gfx::Format::UNKNOWN};
    ccstd::pmr::vector<DescriptorData> descriptors;
};

struct DescriptorSetLayoutData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptorBlocks.get_allocator().resource()};
    }

    DescriptorSetLayoutData(const allocator_type& alloc); // NOLINT
    DescriptorSetLayoutData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, uint32_t slotIn = 0xFFFFFFFF, uint32_t capacityIn = 0, ccstd::pmr::vector<DescriptorBlockData> descriptorBlocksIn = ccstd::pmr::vector<DescriptorBlockData>{}, PmrUnorderedMap<NameLocalID, gfx::UniformBlock> uniformBlocksIn = PmrUnorderedMap<NameLocalID, gfx::UniformBlock>{}, PmrFlatMap<NameLocalID, uint32_t> bindingMapIn = PmrFlatMap<NameLocalID, uint32_t>{});
    DescriptorSetLayoutData(DescriptorSetLayoutData&& rhs, const allocator_type& alloc);

    DescriptorSetLayoutData(DescriptorSetLayoutData&& rhs) noexcept = default;
    DescriptorSetLayoutData(DescriptorSetLayoutData const& rhs) = delete;
    DescriptorSetLayoutData& operator=(DescriptorSetLayoutData&& rhs) noexcept = default;
    DescriptorSetLayoutData& operator=(DescriptorSetLayoutData const& rhs) = delete;

    uint32_t slot{0xFFFFFFFF};
    uint32_t capacity{0};
    uint32_t uniformBlockCapacity{0};
    uint32_t samplerTextureCapacity{0};
    ccstd::pmr::vector<DescriptorBlockData> descriptorBlocks;
    PmrUnorderedMap<NameLocalID, gfx::UniformBlock> uniformBlocks;
    PmrFlatMap<NameLocalID, uint32_t> bindingMap;
};

struct DescriptorSetData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptorSetLayoutData.get_allocator().resource()};
    }

    DescriptorSetData(const allocator_type& alloc); // NOLINT
    DescriptorSetData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc);
    DescriptorSetData(const std::allocator_arg_t& /*tag*/, const allocator_type& alloc, DescriptorSetLayoutData descriptorSetLayoutDataIn, IntrusivePtr<gfx::DescriptorSetLayout> descriptorSetLayoutIn = IntrusivePtr<gfx::DescriptorSetLayout>{}, IntrusivePtr<gfx::DescriptorSet> descriptorSetIn = IntrusivePtr<gfx::DescriptorSet>{});
    DescriptorSetData(DescriptorSetData&& rhs, const allocator_type& alloc);

    DescriptorSetData(DescriptorSetData&& rhs) noexcept = default;
    DescriptorSetData(DescriptorSetData const& rhs) = delete;
    DescriptorSetData& operator=(DescriptorSetData&& rhs) noexcept = default;
    DescriptorSetData& operator=(DescriptorSetData const& rhs) = delete;

    DescriptorSetLayoutData descriptorSetLayoutData;
    gfx::DescriptorSetLayoutInfo descriptorSetLayoutInfo;
    IntrusivePtr<gfx::DescriptorSetLayout> descriptorSetLayout;
    IntrusivePtr<gfx::DescriptorSet> descriptorSet;
};

struct PipelineLayoutData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptorSets.get_allocator().resource()};
    }

    PipelineLayoutData(const allocator_type& alloc); // NOLINT
    PipelineLayoutData(PipelineLayoutData&& rhs, const allocator_type& alloc);

    PipelineLayoutData(PipelineLayoutData&& rhs) noexcept = default;
    PipelineLayoutData(PipelineLayoutData const& rhs) = delete;
    PipelineLayoutData& operator=(PipelineLayoutData&& rhs) noexcept = default;
    PipelineLayoutData& operator=(PipelineLayoutData const& rhs) = delete;

    ccstd::pmr::map<UpdateFrequency, DescriptorSetData> descriptorSets;
    ccstd::pmr::map<UpdateFrequency, DescriptorSetData> descriptorGroups;
};

struct ShaderBindingData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptorBindings.get_allocator().resource()};
    }

    ShaderBindingData(const allocator_type& alloc); // NOLINT
    ShaderBindingData(ShaderBindingData&& rhs, const allocator_type& alloc);

    ShaderBindingData(ShaderBindingData&& rhs) noexcept = default;
    ShaderBindingData(ShaderBindingData const& rhs) = delete;
    ShaderBindingData& operator=(ShaderBindingData&& rhs) noexcept = default;
    ShaderBindingData& operator=(ShaderBindingData const& rhs) = delete;

    PmrFlatMap<NameLocalID, uint32_t> descriptorBindings;
};

struct ShaderLayoutData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {layoutData.get_allocator().resource()};
    }

    ShaderLayoutData(const allocator_type& alloc); // NOLINT
    ShaderLayoutData(ShaderLayoutData&& rhs, const allocator_type& alloc);

    ShaderLayoutData(ShaderLayoutData&& rhs) noexcept = default;
    ShaderLayoutData(ShaderLayoutData const& rhs) = delete;
    ShaderLayoutData& operator=(ShaderLayoutData&& rhs) noexcept = default;
    ShaderLayoutData& operator=(ShaderLayoutData const& rhs) = delete;

    ccstd::pmr::map<UpdateFrequency, DescriptorSetLayoutData> layoutData;
    ccstd::pmr::map<UpdateFrequency, ShaderBindingData> bindingData;
};

struct TechniqueData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {passes.get_allocator().resource()};
    }

    TechniqueData(const allocator_type& alloc); // NOLINT
    TechniqueData(TechniqueData&& rhs, const allocator_type& alloc);

    TechniqueData(TechniqueData&& rhs) noexcept = default;
    TechniqueData(TechniqueData const& rhs) = delete;
    TechniqueData& operator=(TechniqueData&& rhs) noexcept = default;
    TechniqueData& operator=(TechniqueData const& rhs) = delete;

    ccstd::pmr::vector<ShaderLayoutData> passes;
};

struct EffectData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {techniques.get_allocator().resource()};
    }

    EffectData(const allocator_type& alloc); // NOLINT
    EffectData(EffectData&& rhs, const allocator_type& alloc);

    EffectData(EffectData&& rhs) noexcept = default;
    EffectData(EffectData const& rhs) = delete;
    EffectData& operator=(EffectData&& rhs) noexcept = default;
    EffectData& operator=(EffectData const& rhs) = delete;

    ccstd::pmr::map<ccstd::pmr::string, TechniqueData> techniques;
};

struct ShaderProgramData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {layout.get_allocator().resource()};
    }

    ShaderProgramData(const allocator_type& alloc); // NOLINT
    ShaderProgramData(ShaderProgramData&& rhs, const allocator_type& alloc);

    ShaderProgramData(ShaderProgramData&& rhs) noexcept = default;
    ShaderProgramData(ShaderProgramData const& rhs) = delete;
    ShaderProgramData& operator=(ShaderProgramData&& rhs) noexcept = default;
    ShaderProgramData& operator=(ShaderProgramData const& rhs) = delete;

    PipelineLayoutData layout;
    IntrusivePtr<gfx::PipelineLayout> pipelineLayout;
};

struct RenderStageData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {descriptorVisibility.get_allocator().resource()};
    }

    RenderStageData(const allocator_type& alloc); // NOLINT
    RenderStageData(RenderStageData&& rhs, const allocator_type& alloc);

    RenderStageData(RenderStageData&& rhs) noexcept = default;
    RenderStageData(RenderStageData const& rhs) = delete;
    RenderStageData& operator=(RenderStageData&& rhs) noexcept = default;
    RenderStageData& operator=(RenderStageData const& rhs) = delete;

    PmrUnorderedMap<NameLocalID, gfx::ShaderStageFlagBit> descriptorVisibility;
};

struct RenderPhaseData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {rootSignature.get_allocator().resource()};
    }

    RenderPhaseData(const allocator_type& alloc); // NOLINT
    RenderPhaseData(RenderPhaseData&& rhs, const allocator_type& alloc);

    RenderPhaseData(RenderPhaseData&& rhs) noexcept = default;
    RenderPhaseData(RenderPhaseData const& rhs) = delete;
    RenderPhaseData& operator=(RenderPhaseData&& rhs) noexcept = default;
    RenderPhaseData& operator=(RenderPhaseData const& rhs) = delete;

    ccstd::pmr::string rootSignature;
    ccstd::pmr::vector<ShaderProgramData> shaderPrograms;
    PmrTransparentMap<ccstd::pmr::string, uint32_t> shaderIndex;
    IntrusivePtr<gfx::PipelineLayout> pipelineLayout;
};

struct LayoutGraphData {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->handles.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit LayoutGraphData(const allocator_type& alloc) : handles(alloc), links(alloc), names(alloc), updateFrequencies(alloc), layouts(alloc), stages(alloc), phases(alloc), valueNames(alloc), attributeIndex(alloc), constantIndex(alloc), shaderLayoutIndex(alloc), effects(alloc) {}
    LayoutGraphData(const LayoutGraphData& rhs, const allocator_type& alloc) = delete;
    LayoutGraphData(LayoutGraphData&& rhs, const allocator_type& alloc);
    LayoutGraphData(LayoutGraphData&&) noexcept = default;
    LayoutGraphData(const LayoutGraphData&) = delete;
    LayoutGraphData& operator=(LayoutGraphData&&) noexcept = default;
    LayoutGraphData& operator=(const LayoutGraphData&) = delete;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using TreeEdge = graph::TreeEdge<vertex_descriptor>;
    using out_edge_iterator = graph::ChildIterator<edge_descriptor, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::ParentLinkIterator<edge_descriptor>;

    // AdjacencyGraph types
    using adjacency_iterator = graph::ChildIterator<edge_descriptor, true>;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // PolymorphicGraph types
    enum class Kind : uint8_t {
        RenderStage, // NOLINT(readability-identifier-naming)
        RenderPhase  // NOLINT(readability-identifier-naming)
    };

    // ReferenceGraph types
    using ownership_descriptor = edge_descriptor;
    using children_iterator = out_edge_iterator;
    using parent_iterator = in_edge_iterator;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }                                  // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }                                  // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { return child_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor out_degree(vertex_descriptor v) const noexcept { return num_children(v); }                     // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u != null_vertex() && static_cast<std::uintmax_t>(v) < this->links.size() && get_parent(v) == u) return {{u, v}, true};
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { return parent_links(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor in_degree(vertex_descriptor v) const noexcept { return num_parents(v); }                      // NOLINT(readability-identifier-naming)
    vertex_descriptor degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    graph::IteratorRange<adjacency_iterator> adjacent_vertices(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->names.size()); } // NOLINT(readability-identifier-naming)

    // MutableGraph
    vertex_descriptor add_vertex(const RenderStage_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    vertex_descriptor add_vertex(const RenderPhase_& tag, std::string_view value = {}, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)

    template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2,
              std::enable_if_t<std::is_same_v<Tag, RenderStage_> ||
                                   std::is_same_v<Tag, RenderPhase_>,
                               int> = 0,
              class = std::void_t<typename std::tuple_size<std::decay_t<PayloadArgs>>::type,
                                  typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type,
                                  typename std::tuple_size<std::decay_t<Args2>>::type>>
    vertex_descriptor add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsUpdate, Args2&& argsLayout, vertex_descriptor parent = null_vertex()); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                                                                                                              // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                                                                                                                              // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ccstd::pmr::string& getName(vertex_descriptor v) noexcept { return this->names[v]; }
    ccstd::pmr::string& get(const Name_& /*tag*/, vertex_descriptor v) noexcept { return getName(v); }

    ccstd::pmr::string const& getName(vertex_descriptor v) const noexcept { return this->names[v]; }
    ccstd::pmr::string const& get(const Name_& /*tag*/, vertex_descriptor v) const noexcept { return getName(v); }

    UpdateFrequency& getUpdate(vertex_descriptor v) noexcept { return this->updateFrequencies[v]; }
    UpdateFrequency& get(const Update_& /*tag*/, vertex_descriptor v) noexcept { return getUpdate(v); }

    UpdateFrequency const& getUpdate(vertex_descriptor v) const noexcept { return this->updateFrequencies[v]; }
    UpdateFrequency const& get(const Update_& /*tag*/, vertex_descriptor v) const noexcept { return getUpdate(v); }

    PipelineLayoutData& getLayout(vertex_descriptor v) noexcept { return this->layouts[v]; }
    PipelineLayoutData& get(const Layout_& /*tag*/, vertex_descriptor v) noexcept { return getLayout(v); }

    PipelineLayoutData const& getLayout(vertex_descriptor v) const noexcept { return this->layouts[v]; }
    PipelineLayoutData const& get(const Layout_& /*tag*/, vertex_descriptor v) const noexcept { return getLayout(v); }

    // PolymorphicGraph
    Kind kind(vertex_descriptor v) const { return this->handles.at(v).kind; }
    template <class Tag>
    bool holds(vertex_descriptor v) const noexcept {
        if (static_cast<std::uintmax_t>(v) >= this->handles.size()) return false;
        if constexpr (std::is_same_v<Tag, RenderStage_>) {
            return this->handles[v].kind == Kind::RenderStage;
        } else {
            static_assert(std::is_same_v<Tag, RenderPhase_>, "unknown graph tag");
            return this->handles[v].kind == Kind::RenderPhase;
        }
    }
    RenderStageData& value(const RenderStage_& /*tag*/, vertex_descriptor v) {
        if (!holds<RenderStage_>(v)) throw std::bad_variant_access{};
        return this->stages[this->handles[v].index];
    }
    RenderStageData const& value(const RenderStage_& /*tag*/, vertex_descriptor v) const {
        if (!holds<RenderStage_>(v)) throw std::bad_variant_access{};
        return this->stages[this->handles[v].index];
    }
    RenderPhaseData& value(const RenderPhase_& /*tag*/, vertex_descriptor v) {
        if (!holds<RenderPhase_>(v)) throw std::bad_variant_access{};
        return this->phases[this->handles[v].index];
    }
    RenderPhaseData const& value(const RenderPhase_& /*tag*/, vertex_descriptor v) const {
        if (!holds<RenderPhase_>(v)) throw std::bad_variant_access{};
        return this->phases[this->handles[v].index];
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RenderStage: return std::forward<Visitor>(visitor)(this->stages[handle.index]);
                case Kind::RenderPhase: return std::forward<Visitor>(visitor)(this->phases[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    template <class Visitor, class... Others>
    decltype(auto) visit_vertex(vertex_descriptor v, Visitor&& visitor, Others&&... others) const { // NOLINT(readability-identifier-naming)
        if constexpr (sizeof...(others) > 0) {
            auto handlers = overloaded{std::forward<Visitor>(visitor), std::forward<Others>(others)...};
            return this->visit_vertex(v, handlers);
        } else {
            const auto& handle = this->handles.at(v);
            switch (handle.kind) {
                case Kind::RenderStage: return std::forward<Visitor>(visitor)(this->stages[handle.index]);
                case Kind::RenderPhase: return std::forward<Visitor>(visitor)(this->phases[handle.index]);
            }
            throw std::bad_variant_access{};
        }
    }

    // ReferenceGraph
    vertex_descriptor child(ownership_descriptor link) const noexcept { return link.target; }                                   // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor get_parent(vertex_descriptor v) const noexcept { return v == null_vertex() ? v : this->links[v].parent; } // NOLINT(readability-identifier-naming)
    vertex_descriptor num_children(vertex_descriptor v) const noexcept { return this->links[v].childCount; }                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<children_iterator> child_links(vertex_descriptor v) const noexcept {                                   // NOLINT(readability-identifier-naming)
        const auto* rows = links.data();
        return {{rows, rows[v].firstChild}, {rows, null_vertex()}};
    }
    vertex_descriptor parent(ownership_descriptor e) const noexcept { return e.source; }                                                            // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor num_parents(vertex_descriptor v) const noexcept { return get_parent(v) != null_vertex(); }                                    // NOLINT(readability-identifier-naming)
    graph::IteratorRange<parent_iterator> parent_links(vertex_descriptor v) const noexcept { return {{{get_parent(v), v}}, {{null_vertex(), v}}}; } // NOLINT(readability-identifier-naming)
    bool has_link(vertex_descriptor u, vertex_descriptor v) const noexcept { return edge(u, v).second; }                                            // NOLINT(readability-identifier-naming)

    // ParentGraph
    vertex_descriptor locate_child(vertex_descriptor parent, std::string_view name) const noexcept; // NOLINT(readability-identifier-naming)

    // AddressableGraph
    vertex_descriptor locate(std::string_view refPath, vertex_descriptor start = null_vertex()) const noexcept;
    bool exists(std::string_view refPath, vertex_descriptor start = null_vertex()) const noexcept {
        return locate(refPath, start) != null_vertex();
    }
    ccstd::pmr::string path(vertex_descriptor v) const;

    struct VertexHandle {
        Kind kind;
        vertex_descriptor index;
    };

    ccstd::pmr::vector<VertexHandle> handles;
    ccstd::pmr::vector<TreeEdge> links;
    ccstd::pmr::vector<ccstd::pmr::string> names;
    ccstd::pmr::vector<UpdateFrequency> updateFrequencies;
    ccstd::pmr::vector<PipelineLayoutData> layouts;
    ccstd::pmr::vector<RenderStageData> stages;
    ccstd::pmr::vector<RenderPhaseData> phases;
    ccstd::pmr::vector<ccstd::pmr::string> valueNames;
    PmrFlatMap<ccstd::pmr::string, NameLocalID> attributeIndex;
    PmrFlatMap<ccstd::pmr::string, NameLocalID> constantIndex;
    PmrFlatMap<ccstd::pmr::string, uint32_t> shaderLayoutIndex;
    PmrFlatMap<ccstd::pmr::string, EffectData> effects;
    ccstd::string constantMacros;
};

template <class Tag, class PayloadArgs, class Args0, class Args1,
          std::enable_if_t<std::is_same_v<Tag, RenderStage_> ||
                               std::is_same_v<Tag, RenderPhase_>,
                           int>,
          class>
LayoutGraph::vertex_descriptor LayoutGraph::add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsDescriptors, vertex_descriptor parent) {
    if (parent != null_vertex() && static_cast<std::uintmax_t>(parent) >= this->names.size()) {
        throw std::out_of_range("invalid LayoutGraph parent");
    }
    if (this->names.size() >= (std::numeric_limits<LayoutGraph::vertex_descriptor>::max)()) {
        throw std::length_error("LayoutGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<LayoutGraph::vertex_descriptor>(this->names.size());
    auto& edges = this->links;
    try {
        std::apply(
            [&](auto&&... args) {
                this->names.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsName));
        std::apply(
            [&](auto&&... args) {
                this->descriptors.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsDescriptors));
        edges.push_back(TreeEdge{parent});
        if constexpr (std::is_same_v<Tag, RenderStage_>) {
            this->handles.push_back({Kind::RenderStage, static_cast<LayoutGraph::vertex_descriptor>(this->stages.size())});
            std::apply(
                [&](auto&&... args) {
                    this->stages.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else {
            this->handles.push_back({Kind::RenderPhase, static_cast<LayoutGraph::vertex_descriptor>(this->phases.size())});
            std::apply(
                [&](auto&&... args) {
                    this->phases.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        }
    } catch (...) {
        if (this->names.size() > vertex) this->names.pop_back();
        if (this->descriptors.size() > vertex) this->descriptors.pop_back();
        if (this->links.size() > vertex) this->links.pop_back();
        if (this->handles.size() > vertex) this->handles.pop_back();
        throw;
    }
    if (parent != null_vertex()) {
        auto& parentLinks = edges[parent];
        if (parentLinks.lastChild == null_vertex()) {
            parentLinks.firstChild = vertex;
        } else {
            edges[parentLinks.lastChild].nextSibling = vertex;
        }
        parentLinks.lastChild = vertex;
        ++parentLinks.childCount;
    }
    return vertex;
}

template <class Tag, class PayloadArgs, class Args0, class Args1, class Args2,
          std::enable_if_t<std::is_same_v<Tag, RenderStage_> ||
                               std::is_same_v<Tag, RenderPhase_>,
                           int>,
          class>
LayoutGraphData::vertex_descriptor LayoutGraphData::add_vertex(const Tag& /*tag*/, std::piecewise_construct_t /*piecewise*/, PayloadArgs&& payloadArgs, Args0&& argsName, Args1&& argsUpdate, Args2&& argsLayout, vertex_descriptor parent) {
    if (parent != null_vertex() && static_cast<std::uintmax_t>(parent) >= this->names.size()) {
        throw std::out_of_range("invalid LayoutGraphData parent");
    }
    if (this->names.size() >= (std::numeric_limits<LayoutGraphData::vertex_descriptor>::max)()) {
        throw std::length_error("LayoutGraphData vertex limit exceeded");
    }
    const auto vertex = static_cast<LayoutGraphData::vertex_descriptor>(this->names.size());
    auto& edges = this->links;
    try {
        std::apply(
            [&](auto&&... args) {
                this->names.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsName));
        std::apply(
            [&](auto&&... args) {
                this->updateFrequencies.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsUpdate));
        std::apply(
            [&](auto&&... args) {
                this->layouts.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args2>(argsLayout));
        edges.push_back(TreeEdge{parent});
        if constexpr (std::is_same_v<Tag, RenderStage_>) {
            this->handles.push_back({Kind::RenderStage, static_cast<LayoutGraphData::vertex_descriptor>(this->stages.size())});
            std::apply(
                [&](auto&&... args) {
                    this->stages.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        } else {
            this->handles.push_back({Kind::RenderPhase, static_cast<LayoutGraphData::vertex_descriptor>(this->phases.size())});
            std::apply(
                [&](auto&&... args) {
                    this->phases.emplace_back(std::forward<decltype(args)>(args)...);
                },
                std::forward<PayloadArgs>(payloadArgs));
        }
    } catch (...) {
        if (this->names.size() > vertex) this->names.pop_back();
        if (this->updateFrequencies.size() > vertex) this->updateFrequencies.pop_back();
        if (this->layouts.size() > vertex) this->layouts.pop_back();
        if (this->links.size() > vertex) this->links.pop_back();
        if (this->handles.size() > vertex) this->handles.pop_back();
        throw;
    }
    if (parent != null_vertex()) {
        auto& parentLinks = edges[parent];
        if (parentLinks.lastChild == null_vertex()) {
            parentLinks.firstChild = vertex;
        } else {
            edges[parentLinks.lastChild].nextSibling = vertex;
        }
        parentLinks.lastChild = vertex;
        ++parentLinks.childCount;
    }
    return vertex;
}

} // namespace render

} // namespace cc

namespace ccstd {

inline hash_t hash<cc::render::NameLocalID>::operator()(const cc::render::NameLocalID& val) const noexcept {
    hash_t seed = 0;
    hash_combine(seed, val.value);
    return seed;
}

} // namespace ccstd
