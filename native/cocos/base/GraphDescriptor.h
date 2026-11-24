#pragma once

namespace cc::graph {

template<class Vertex>
struct EdgeDescriptor {
    Vertex source;
    Vertex target;

    constexpr bool operator==(const EdgeDescriptor& rhs) const noexcept {
        return source == rhs.source && target == rhs.target;
    }
    constexpr bool operator!=(const EdgeDescriptor& rhs) const noexcept {
        return !(*this == rhs);
    }
};

} // namespace cc::graph
