#pragma once // NOLINT(portability-avoid-pragma-once)

#include <cstddef>
#include <iterator>
#include <limits>
#include <type_traits>

namespace cc::graph {

template<class Iterator>
struct IteratorRange {
    Iterator first, last;

    Iterator begin() const noexcept { return first; }
    Iterator end() const noexcept { return last; }
};

template<class Vertex>
class VertexIterator {
public:
    using value_type = Vertex;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    VertexIterator() = default;
    explicit VertexIterator(Vertex value) noexcept : _current(value) {}

    Vertex operator*() const noexcept { return _current; }
    VertexIterator& operator++() noexcept {
        ++_current;
        return *this;
    }
    VertexIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(VertexIterator rhs) const noexcept { return _current == rhs._current; }
    bool operator!=(VertexIterator rhs) const noexcept { return !(*this == rhs); }

private:
    Vertex _current{};
};

template<class Vertex>
struct VertexRange {
    VertexIterator<Vertex> last;

    VertexIterator<Vertex> begin() const noexcept { return {}; }
    VertexIterator<Vertex> end() const noexcept { return last; }
};

template<class Vertex>
struct TreeEdge {
    Vertex parent{(std::numeric_limits<Vertex>::max)()};
    Vertex firstChild{(std::numeric_limits<Vertex>::max)()};
    Vertex lastChild{(std::numeric_limits<Vertex>::max)()};
    Vertex nextSibling{(std::numeric_limits<Vertex>::max)()};
    Vertex childCount{};
};

// Children are linked in sibling order. Adjacency traversal yields just the child descriptor.
// Reallocating the link rows invalidates these iterators, including the end iterator.
template<class Link, bool Adjacent>
class ChildIterator {
    using Vertex = decltype(Link::target);

public:
    using value_type = std::conditional_t<Adjacent, Vertex, Link>;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    ChildIterator() = default;
    ChildIterator(const TreeEdge<Vertex>* rows, Vertex v) noexcept : _rows(rows), _current(v) {}

    value_type operator*() const noexcept {
        if constexpr (Adjacent) {
            return _current;
        } else {
            return {_rows[_current].parent, _current};
        }
    }
    ChildIterator& operator++() noexcept {
        _current = _rows[_current].nextSibling;
        return *this;
    }
    ChildIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(const ChildIterator& rhs) const noexcept {
        return _rows == rhs._rows && _current == rhs._current;
    }
    bool operator!=(const ChildIterator& rhs) const noexcept { return !(*this == rhs); }

private:
    const TreeEdge<Vertex>* _rows{};
    Vertex _current{(std::numeric_limits<Vertex>::max)()};
};

template<class LinkType>
struct ParentLinkIterator {
    using Link = LinkType;
    using Vertex = decltype(Link::source);
    using value_type = Link;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    Link link{(std::numeric_limits<Vertex>::max)(), (std::numeric_limits<Vertex>::max)()};

    Link operator*() const noexcept { return link; }
    ParentLinkIterator& operator++() noexcept {
        link.source = (std::numeric_limits<Vertex>::max)();
        return *this;
    }
    ParentLinkIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(const ParentLinkIterator& rhs) const noexcept {
        return link.source == rhs.link.source && link.target == rhs.link.target;
    }
    bool operator!=(const ParentLinkIterator& rhs) const noexcept { return !(*this == rhs); }
};

// Visit sources in vertex order, and each source's outgoing edges in sibling order.
template<class Link, class Rows>
class EdgeIterator {
    using Vertex = decltype(Link::source);

public:
    using value_type = Link;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    EdgeIterator() = default;
    EdgeIterator(const Rows& rows, Vertex first) noexcept : _rows(&rows), _source(first) { seek(); }

    Link operator*() const noexcept { return {_source, _target}; }
    EdgeIterator& operator++() noexcept {
        _target = (*_rows)[_target].nextSibling;
        if (_target == (std::numeric_limits<Vertex>::max)()) {
            ++_source;
            seek();
        }
        return *this;
    }
    EdgeIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(const EdgeIterator& rhs) const noexcept {
        return _rows == rhs._rows && _source == rhs._source && _target == rhs._target;
    }
    bool operator!=(const EdgeIterator& rhs) const noexcept { return !(*this == rhs); }

private:
    void seek() noexcept {
        const auto& rows = *_rows;
        while (_source < rows.size()) {
            _target = rows[_source].firstChild;
            if (_target != (std::numeric_limits<Vertex>::max)()) break;
            ++_source;
        }
    }

    const Rows* _rows{};
    Vertex _source{}, _target{(std::numeric_limits<Vertex>::max)()};
};

} // namespace cc::graph
