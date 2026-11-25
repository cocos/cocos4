#pragma once // NOLINT(portability-avoid-pragma-once)

#include "GraphDescriptor.h"

#include <cstddef>
#include <iterator>

namespace cc::graph {

template<class Row, bool Incoming>
class IncidentEdgeIterator {
    using Vertex = typename Row::value_type;
    using NeighborIterator = typename Row::const_iterator;

public:
    using value_type = EdgeDescriptor<Vertex>;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    IncidentEdgeIterator() = default;
    IncidentEdgeIterator(Vertex vertex, NeighborIterator current) noexcept : _vertex(vertex), _current(current) {}

    value_type operator*() const noexcept {
        if constexpr (Incoming) {
            return {*_current, _vertex};
        } else {
            return {_vertex, *_current};
        }
    }
    IncidentEdgeIterator& operator++() noexcept {
        ++_current;
        return *this;
    }
    IncidentEdgeIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(const IncidentEdgeIterator& rhs) const noexcept {
        return _vertex == rhs._vertex && _current == rhs._current;
    }
    bool operator!=(const IncidentEdgeIterator& rhs) const noexcept { return !(*this == rhs); }

private:
    Vertex _vertex{};
    NeighborIterator _current{};
};

// Visit all outgoing rows of a graph that declares edge_list_graph.
template<class Rows>
class DirectedEdgeIterator {
    using Vertex = typename Rows::value_type::value_type;

public:
    using value_type = EdgeDescriptor<Vertex>;
    using difference_type = std::ptrdiff_t;
    using iterator_category = std::input_iterator_tag;
    using pointer = void;
    using reference = value_type;

    DirectedEdgeIterator() = default;
    DirectedEdgeIterator(const Rows& rows, std::size_t first) noexcept : _rows(&rows), _row(first) { skipEmpty(); }

    value_type operator*() const noexcept { return {static_cast<Vertex>(_row), (*_rows)[_row][_offset]}; }
    DirectedEdgeIterator& operator++() noexcept {
        ++_offset;
        skipEmpty();
        return *this;
    }
    DirectedEdgeIterator operator++(int) noexcept {
        auto previous = *this;
        ++*this;
        return previous;
    }
    bool operator==(const DirectedEdgeIterator& rhs) const noexcept {
        return _rows == rhs._rows && _row == rhs._row && _offset == rhs._offset;
    }
    bool operator!=(const DirectedEdgeIterator& rhs) const noexcept { return !(*this == rhs); }

private:
    void skipEmpty() noexcept {
        while (_row < _rows->size() && _offset == (*_rows)[_row].size()) {
            ++_row;
            _offset = 0;
        }
    }

    const Rows* _rows{};
    std::size_t _row{};
    std::size_t _offset{};
};

} // namespace cc::graph
