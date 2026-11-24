#pragma once // NOLINT(portability-avoid-pragma-once)

#include "GraphView.h"
#include "cocos/base/std/container/vector.h"

#include <boost/container/pmr/global_resource.hpp>
#include <cstdint>
#include <optional>
#include <tuple>
#include <utility>

namespace cc::graph {

enum class GraphColor : std::uint8_t { WHITE, GRAY, BLACK };

struct DefaultDfsVisitor {
    template<class V, class G> void initializeVertex(V /*vertex*/, const G& /*graph*/) {}
    template<class V, class G> void startVertex(V /*vertex*/, const G& /*graph*/) {}
    template<class V, class G> void discoverVertex(V /*vertex*/, const G& /*graph*/) {}
    template<class E, class G> void examineEdge(const E& /*edge*/, const G& /*graph*/) {}
    template<class E, class G> void treeEdge(const E& /*edge*/, const G& /*graph*/) {}
    template<class E, class G> void backEdge(const E& /*edge*/, const G& /*graph*/) {}
    template<class E, class G> void forwardOrCrossEdge(const E& /*edge*/, const G& /*graph*/) {}
    template<class E, class G> void finishEdge(const E& /*edge*/, const G& /*graph*/) {}
    template<class V, class G> void finishVertex(V /*vertex*/, const G& /*graph*/) {}
};

namespace detail {
struct NeverTerminate {
    template<class V, class G> bool operator()(V /*vertex*/, const G& /*graph*/) const noexcept { return false; }
};

// Out-edge iterators on the active path must remain valid during the visit.
template<class Graph>
using VisitStack = ccstd::pmr::vector<std::tuple<typename Graph::vertex_descriptor,
                                                typename Graph::out_edge_iterator, typename Graph::out_edge_iterator,
                                                std::optional<typename Graph::edge_descriptor>>>;

template<class Graph, class Visitor, class Colors, class Terminator>
void depthFirstVisit(const Graph& graph, typename Graph::vertex_descriptor root, Visitor& visitor,
                     Colors& colors, VisitStack<Graph>& stack, Terminator& terminate) {
    using Vertex = typename Graph::vertex_descriptor;
    using Edge = typename Graph::edge_descriptor;
    const auto finish = [&](Vertex v, const std::optional<Edge>& incoming) {
        colors[v] = GraphColor::BLACK;
        visitor.finishVertex(v, graph);
        if (incoming) visitor.finishEdge(*incoming, graph);
    };
    const auto discover = [&](Vertex v, std::optional<Edge> incoming) {
        colors[v] = GraphColor::GRAY;
        visitor.discoverVertex(v, graph);
        if (terminate(v, graph)) {
            finish(v, incoming);
        } else {
            const auto& edges = graph.out_edges(v);
            stack.emplace_back(v, edges.begin(), edges.end(), std::move(incoming));
        }
    };

    if (!detail::acceptsVertex(graph, root)) return;
    visitor.startVertex(root, graph);
    discover(root, std::nullopt);
    while (!stack.empty()) {
        auto& [vertex, next, end, incoming] = stack.back();
        if (next == end) {
            finish(vertex, incoming);
            stack.pop_back();
            continue;
        }

        const Edge edge = *next;
        ++next;
        visitor.examineEdge(edge, graph);
        const Vertex target = graph.target(edge);
        const auto color = colors[target];
        if (color == GraphColor::WHITE) {
            visitor.treeEdge(edge, graph);
            discover(target, edge);
        } else {
            if (color == GraphColor::GRAY) {
                visitor.backEdge(edge, graph);
            } else {
                visitor.forwardOrCrossEdge(edge, graph);
            }
            visitor.finishEdge(edge, graph);
        }
    }
}
} // namespace detail

// Colors are indexed by vertex. The scratch resource supplies the traversal stack.
template<class Graph, class Visitor, class Colors, class Terminator = detail::NeverTerminate>
void depthFirstVisit(const Graph& graph, typename Graph::vertex_descriptor root, Visitor& visitor,
                     Colors& colors, Terminator terminate = {},
                     boost::container::pmr::memory_resource* scratch = boost::container::pmr::get_default_resource()) {
    detail::VisitStack<Graph> stack{scratch};
    detail::depthFirstVisit(graph, root, visitor, colors, stack, terminate);
}

// With a starting vertex, visit its tree first, then the remaining white roots
// in vertex enumeration order. An empty graph produces no visitor events.
template<class Graph, class Visitor, class Colors>
void depthFirstSearch(const Graph& graph, Visitor& visitor, Colors& colors,
                      std::optional<typename Graph::vertex_descriptor> start = std::nullopt,
                      boost::container::pmr::memory_resource* scratch = boost::container::pmr::get_default_resource()) {
    const auto& vertices = graph.vertices();
    if (vertices.begin() == vertices.end()) return;
    for (const auto v : vertices) {
        colors[v] = GraphColor::WHITE;
        visitor.initializeVertex(v, graph);
    }
    detail::VisitStack<Graph> stack{scratch};
    detail::NeverTerminate terminate;
    if (start) detail::depthFirstVisit(graph, *start, visitor, colors, stack, terminate);
    for (const auto v : graph.vertices()) {
        if (colors[v] == GraphColor::WHITE) detail::depthFirstVisit(graph, v, visitor, colors, stack, terminate);
    }
}

} // namespace cc::graph
