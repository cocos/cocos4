#include "spine-mesh-data.h"
#include <memory>
#include <cassert>

uint8_t* SpineMeshData::vBuf = nullptr;
uint8_t* SpineMeshData::vPtr = nullptr;
uint8_t* SpineMeshData::vEnd = nullptr;
uint16_t* SpineMeshData::iBuf = nullptr;
uint16_t* SpineMeshData::iPtr = nullptr;
uint16_t* SpineMeshData::iEnd = nullptr;

void SpineMeshData::initMeshMemory() {
    if (vBuf) return;
    const auto vCount = 65535;
    const auto byteStride = 7 * sizeof(float);
    vBuf = static_cast<uint8_t*>(::malloc(sizeof(uint8_t) * (2 * vCount * byteStride))); // 2 * 64KB * 28 = 3.5MB
    iBuf = static_cast<uint16_t*>(::malloc(sizeof(uint16_t) * (8 * 65535))); // ~1MB

    vEnd = vBuf ? vBuf + 2 * vCount * byteStride : nullptr;
    iEnd = iBuf ? iBuf + 8 * 65535 : nullptr;

    vPtr = vBuf;
    iPtr = iBuf;
}

void SpineMeshData::releaseMeshMemory() {
    ::free(vBuf);
    vBuf = nullptr;
    
    ::free(iBuf);
    iBuf = nullptr;
    vPtr = vEnd = nullptr;
    iPtr = iEnd = nullptr;
}

void SpineMeshData::reset() {
    vPtr = vBuf;
    iPtr = iBuf;
}

void SpineMeshData::moveVB(uint32_t count) {
    assert(vPtr && count <= static_cast<size_t>(vEnd - vPtr));
    vPtr += count;
}

void SpineMeshData::moveIB(uint32_t count) {
    assert(iPtr && count <= static_cast<size_t>(iEnd - iPtr));
    iPtr += count;
}

uint8_t* SpineMeshData::queryVBuffer() {
    return vPtr;
}

bool SpineMeshData::hasSpace(uint32_t vertexCount, uint32_t indexCount, uint32_t byteStride) {
    // Divide before comparing so a malformed count cannot overflow a byte-size multiplication.
    return vPtr && iPtr && byteStride != 0 &&
        vertexCount <= static_cast<size_t>(vEnd - vPtr) / byteStride &&
        indexCount <= static_cast<size_t>(iEnd - iPtr);
}

uint16_t* SpineMeshData::queryIBuffer() {
    return iPtr;
}

uint8_t* SpineMeshData::vb() {
    return vBuf;
}

uint16_t* SpineMeshData::ib() {
    return iBuf;
}
