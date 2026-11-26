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
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <tuple>
#include <type_traits>
#include <utility>
#include "FGDispatcherFwd.h"
#include "boost/container/pmr/memory_resource.hpp"
#include "cocos/base/GraphDescriptor.h"
#include "cocos/base/GraphEdges.h"
#include "cocos/base/GraphIterator.h"
#include "cocos/base/std/container/string.h"
#include "cocos/base/std/container/unordered_map.h"
#include "cocos/base/std/container/vector.h"
#include "cocos/base/std/hash/hash.h"
#include "cocos/renderer/gfx-base/GFXDef-common.h"
#include "cocos/renderer/gfx-base/GFXDef.h"
#include "cocos/renderer/gfx-base/GFXObject.h"
#include "cocos/renderer/pipeline/custom/LayoutGraphTypes.h"
#include "cocos/renderer/pipeline/custom/RenderGraphTypes.h"
#include "cocos/renderer/pipeline/custom/details/Map.h"
#include "cocos/renderer/pipeline/custom/details/Set.h"
#include "cocos/scene/ReflectionProbe.h"

namespace cc {

namespace render {

struct NullTag {
};

struct ResourceLifeRecord {
    uint32_t start{0};
    uint32_t end{0};
};

struct LeafStatus {
    bool isExternal{false};
    bool needCulling{false};
};

struct AccessStatus {
    gfx::AccessFlagBit accessFlag{gfx::AccessFlagBit::NONE};
    gfx::ResourceRange range;
};

struct ResourceAccessNode {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resourceStatus.get_allocator().resource()};
    }

    ResourceAccessNode(const allocator_type& alloc); // NOLINT
    ResourceAccessNode(ResourceAccessNode&& rhs, const allocator_type& alloc);
    ResourceAccessNode(ResourceAccessNode const& rhs, const allocator_type& alloc);

    ResourceAccessNode(ResourceAccessNode&& rhs) noexcept = default;
    ResourceAccessNode(ResourceAccessNode const& rhs) = delete;
    ResourceAccessNode& operator=(ResourceAccessNode&& rhs) noexcept = default;
    ResourceAccessNode& operator=(ResourceAccessNode const& rhs) = default;

    PmrFlatMap<ccstd::pmr::string, AccessStatus> resourceStatus;
};

struct LayoutAccess {
    gfx::AccessFlagBit prevAccess{gfx::AccessFlagBit::NONE};
    gfx::AccessFlagBit nextAccess{gfx::AccessFlagBit::NONE};
};

struct AttachmentInfo {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {parentName.get_allocator().resource()};
    }

    AttachmentInfo(const allocator_type& alloc); // NOLINT
    AttachmentInfo(AttachmentInfo&& rhs, const allocator_type& alloc);
    AttachmentInfo(AttachmentInfo const& rhs, const allocator_type& alloc);

    AttachmentInfo(AttachmentInfo&& rhs) noexcept = default;
    AttachmentInfo(AttachmentInfo const& rhs) = delete;
    AttachmentInfo& operator=(AttachmentInfo&& rhs) noexcept = default;
    AttachmentInfo& operator=(AttachmentInfo const& rhs) = default;

    ccstd::pmr::string parentName;
    uint32_t attachmentIndex{0};
    uint32_t isResolveView{0};
};

struct FGRenderPassInfo {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {orderedViews.get_allocator().resource()};
    }

    FGRenderPassInfo(const allocator_type& alloc); // NOLINT
    FGRenderPassInfo(FGRenderPassInfo&& rhs, const allocator_type& alloc);
    FGRenderPassInfo(FGRenderPassInfo const& rhs, const allocator_type& alloc);

    FGRenderPassInfo(FGRenderPassInfo&& rhs) noexcept = default;
    FGRenderPassInfo(FGRenderPassInfo const& rhs) = delete;
    FGRenderPassInfo& operator=(FGRenderPassInfo&& rhs) noexcept = default;
    FGRenderPassInfo& operator=(FGRenderPassInfo const& rhs) = default;

    ccstd::vector<LayoutAccess> colorAccesses;
    LayoutAccess dsAccess;
    LayoutAccess dsResolveAccess;
    gfx::RenderPassInfo rpInfo;
    ccstd::pmr::vector<ccstd::pmr::string> orderedViews;
    PmrTransparentMap<ccstd::pmr::string, AttachmentInfo> viewIndex;
    uint32_t resolveCount{0};
    uint32_t uniqueRasterViewCount{0};
};

struct Barrier {
    ResourceGraph::vertex_descriptor resourceID{0xFFFFFFFF};
    gfx::BarrierType type{gfx::BarrierType::FULL};
    gfx::GFXObject *barrier{nullptr};
    RenderGraph::vertex_descriptor beginVert{0xFFFFFFFF};
    RenderGraph::vertex_descriptor endVert{0xFFFFFFFF};
    AccessStatus beginStatus;
    AccessStatus endStatus;
};

struct BarrierNode {
    ccstd::vector<Barrier> frontBarriers;
    ccstd::vector<Barrier> rearBarriers;
};

struct SliceNode {
    bool full{false};
    ccstd::vector<uint32_t> mips;
};

struct TextureNode {
    bool full{false};
    ccstd::vector<SliceNode> slices;
};

struct ResourceNode {
    bool full{false};
    ccstd::vector<TextureNode> planes;
};

struct PassID_ {};
struct PassNode_ {};
struct RenderPassInfo_ {};
struct Barrier_ {};
struct DescID_ {};

struct ResourceAccessGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->outEdges.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit ResourceAccessGraph(const allocator_type& alloc) : outEdges(alloc), inEdges(alloc), passID(alloc), passResource(alloc), rpInfo(alloc), barrier(alloc), componentIndex_(alloc), resourceNames(alloc), resourceIndex(alloc), leafPasses(alloc), culledPasses(alloc), resourceLifeRecord(alloc), topologicalOrder(alloc), resourceAccess(alloc), movedTarget(alloc), movedSourceStatus(alloc), movedTargetStatus(alloc) {}
    ResourceAccessGraph(ResourceAccessGraph&&) = delete;
    ResourceAccessGraph(const ResourceAccessGraph&) = delete;
    ResourceAccessGraph& operator=(ResourceAccessGraph&&) = delete;
    ResourceAccessGraph& operator=(const ResourceAccessGraph&) = delete;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using out_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, true>;

    // AdjacencyGraph types
    using adjacency_iterator = ccstd::pmr::vector<vertex_descriptor>::const_iterator;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // EdgeListGraph types
    using edge_iterator = graph::DirectedEdgeIterator<ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>>>;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }         // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }         // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->outEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t out_degree(vertex_descriptor v) const noexcept { return outEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u < outEdges.size()) {
            const auto& row = outEdges[u];
            if (std::find(row.begin(), row.end(), v) != row.end()) return {{u, v}, true};
        }
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->inEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t in_degree(vertex_descriptor v) const noexcept { return inEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::size_t degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    const auto& adjacent_vertices(vertex_descriptor v) const noexcept { return outEdges[v]; } // NOLINT(readability-identifier-naming)

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->passID.size()); } // NOLINT(readability-identifier-naming)

    // EdgeListGraph
    graph::IteratorRange<edge_iterator> edges() const noexcept {
        return {{outEdges, 0}, {outEdges, outEdges.size()}};
    }
    std::size_t num_edges() const noexcept { // NOLINT(readability-identifier-naming)
        std::size_t count{};
        for (const auto& row : outEdges) count += row.size();
        return count;
    }

    // MutableGraph
    vertex_descriptor add_vertex(RenderGraph::vertex_descriptor key); // NOLINT(readability-identifier-naming)

    template <class Args0, class Args1, class Args2, class Args3,
              class = std::void_t<typename std::tuple_size<std::decay_t<Args0>>::type,
                                  typename std::tuple_size<std::decay_t<Args1>>::type,
                                  typename std::tuple_size<std::decay_t<Args2>>::type,
                                  typename std::tuple_size<std::decay_t<Args3>>::type>>
    vertex_descriptor add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsPassID, Args1&& argsPassNode, Args2&& argsRenderPassInfo, Args3&& argsBarrier); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v);                                                                               // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                                                                                                      // NOLINT(readability-identifier-naming)
    void remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                                                                                               // NOLINT(readability-identifier-naming)
    void reserve(vertex_descriptor capacity);

    // ComponentGraph
    RenderGraph::vertex_descriptor const& getPassID(vertex_descriptor v) const noexcept { return this->passID[v]; }
    RenderGraph::vertex_descriptor const& get(const PassID_& /*tag*/, vertex_descriptor v) const noexcept { return getPassID(v); }

    ResourceAccessNode& getPassNode(vertex_descriptor v) noexcept { return this->passResource[v]; }
    ResourceAccessNode& get(const PassNode_& /*tag*/, vertex_descriptor v) noexcept { return getPassNode(v); }

    ResourceAccessNode const& getPassNode(vertex_descriptor v) const noexcept { return this->passResource[v]; }
    ResourceAccessNode const& get(const PassNode_& /*tag*/, vertex_descriptor v) const noexcept { return getPassNode(v); }

    FGRenderPassInfo& getRenderPassInfo(vertex_descriptor v) noexcept { return this->rpInfo[v]; }
    FGRenderPassInfo& get(const RenderPassInfo_& /*tag*/, vertex_descriptor v) noexcept { return getRenderPassInfo(v); }

    FGRenderPassInfo const& getRenderPassInfo(vertex_descriptor v) const noexcept { return this->rpInfo[v]; }
    FGRenderPassInfo const& get(const RenderPassInfo_& /*tag*/, vertex_descriptor v) const noexcept { return getRenderPassInfo(v); }

    BarrierNode& getBarrier(vertex_descriptor v) noexcept { return this->barrier[v]; }
    BarrierNode& get(const Barrier_& /*tag*/, vertex_descriptor v) noexcept { return getBarrier(v); }

    BarrierNode const& getBarrier(vertex_descriptor v) const noexcept { return this->barrier[v]; }
    BarrierNode const& get(const Barrier_& /*tag*/, vertex_descriptor v) const noexcept { return getBarrier(v); }

    // UuidGraph
    bool contains(RenderGraph::vertex_descriptor key) const noexcept { return find(key) != null_vertex(); }
    vertex_descriptor find(RenderGraph::vertex_descriptor key) const noexcept {
        const auto it = this->componentIndex_.find(key);
        return it == this->componentIndex_.end() ? null_vertex() : it->second;
    }
    vertex_descriptor vertex(RenderGraph::vertex_descriptor key) const { return this->componentIndex_.at(key); }

    ResourceAccessGraph::vertex_descriptor getCurrentID() const noexcept {
        return num_vertices();
    }
    boost::container::pmr::memory_resource *resource() const noexcept {
        return get_allocator().resource();
    }
    LayoutAccess getAccess(ccstd::pmr::string name, RenderGraph::vertex_descriptor vertID);

    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> outEdges;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> inEdges;
    ccstd::pmr::vector<RenderGraph::vertex_descriptor> passID;
    ccstd::pmr::vector<ResourceAccessNode> passResource;
    ccstd::pmr::vector<FGRenderPassInfo> rpInfo;
    ccstd::pmr::vector<BarrierNode> barrier;
    ccstd::pmr::unordered_map<RenderGraph::vertex_descriptor, vertex_descriptor> componentIndex_;
    ccstd::pmr::vector<ccstd::pmr::string> resourceNames;
    PmrUnorderedStringMap<ccstd::pmr::string, uint32_t> resourceIndex;
    ResourceAccessGraph::vertex_descriptor presentPassID{0xFFFFFFFF};
    PmrFlatMap<ResourceAccessGraph::vertex_descriptor, LeafStatus> leafPasses;
    PmrFlatSet<ResourceAccessGraph::vertex_descriptor> culledPasses;
    PmrFlatMap<ccstd::pmr::string, ResourceLifeRecord> resourceLifeRecord;
    ccstd::pmr::vector<ResourceAccessGraph::vertex_descriptor> topologicalOrder;
    PmrTransparentMap<ccstd::pmr::string, PmrFlatMap<uint32_t, AccessStatus>> resourceAccess;
    PmrFlatMap<ccstd::pmr::string, PmrFlatMap<ccstd::pmr::string, ccstd::pmr::string>> movedTarget;
    PmrFlatMap<ccstd::pmr::string, AccessStatus> movedSourceStatus;
    PmrFlatMap<ccstd::pmr::string, ResourceNode> movedTargetStatus;
};

struct RelationGraph {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { return {this->outEdges.get_allocator().resource()}; } // NOLINT(readability-identifier-naming)

    explicit RelationGraph(const allocator_type& alloc) : outEdges(alloc), inEdges(alloc), descID(alloc), componentIndex_(alloc) {}
    RelationGraph(RelationGraph&&) = delete;
    RelationGraph(const RelationGraph&) = delete;
    RelationGraph& operator=(RelationGraph&&) = delete;
    RelationGraph& operator=(const RelationGraph&) = delete;

    // Graph types
    using vertex_descriptor = uint32_t;
    using edge_descriptor = graph::EdgeDescriptor<vertex_descriptor>;

    // IncidenceGraph types
    using out_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, false>;

    // BidirectionalGraph types
    using in_edge_iterator = graph::IncidentEdgeIterator<ccstd::pmr::vector<vertex_descriptor>, true>;

    // AdjacencyGraph types
    using adjacency_iterator = ccstd::pmr::vector<vertex_descriptor>::const_iterator;

    // VertexListGraph types
    using vertex_iterator = graph::VertexIterator<vertex_descriptor>;

    // EdgeListGraph types
    using edge_iterator = graph::DirectedEdgeIterator<ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>>>;

    // Graph
    static constexpr vertex_descriptor null_vertex() noexcept { return (std::numeric_limits<vertex_descriptor>::max)(); } // NOLINT(readability-identifier-naming)

    // IncidenceGraph
    vertex_descriptor source(edge_descriptor e) const noexcept { return e.source; }         // NOLINT(readability-convert-member-functions-to-static)
    vertex_descriptor target(edge_descriptor e) const noexcept { return e.target; }         // NOLINT(readability-convert-member-functions-to-static)
    graph::IteratorRange<out_edge_iterator> out_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->outEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t out_degree(vertex_descriptor v) const noexcept { return outEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> edge(vertex_descriptor u, vertex_descriptor v) const noexcept {
        if (u < outEdges.size()) {
            const auto& row = outEdges[u];
            if (std::find(row.begin(), row.end(), v) != row.end()) return {{u, v}, true};
        }
        return {{null_vertex(), null_vertex()}, false};
    }

    // BidirectionalGraph
    graph::IteratorRange<in_edge_iterator> in_edges(vertex_descriptor v) const noexcept { // NOLINT(readability-identifier-naming)
        const auto& neighbors = this->inEdges[v];
        return {{v, neighbors.begin()}, {v, neighbors.end()}};
    }
    std::size_t in_degree(vertex_descriptor v) const noexcept { return inEdges[v].size(); } // NOLINT(readability-identifier-naming)
    std::size_t degree(vertex_descriptor v) const noexcept { return in_degree(v) + out_degree(v); }

    // AdjacencyGraph
    const auto& adjacent_vertices(vertex_descriptor v) const noexcept { return outEdges[v]; } // NOLINT(readability-identifier-naming)

    // VertexListGraph
    graph::VertexRange<vertex_descriptor> vertices() const noexcept { return {vertex_iterator(num_vertices())}; }
    vertex_descriptor num_vertices() const noexcept { return static_cast<vertex_descriptor>(this->descID.size()); } // NOLINT(readability-identifier-naming)

    // EdgeListGraph
    graph::IteratorRange<edge_iterator> edges() const noexcept {
        return {{outEdges, 0}, {outEdges, outEdges.size()}};
    }
    std::size_t num_edges() const noexcept { // NOLINT(readability-identifier-naming)
        std::size_t count{};
        for (const auto& row : outEdges) count += row.size();
        return count;
    }

    // MutableGraph
    vertex_descriptor add_vertex(ResourceAccessGraph::vertex_descriptor key); // NOLINT(readability-identifier-naming)

    template <class Args0,
              class = std::void_t<typename std::tuple_size<std::decay_t<Args0>>::type>>
    vertex_descriptor add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsDescID); // NOLINT(readability-identifier-naming)
    std::pair<edge_descriptor, bool> add_edge(vertex_descriptor u, vertex_descriptor v);        // NOLINT(readability-identifier-naming)
    void remove_edge(edge_descriptor e) noexcept;                                               // NOLINT(readability-identifier-naming)
    void remove_edge(vertex_descriptor u, vertex_descriptor v) noexcept;                        // NOLINT(readability-identifier-naming)
    void reserve(vertex_descriptor capacity);
    void remove_vertex(vertex_descriptor v); // NOLINT(readability-identifier-naming)

    // ComponentGraph
    ResourceAccessGraph::vertex_descriptor const& getDescID(vertex_descriptor v) const noexcept { return this->descID[v]; }
    ResourceAccessGraph::vertex_descriptor const& get(const DescID_& /*tag*/, vertex_descriptor v) const noexcept { return getDescID(v); }

    // UuidGraph
    bool contains(ResourceAccessGraph::vertex_descriptor key) const noexcept { return find(key) != null_vertex(); }
    vertex_descriptor find(ResourceAccessGraph::vertex_descriptor key) const noexcept {
        const auto it = this->componentIndex_.find(key);
        return it == this->componentIndex_.end() ? null_vertex() : it->second;
    }
    vertex_descriptor vertex(ResourceAccessGraph::vertex_descriptor key) const { return this->componentIndex_.at(key); }

    RelationGraph::vertex_descriptor getCurrentID() const noexcept {
        return num_vertices();
    }
    boost::container::pmr::memory_resource *resource() const noexcept {
        return get_allocator().resource();
    }

    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> outEdges;
    ccstd::pmr::vector<ccstd::pmr::vector<vertex_descriptor>> inEdges;
    ccstd::pmr::vector<ResourceAccessGraph::vertex_descriptor> descID;
    ccstd::pmr::unordered_map<ResourceAccessGraph::vertex_descriptor, vertex_descriptor> componentIndex_;
};

struct RenderingInfo {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {clearColors.get_allocator().resource()};
    }

    RenderingInfo(const allocator_type& alloc); // NOLINT
    RenderingInfo(RenderingInfo&& rhs, const allocator_type& alloc);
    RenderingInfo(RenderingInfo const& rhs, const allocator_type& alloc);

    RenderingInfo(RenderingInfo&& rhs) noexcept = default;
    RenderingInfo(RenderingInfo const& rhs) = delete;
    RenderingInfo& operator=(RenderingInfo&& rhs) noexcept = default;
    RenderingInfo& operator=(RenderingInfo const& rhs) = default;

    gfx::RenderPassInfo renderpassInfo;
    gfx::FramebufferInfo framebufferInfo;
    ccstd::pmr::vector<gfx::Color> clearColors;
    float clearDepth{0};
    uint8_t clearStencil{0};
};

struct FrameGraphDispatcher {
    using allocator_type = boost::container::pmr::polymorphic_allocator<char>;
    allocator_type get_allocator() const noexcept { // NOLINT
        return {resourceAccessGraph.get_allocator().resource()};
    }

    FrameGraphDispatcher(ResourceGraph& resourceGraphIn, const RenderGraph& renderGraphIn, const LayoutGraphData& layoutGraphIn, boost::container::pmr::memory_resource* scratchIn, const allocator_type& alloc);
    FrameGraphDispatcher(FrameGraphDispatcher&&) = delete;
    FrameGraphDispatcher(const FrameGraphDispatcher&) = delete;
    FrameGraphDispatcher& operator=(FrameGraphDispatcher&&) = delete;
    FrameGraphDispatcher& operator=(const FrameGraphDispatcher&) = delete;

    void enablePassReorder(bool enable);
    void setParalellWeight(float paralellExecWeight);
    void enableMemoryAliasing(bool enable);
    void run();
    const BarrierNode &getBarrier(RenderGraph::vertex_descriptor u) const;
    const ResourceAccessNode &getAccessNode(RenderGraph::vertex_descriptor u) const;
    const gfx::RenderPassInfo &getRenderPassInfo(RenderGraph::vertex_descriptor u) const;
    RenderingInfo getRenderPassAndFrameBuffer(RenderGraph::vertex_descriptor u, const ResourceGraph &resg) const;
    LayoutAccess getResourceAccess(ResourceGraph::vertex_descriptor r, RenderGraph::vertex_descriptor p) const;
    ResourceGraph::vertex_descriptor realResourceID(const ccstd::pmr::string &name) const;
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> buildDescriptorIndex(const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews, const PmrTransparentMap<ccstd::pmr::string, RasterView> &rasterViews, boost::container::pmr::memory_resource *scratch) const;
    PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> buildDescriptorIndex(const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews, boost::container::pmr::memory_resource *scratch) const;
    void buildDescriptorIndex(const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews, const PmrTransparentMap<ccstd::pmr::string, RasterView> &rasterViews, PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> &resourceIndex) const;
    void buildDescriptorIndex(const PmrTransparentMap<ccstd::pmr::string, ccstd::pmr::vector<ComputeView>> &computeViews, PmrFlatMap<NameLocalID, ResourceGraph::vertex_descriptor> &resourceIndex) const;

    ResourceAccessGraph resourceAccessGraph;
    ResourceGraph &resourceGraph;
    const RenderGraph &renderGraph;
    const LayoutGraphData &layoutGraph;
    boost::container::pmr::memory_resource *scratch{nullptr};
    RelationGraph relationGraph;
    bool _enablePassReorder{false};
    bool _enableAutoBarrier{true};
    bool _enableMemoryAliasing{false};
    bool _accessGraphBuilt{false};
    float _paralellExecWeight{0};
};

template <class Args0, class Args1, class Args2, class Args3, class>
ResourceAccessGraph::vertex_descriptor ResourceAccessGraph::add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsPassID, Args1&& argsPassNode, Args2&& argsRenderPassInfo, Args3&& argsBarrier) {
    if (this->passID.size() >= (std::numeric_limits<ResourceAccessGraph::vertex_descriptor>::max)()) {
        throw std::length_error("ResourceAccessGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<ResourceAccessGraph::vertex_descriptor>(this->passID.size());
    try {
        std::apply(
            [&](auto&&... args) {
                this->passID.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsPassID));
        std::apply(
            [&](auto&&... args) {
                this->passResource.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args1>(argsPassNode));
        std::apply(
            [&](auto&&... args) {
                this->rpInfo.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args2>(argsRenderPassInfo));
        std::apply(
            [&](auto&&... args) {
                this->barrier.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args3>(argsBarrier));
        this->outEdges.emplace_back();
        this->inEdges.emplace_back();
        if (!this->componentIndex_.emplace(this->passID.back(), vertex).second) {
            throw std::invalid_argument("duplicate vertex key");
        }
    } catch (...) {
        if (this->passID.size() > vertex) this->passID.pop_back();
        if (this->passResource.size() > vertex) this->passResource.pop_back();
        if (this->rpInfo.size() > vertex) this->rpInfo.pop_back();
        if (this->barrier.size() > vertex) this->barrier.pop_back();
        if (this->outEdges.size() > vertex) this->outEdges.pop_back();
        if (this->inEdges.size() > vertex) this->inEdges.pop_back();
        throw;
    }
    return vertex;
}

template <class Args0, class>
RelationGraph::vertex_descriptor RelationGraph::add_vertex(std::piecewise_construct_t /*piecewise*/, Args0&& argsDescID) {
    if (this->descID.size() >= (std::numeric_limits<RelationGraph::vertex_descriptor>::max)()) {
        throw std::length_error("RelationGraph vertex limit exceeded");
    }
    const auto vertex = static_cast<RelationGraph::vertex_descriptor>(this->descID.size());
    try {
        std::apply(
            [&](auto&&... args) {
                this->descID.emplace_back(std::forward<decltype(args)>(args)...);
            },
            std::forward<Args0>(argsDescID));
        this->outEdges.emplace_back();
        this->inEdges.emplace_back();
        if (!this->componentIndex_.emplace(this->descID.back(), vertex).second) {
            throw std::invalid_argument("duplicate vertex key");
        }
    } catch (...) {
        if (this->descID.size() > vertex) this->descID.pop_back();
        if (this->outEdges.size() > vertex) this->outEdges.pop_back();
        if (this->inEdges.size() > vertex) this->inEdges.pop_back();
        throw;
    }
    return vertex;
}

} // namespace render

} // namespace cc
