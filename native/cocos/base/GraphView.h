#pragma once // NOLINT(portability-avoid-pragma-once)

#include <iterator>
#include <type_traits>
#include <utility>

namespace cc::graph {

template<class Graph, class Predicate>
class FilteredGraphView;

namespace detail {
// Plain graphs accept every existing vertex. A view can exclude a root supplied by its caller.
template<class Graph, class Vertex>
constexpr bool acceptsVertex(const Graph& /*graph*/, Vertex /*vertex*/) noexcept { return true; }

template<class Graph, class Predicate, class Vertex>
bool acceptsVertex(const FilteredGraphView<Graph, Predicate>& view, Vertex v) { return view.contains_vertex(v); }

// Iterators borrow the view and underlying graph, so DFS can retain them after the range expires.
template<class View, class BaseIterator, bool Edges>
class FilteredRange {
public:
    class Iterator {
    public:
        using iterator_category = std::input_iterator_tag;
        using difference_type = typename std::iterator_traits<BaseIterator>::difference_type;
        using value_type = typename std::iterator_traits<BaseIterator>::value_type;
        using pointer = void;
        using reference = decltype(*std::declval<const BaseIterator&>());

        Iterator() = default;
        Iterator(const View& view, BaseIterator current, BaseIterator last)
        : _view(&view), _current(current), _last(last) { skipExcluded(); }

        reference operator*() const { return *_current; }
        Iterator& operator++() { ++_current; skipExcluded(); return *this; }
        Iterator operator++(int) { auto previous = *this; ++*this; return previous; }
        bool operator==(const Iterator& other) const { return _current == other._current; }
        bool operator!=(const Iterator& other) const { return !(*this == other); }

    private:
        void skipExcluded() {
            while (_current != _last) {
                if constexpr (Edges) {
                    if (_view->contains_vertex(_view->target(*_current))) break;
                } else {
                    if (_view->contains_vertex(*_current)) break;
                }
                ++_current;
            }
        }
        const View* _view{};
        BaseIterator _current{}, _last{};
    };

    FilteredRange(const View& view, BaseIterator first, BaseIterator last)
    : _first(view, first, last), _last(view, last, last) {}
    Iterator begin() const { return _first; }
    Iterator end() const { return _last; }

private:
    Iterator _first, _last;
};

// Only vertex-list graphs supply a vertex iterator. Rooted visits also work without one.
template<class Graph, class FilteredView = void, class = void>
struct ViewVertexList {};

template<class Graph>
struct ViewVertexList<Graph, void, std::void_t<typename Graph::vertex_iterator>> {
    using vertex_iterator = typename Graph::vertex_iterator;
};

template<class Graph, class View>
struct ViewVertexList<Graph, View, std::void_t<typename Graph::vertex_iterator>> {
protected:
    using VertexRange = FilteredRange<View, typename Graph::vertex_iterator, false>;

public:
    using vertex_iterator = typename VertexRange::Iterator;
};
} // namespace detail

// Both views borrow the graph and its descriptors. Give the base graph (or view) a name
// so that it outlives the view and all iterators used during traversal.
template<class Graph>
class ReferenceGraphView : public detail::ViewVertexList<Graph> {
public:
    using edge_descriptor = typename Graph::ownership_descriptor;
    using vertex_descriptor = typename Graph::vertex_descriptor;
    using out_edge_iterator = typename Graph::children_iterator;

    explicit ReferenceGraphView(const Graph& graph) noexcept : _graph(graph) {}
    ReferenceGraphView(const Graph&&) = delete;

    decltype(auto) vertices() const { return _graph.vertices(); }
    auto num_vertices() const { return _graph.num_vertices(); } // NOLINT(readability-identifier-naming)
    decltype(auto) out_edges(vertex_descriptor v) const { return _graph.child_links(v); } // NOLINT(readability-identifier-naming)
    auto out_degree(vertex_descriptor v) const { return _graph.num_children(v); } // NOLINT(readability-identifier-naming)
    vertex_descriptor source(edge_descriptor link) const { return _graph.parent(link); }
    vertex_descriptor target(edge_descriptor link) const { return _graph.child(link); }

private:
    const Graph& _graph;
};

template<class Graph, class Predicate>
class FilteredGraphView : public detail::ViewVertexList<Graph, FilteredGraphView<Graph, Predicate>> {
    using EdgeRange = detail::FilteredRange<FilteredGraphView, typename Graph::out_edge_iterator, true>;

public:
    using edge_descriptor = typename Graph::edge_descriptor;
    using vertex_descriptor = typename Graph::vertex_descriptor;
    using out_edge_iterator = typename EdgeRange::Iterator;

    FilteredGraphView(const Graph& graph, Predicate keep) : _graph(graph), _keep(std::move(keep)) {}
    FilteredGraphView(const Graph&&, Predicate) = delete;

    // v must be a vertex of the underlying graph. Predicates see original vertex IDs.
    bool contains_vertex(vertex_descriptor v) const { // NOLINT(readability-identifier-naming)
        return detail::acceptsVertex(_graph, v) && _keep(v);
    }
    vertex_descriptor source(edge_descriptor e) const { return _graph.source(e); }
    vertex_descriptor target(edge_descriptor e) const { return _graph.target(e); }

    auto vertices() const {
        const auto& vertices = _graph.vertices();
        return typename FilteredGraphView::VertexRange{*this, vertices.begin(), vertices.end()};
    }
    auto out_edges(vertex_descriptor v) const { // NOLINT(readability-identifier-naming)
        const auto& edges = _graph.out_edges(v);
        return EdgeRange{*this, contains_vertex(v) ? edges.begin() : edges.end(), edges.end()};
    }

private:
    const Graph& _graph;
    Predicate _keep;
};

} // namespace cc::graph
