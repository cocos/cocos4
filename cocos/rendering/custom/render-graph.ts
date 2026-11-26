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
/* eslint-disable max-len */
import { AccessFlagBit, ClearFlagBit, Color, Format, LoadOp, SampleCount, ShaderStageFlagBit, StoreOp, TextureFlagBit, TextureType, Viewport } from '../../gfx';
import { AdjI, ED, InEI, OneInEI, OutE, OutEI } from './graph';
import { AccessType, AttachmentType, ClearValueType, LightInfo, QueueHint, ResourceDimension, ResourceFlags, ResourceResidency, SceneFlags } from './types';
import type { Material } from '../../asset/assets';
import type { Buffer, Framebuffer, RenderPass, Sampler, SamplerInfo, Swapchain, Texture } from '../../gfx';
import type { RenderScene } from '../../render-scene/core/render-scene';
import type { RenderWindow } from '../../render-scene/core/render-window';
import type { Light, Model } from '../../render-scene/scene';
import type { Camera } from '../../render-scene/scene/camera';
import type { AdjacencyGraph, BidirectionalGraph, ComponentGraph, MutableGraph, MutableReferenceGraph, NamedGraph, PolymorphicGraph, PropertyGraph, ReferenceGraph, UuidGraph, VertexListGraph } from './graph';
import type { CopyPair, MovePair, RenderCommonObjectPool, ResolvePair, UploadPair } from './types';
import { RecyclePool } from '../../core/memop';

export class ClearValue {
    constructor (x = 0, y = 0, z = 0, w = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
    reset (x: number, y: number, z: number, w: number): void {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
    declare x: number;
    declare y: number;
    declare z: number;
    declare w: number;
}

export class RasterView {
    constructor (
        slotName = '',
        accessType: AccessType = AccessType.WRITE,
        attachmentType: AttachmentType = AttachmentType.RENDER_TARGET,
        loadOp: LoadOp = LoadOp.LOAD,
        storeOp: StoreOp = StoreOp.STORE,
        clearFlags: ClearFlagBit = ClearFlagBit.ALL,
        clearColor: Color = new Color(),
        shaderStageFlags: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ) {
        this.slotName = slotName;
        this.accessType = accessType;
        this.attachmentType = attachmentType;
        this.loadOp = loadOp;
        this.storeOp = storeOp;
        this.clearFlags = clearFlags;
        this.clearColor = clearColor;
        this.shaderStageFlags = shaderStageFlags;
    }
    reset (
        slotName: string,
        accessType: AccessType,
        attachmentType: AttachmentType,
        loadOp: LoadOp,
        storeOp: StoreOp,
        clearFlags: ClearFlagBit,
        shaderStageFlags: ShaderStageFlagBit,
    ): void {
        this.slotName = slotName;
        this.slotName1 = '';
        this.accessType = accessType;
        this.attachmentType = attachmentType;
        this.loadOp = loadOp;
        this.storeOp = storeOp;
        this.clearFlags = clearFlags;
        this.clearColor.reset();
        this.slotID = 0;
        this.shaderStageFlags = shaderStageFlags;
    }
    declare slotName: string;
    slotName1 = '';
    declare accessType: AccessType;
    declare attachmentType: AttachmentType;
    declare loadOp: LoadOp;
    declare storeOp: StoreOp;
    declare clearFlags: ClearFlagBit;
    declare readonly clearColor: Color;
    slotID = 0;
    declare shaderStageFlags: ShaderStageFlagBit;
}

export class ComputeView {
    constructor (
        name = '',
        accessType: AccessType = AccessType.READ,
        clearFlags: ClearFlagBit = ClearFlagBit.NONE,
        clearValueType: ClearValueType = ClearValueType.NONE,
        clearValue: ClearValue = new ClearValue(),
        shaderStageFlags: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ) {
        this.name = name;
        this.accessType = accessType;
        this.clearFlags = clearFlags;
        this.clearValueType = clearValueType;
        this.clearValue = clearValue;
        this.shaderStageFlags = shaderStageFlags;
    }
    reset (
        name: string,
        accessType: AccessType,
        clearFlags: ClearFlagBit,
        clearValueType: ClearValueType,
        shaderStageFlags: ShaderStageFlagBit,
    ): void {
        this.name = name;
        this.accessType = accessType;
        this.plane = 0;
        this.clearFlags = clearFlags;
        this.clearValueType = clearValueType;
        this.clearValue.reset(0, 0, 0, 0);
        this.shaderStageFlags = shaderStageFlags;
    }
    declare name: string;
    declare accessType: AccessType;
    plane = 0;
    declare clearFlags: ClearFlagBit;
    declare clearValueType: ClearValueType;
    declare readonly clearValue: ClearValue;
    declare shaderStageFlags: ShaderStageFlagBit;
}

export class ResourceDesc {
    reset (): void {
        this.dimension = ResourceDimension.BUFFER;
        this.alignment = 0;
        this.width = 0;
        this.height = 0;
        this.depthOrArraySize = 0;
        this.mipLevels = 0;
        this.format = Format.UNKNOWN;
        this.sampleCount = SampleCount.X1;
        this.textureFlags = TextureFlagBit.NONE;
        this.flags = ResourceFlags.NONE;
        this.viewType = TextureType.TEX2D;
    }
    dimension: ResourceDimension = ResourceDimension.BUFFER;
    alignment = 0;
    width = 0;
    height = 0;
    depthOrArraySize = 0;
    mipLevels = 0;
    format: Format = Format.UNKNOWN;
    sampleCount: SampleCount = SampleCount.X1;
    textureFlags: TextureFlagBit = TextureFlagBit.NONE;
    flags: ResourceFlags = ResourceFlags.NONE;
    viewType: TextureType = TextureType.TEX2D;
}

export class ResourceTraits {
    constructor (residency: ResourceResidency = ResourceResidency.MANAGED) {
        this.residency = residency;
    }
    reset (residency: ResourceResidency): void {
        this.residency = residency;
    }
    declare residency: ResourceResidency;
}

export class RenderSwapchain {
    constructor (swapchain: Swapchain | null = null, isDepthStencil = false) {
        this.swapchain = swapchain;
        this.isDepthStencil = isDepthStencil;
    }
    reset (swapchain: Swapchain | null, isDepthStencil: boolean): void {
        this.swapchain = swapchain;
        this.renderWindow = null;
        this.currentID = 0;
        this.numBackBuffers = 0;
        this.generation = 0xFFFFFFFF;
        this.isDepthStencil = isDepthStencil;
    }
    declare /*pointer*/ swapchain: Swapchain | null;
    /*pointer*/ renderWindow: RenderWindow | null = null;
    currentID = 0;
    numBackBuffers = 0;
    generation = 0xFFFFFFFF;
    declare isDepthStencil: boolean;
}

export class ResourceStates {
    reset (): void {
        this.states = AccessFlagBit.NONE;
    }
    states: AccessFlagBit = AccessFlagBit.NONE;
}

export class ManagedBuffer {
    constructor (buffer: Buffer | null = null) {
        this.buffer = buffer;
    }
    reset (buffer: Buffer | null): void {
        this.buffer = buffer;
        this.fenceValue = 0;
    }
    declare /*refcount*/ buffer: Buffer | null;
    fenceValue = 0;
}

export class PersistentBuffer {
    constructor (buffer: Buffer | null = null) {
        this.buffer = buffer;
    }
    reset (buffer: Buffer | null): void {
        this.buffer = buffer;
        this.fenceValue = 0;
    }
    declare /*refcount*/ buffer: Buffer | null;
    fenceValue = 0;
}

export class ManagedTexture {
    constructor (texture: Texture | null = null) {
        this.texture = texture;
    }
    reset (texture: Texture | null): void {
        this.texture = texture;
        this.fenceValue = 0;
    }
    declare /*refcount*/ texture: Texture | null;
    fenceValue = 0;
}

export class PersistentTexture {
    constructor (texture: Texture | null = null) {
        this.texture = texture;
    }
    reset (texture: Texture | null): void {
        this.texture = texture;
        this.fenceValue = 0;
    }
    declare /*refcount*/ texture: Texture | null;
    fenceValue = 0;
}

export class ManagedResource {
    reset (): void {
        this.unused = 0;
    }
    unused = 0;
}

export class Subpass {
    reset (): void {
        this.rasterViews.clear();
        this.computeViews.clear();
        this.resolvePairs.length = 0;
    }
    readonly rasterViews: Map<string, RasterView> = new Map<string, RasterView>();
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
    readonly resolvePairs: ResolvePair[] = [];
}

export class SubpassGraph implements BidirectionalGraph
, AdjacencyGraph
, VertexListGraph
, MutableGraph
, PropertyGraph
, NamedGraph
, ComponentGraph {
    // Graph
    readonly N = 4294967295;

    // IncidenceGraph
    edge (u: number, v: number): boolean {
        return this.o[u].some((e) => e.target === v);
    }
    source (e: ED): number {
        return e.source as number;
    }
    target (e: ED): number {
        return e.target as number;
    }
    oe (v: number): OutEI {
        return new OutEI(this.o[v].values(), v);
    }
    od (v: number): number {
        return this.o[v].length;
    }

    // BidirectionalGraph
    ie (v: number): InEI {
        return new InEI(this.i[v].values(), v);
    }
    id (v: number): number {
        return this.i[v].length;
    }
    d (v: number): number {
        return this.od(v) + this.id(v);
    }

    // AdjacencyGraph
    adj (v: number): AdjI {
        return new AdjI(this, this.oe(v));
    }

    // VertexListGraph
    v (): IterableIterator<number> {
        return this.o.keys();
    }
    nv (): number {
        return this.o.length;
    }

    // MutableGraph
    clear (): void {
        this.z(0);
    }

    addVertex (
        componentName: string,
        componentSubpass: Subpass,
    ): number {
        const v = this.o.length;
        if (v >= this.N) throw new RangeError('Vertex limit exceeded');
        try {
            this.o.push([]);
            this.i.push([]);
            this.n.push(componentName);
            this.s.push(componentSubpass);
        } catch (error) {
            this.z(v);
            throw error;
        }
        return v;
    }
    addEdge (u: number, v: number): ED | null {
        const edge = new ED(u, v);
        const out = this.o[u];
        out.push(new OutE(v));
        try {
            this.i[v].push(new OutE(u));
        } catch (error) {
            out.pop();
            throw error;
        }
        return edge;
    }
    removeEdge (e: ED): void {
        const u = e.source as number;
        const v = e.target as number;
        const out = this.o[u];
        const index = out.findIndex((other) => other.target === v);
        if (index < 0) return;
        out.splice(index, 1);
        const incoming = this.i[v];
        incoming.splice(incoming.findIndex((other) => other.target === u), 1);
    }
    removeEdges (u: number, v: number): void {
        const compact = (list: OutE[], neighbor: number): void => {
            let count = 0;
            for (const edge of list) if (edge.target !== neighbor) list[count++] = edge;
            list.length = count;
        };
        compact(this.o[u], v);
        compact(this.i[v], u);
    }

    // NamedGraph
    vertexName (v: number): string {
        return this.n[v];
    }

    // ComponentGraph
    getName (v: number): string {
        return this.n[v];
    }
    setName (v: number, value: string): void {
        this.n[v] = value;
    }
    getSubpass (v: number): Subpass {
        return this.s[v];
    }

    private z (length: number): void {
        this.o.length = length;
        this.i.length = length;
        this.n.length = length;
        this.s.length = length;
    }

    private readonly o: OutE[][] = [];
    private readonly i: OutE[][] = [];
    private readonly n: string[] = [];
    private readonly s: Subpass[] = [];
}

export class RasterSubpass {
    constructor (subpassID = 0xFFFFFFFF, count = 1, quality = 0) {
        this.subpassID = subpassID;
        this.count = count;
        this.quality = quality;
    }
    reset (subpassID: number, count: number, quality: number): void {
        this.rasterViews.clear();
        this.computeViews.clear();
        this.resolvePairs.length = 0;
        this.viewport.reset();
        this.subpassID = subpassID;
        this.count = count;
        this.quality = quality;
        this.showStatistics = false;
    }
    readonly rasterViews: Map<string, RasterView> = new Map<string, RasterView>();
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
    readonly resolvePairs: ResolvePair[] = [];
    readonly viewport: Viewport = new Viewport();
    declare subpassID: number;
    declare count: number;
    declare quality: number;
    showStatistics = false;
}

export class ComputeSubpass {
    constructor (subpassID = 0xFFFFFFFF) {
        this.subpassID = subpassID;
    }
    reset (subpassID: number): void {
        this.rasterViews.clear();
        this.computeViews.clear();
        this.subpassID = subpassID;
    }
    readonly rasterViews: Map<string, RasterView> = new Map<string, RasterView>();
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
    declare subpassID: number;
}

export class RasterPass {
    reset (): void {
        this.rasterViews.clear();
        this.computeViews.clear();
        this.attachmentIndexMap.clear();
        this.textures.clear();
        this.subpassGraph.clear();
        this.width = 0;
        this.height = 0;
        this.count = 1;
        this.quality = 0;
        this.viewport.reset();
        this.versionName = '';
        this.version = 0;
        this.hashValue = 0;
        this.showStatistics = false;
    }
    readonly rasterViews: Map<string, RasterView> = new Map<string, RasterView>();
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
    readonly attachmentIndexMap: Map<string, number> = new Map<string, number>();
    readonly textures: Map<string, ShaderStageFlagBit> = new Map<string, ShaderStageFlagBit>();
    readonly subpassGraph: SubpassGraph = new SubpassGraph();
    width = 0;
    height = 0;
    count = 1;
    quality = 0;
    readonly viewport: Viewport = new Viewport();
    versionName = '';
    version = 0;
    hashValue = 0;
    showStatistics = false;
}

export class PersistentRenderPassAndFramebuffer {
    constructor (renderPass: RenderPass | null = null, framebuffer: Framebuffer | null = null) {
        this.renderPass = renderPass;
        this.framebuffer = framebuffer;
    }
    reset (renderPass: RenderPass | null, framebuffer: Framebuffer | null): void {
        this.renderPass = renderPass;
        this.framebuffer = framebuffer;
        this.clearColors.length = 0;
        this.clearDepth = 0;
        this.clearStencil = 0;
    }
    declare /*refcount*/ renderPass: RenderPass | null;
    declare /*refcount*/ framebuffer: Framebuffer | null;
    readonly clearColors: Color[] = [];
    clearDepth = 0;
    clearStencil = 0;
}

export class FormatView {
    reset (): void {
        this.format = Format.UNKNOWN;
    }
    format: Format = Format.UNKNOWN;
}

export class SubresourceView {
    reset (): void {
        this.textureView = null;
        this.format = Format.UNKNOWN;
        this.indexOrFirstMipLevel = 0;
        this.numMipLevels = 0;
        this.firstArraySlice = 0;
        this.numArraySlices = 0;
        this.firstPlane = 0;
        this.numPlanes = 0;
    }
    /*refcount*/ textureView: Texture | null = null;
    format: Format = Format.UNKNOWN;
    indexOrFirstMipLevel = 0;
    numMipLevels = 0;
    firstArraySlice = 0;
    numArraySlices = 0;
    firstPlane = 0;
    numPlanes = 0;
}

export const enum ResourceGraphValue {
    Managed,
    ManagedBuffer,
    ManagedTexture,
    PersistentBuffer,
    PersistentTexture,
    Framebuffer,
    Swapchain,
    FormatView,
    SubresourceView,
}

export function getResourceGraphValueName (kind: ResourceGraphValue): string {
    switch (kind) {
    case ResourceGraphValue.Managed: return 'Managed';
    case ResourceGraphValue.ManagedBuffer: return 'ManagedBuffer';
    case ResourceGraphValue.ManagedTexture: return 'ManagedTexture';
    case ResourceGraphValue.PersistentBuffer: return 'PersistentBuffer';
    case ResourceGraphValue.PersistentTexture: return 'PersistentTexture';
    case ResourceGraphValue.Framebuffer: return 'Framebuffer';
    case ResourceGraphValue.Swapchain: return 'Swapchain';
    case ResourceGraphValue.FormatView: return 'FormatView';
    case ResourceGraphValue.SubresourceView: return 'SubresourceView';
    default: return '';
    }
}

export interface ResourceGraphValueType {
    [ResourceGraphValue.Managed]: ManagedResource;
    [ResourceGraphValue.ManagedBuffer]: ManagedBuffer;
    [ResourceGraphValue.ManagedTexture]: ManagedTexture;
    [ResourceGraphValue.PersistentBuffer]: PersistentBuffer;
    [ResourceGraphValue.PersistentTexture]: PersistentTexture;
    [ResourceGraphValue.Framebuffer]: Framebuffer;
    [ResourceGraphValue.Swapchain]: RenderSwapchain;
    [ResourceGraphValue.FormatView]: FormatView;
    [ResourceGraphValue.SubresourceView]: SubresourceView;
}

export interface ResourceGraphVisitor {
    managed(value: ManagedResource): unknown;
    managedBuffer(value: ManagedBuffer): unknown;
    managedTexture(value: ManagedTexture): unknown;
    persistentBuffer(value: PersistentBuffer): unknown;
    persistentTexture(value: PersistentTexture): unknown;
    framebuffer(value: Framebuffer): unknown;
    swapchain(value: RenderSwapchain): unknown;
    formatView(value: FormatView): unknown;
    subresourceView(value: SubresourceView): unknown;
}

export type ResourceGraphObject = ResourceGraphValueType[ResourceGraphValue];

export class ResourceGraph implements BidirectionalGraph
, AdjacencyGraph
, VertexListGraph
, MutableGraph
, PropertyGraph
, NamedGraph
, ComponentGraph
, PolymorphicGraph
, ReferenceGraph
, MutableReferenceGraph
, UuidGraph<string> {
    // Graph
    readonly N = 4294967295;

    // IncidenceGraph
    edge (u: number, v: number): boolean {
        return this.p[v] === u;
    }
    source (e: ED): number {
        return e.source as number;
    }
    target (e: ED): number {
        return e.target as number;
    }
    oe (v: number): OutEI {
        return new OutEI(this.c[v].values(), v);
    }
    od (v: number): number {
        return this.c[v].length;
    }

    // BidirectionalGraph
    ie (v: number): OneInEI {
        return new OneInEI(this.p[v], v, this.N);
    }
    id (v: number): number {
        return this.p[v] === this.N ? 0 : 1;
    }
    d (v: number): number {
        return this.od(v) + this.id(v);
    }

    // AdjacencyGraph
    adj (v: number): AdjI {
        return new AdjI(this, this.oe(v));
    }

    // VertexListGraph
    v (): IterableIterator<number> {
        return this.c.keys();
    }
    nv (): number {
        return this.c.length;
    }

    // MutableGraph
    clear (): void {
        this.z(0);
        this.m.clear();
        this.renderPasses.clear();
        this.nextFenceValue = 0;
        this.version = 0;
    }

    addVertex<T extends ResourceGraphValue> (
        id: T,
        object: ResourceGraphValueType[T],
        componentName: string,
        componentDesc: ResourceDesc,
        componentTraits: ResourceTraits,
        componentStates: ResourceStates,
        componentSampler: SamplerInfo,
        parent: number = this.N,
    ): number {
        const v = this.c.length;
        if (v >= this.N) throw new RangeError('Vertex limit exceeded');
        if (this.m.has(componentName)) throw new Error('Duplicate vertex name');
        const siblings = this.c[parent];
        try {
            this.c.push([]);
            this.p.push(parent);
            this.t.push(id);
            this.a.push(object);
            this.n.push(componentName);
            this.d1.push(componentDesc);
            this.t1.push(componentTraits);
            this.s.push(componentStates);
            this.s1.push(componentSampler);
            this.m.set(componentName, v);
            if (parent !== this.N) siblings.push(new OutE(v));
        } catch (error) {
            this.m.delete(componentName);
            this.z(v);
            throw error;
        }
        return v;
    }

    addEdge (u: number, v: number): ED | null {
        if (this.p[v] !== this.N) return null;
        const children = this.c[u];
        const index = children.findIndex((e) => (e.target as number) > v);
        for (let p = u; p !== this.N; p = this.p[p]) if (p === v) return null;
        children.splice(index < 0 ? children.length : index, 0, new OutE(v));
        this.p[v] = u;
        return new ED(u, v);
    }

    // NamedGraph
    vertexName (v: number): string {
        return this.n[v];
    }

    // ComponentGraph
    getName (v: number): string {
        return this.n[v];
    }
    setName (v: number, value: string): void {
        const previous = this.n[v];
        if (previous === value) return;
        if (this.m.has(value)) throw new Error('Duplicate vertex name');
        this.m.set(value, v);
        this.m.delete(previous);
        this.n[v] = value;
    }
    getDesc (v: number): ResourceDesc {
        return this.d1[v];
    }
    getTraits (v: number): ResourceTraits {
        return this.t1[v];
    }
    getStates (v: number): ResourceStates {
        return this.s[v];
    }
    getSampler (v: number): SamplerInfo {
        return this.s1[v];
    }

    // PolymorphicGraph
    h (id: ResourceGraphValue, v: number): boolean {
        return this.t[v] === id;
    }
    w (v: number): ResourceGraphValue {
        return this.t[v];
    }
    object (v: number): ResourceGraphObject {
        return this.a[v];
    }
    value<T extends ResourceGraphValue> (id: T, v: number): ResourceGraphValueType[T] {
        return this.a[v] as ResourceGraphValueType[typeof id];
    }
    visitVertex (visitor: ResourceGraphVisitor, v: number): unknown {
        const object = this.a[v];
        switch (this.t[v]) {
        case ResourceGraphValue.Managed:
            return visitor.managed(object as ManagedResource);
        case ResourceGraphValue.ManagedBuffer:
            return visitor.managedBuffer(object as ManagedBuffer);
        case ResourceGraphValue.ManagedTexture:
            return visitor.managedTexture(object as ManagedTexture);
        case ResourceGraphValue.PersistentBuffer:
            return visitor.persistentBuffer(object as PersistentBuffer);
        case ResourceGraphValue.PersistentTexture:
            return visitor.persistentTexture(object as PersistentTexture);
        case ResourceGraphValue.Framebuffer:
            return visitor.framebuffer(object as Framebuffer);
        case ResourceGraphValue.Swapchain:
            return visitor.swapchain(object as RenderSwapchain);
        case ResourceGraphValue.FormatView:
            return visitor.formatView(object as FormatView);
        case ResourceGraphValue.SubresourceView:
            return visitor.subresourceView(object as SubresourceView);
        default:
            throw new Error('Unknown vertex kind');
        }
    }
    j<T extends ResourceGraphObject> (v: number): T {
        return this.a[v] as T;
    }

    // ReferenceGraph
    reference (u: number, v: number): boolean {
        return this.p[v] === u;
    }
    parent (e: ED): number {
        return e.source as number;
    }
    child (e: ED): number {
        return e.target as number;
    }
    children (v: number): OutEI {
        return new OutEI(this.c[v].values(), v);
    }
    numChildren (v: number): number {
        return this.c[v].length;
    }
    getParent (v: number): number {
        return this.p[v];
    }

    // MutableReferenceGraph
    addReference (u: number, v: number): ED | null {
        return this.addEdge(u, v);
    }

    // UuidGraph
    contains (key: string): boolean {
        return this.m.has(key);
    }
    vertex (key: string): number {
        return this.m.get(key)!;
    }
    find (key: string): number {
        return this.m.get(key) ?? this.N;
    }

    private z (length: number): void {
        this.c.length = length;
        this.p.length = length;
        this.t.length = length;
        this.a.length = length;
        this.n.length = length;
        this.d1.length = length;
        this.t1.length = length;
        this.s.length = length;
        this.s1.length = length;
    }

    private readonly c: OutE[][] = [];
    private readonly p: number[] = [];
    private readonly t: ResourceGraphValue[] = [];
    private readonly a: ResourceGraphObject[] = [];
    private readonly n: string[] = [];
    private readonly d1: ResourceDesc[] = [];
    private readonly t1: ResourceTraits[] = [];
    private readonly s: ResourceStates[] = [];
    private readonly s1: SamplerInfo[] = [];
    private readonly m = new Map<string, number>();
    readonly renderPasses: Map<string, PersistentRenderPassAndFramebuffer> = new Map<string, PersistentRenderPassAndFramebuffer>();
    nextFenceValue: number = 0;
    version: number = 0;
}

export class ComputePass {
    reset (): void {
        this.computeViews.clear();
        this.textures.clear();
    }
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
    readonly textures: Map<string, ShaderStageFlagBit> = new Map<string, ShaderStageFlagBit>();
}

export class ResolvePass {
    reset (): void {
        this.resolvePairs.length = 0;
    }
    readonly resolvePairs: ResolvePair[] = [];
}

export class CopyPass {
    reset (): void {
        this.copyPairs.length = 0;
        this.uploadPairs.length = 0;
    }
    readonly copyPairs: CopyPair[] = [];
    readonly uploadPairs: UploadPair[] = [];
}

export class MovePass {
    reset (): void {
        this.movePairs.length = 0;
    }
    readonly movePairs: MovePair[] = [];
}

export class RaytracePass {
    reset (): void {
        this.computeViews.clear();
    }
    readonly computeViews: Map<string, ComputeView[]> = new Map<string, ComputeView[]>();
}

export class ClearView {
    constructor (slotName = '', clearFlags: ClearFlagBit = ClearFlagBit.ALL, clearColor: Color = new Color()) {
        this.slotName = slotName;
        this.clearFlags = clearFlags;
        this.clearColor = clearColor;
    }
    reset (slotName: string, clearFlags: ClearFlagBit): void {
        this.slotName = slotName;
        this.clearFlags = clearFlags;
        this.clearColor.reset();
    }
    declare slotName: string;
    declare clearFlags: ClearFlagBit;
    declare readonly clearColor: Color;
}

export class RenderQueue {
    constructor (hint: QueueHint = QueueHint.RENDER_OPAQUE, phaseID = 0xFFFFFFFF, passLayoutID = 0xFFFFFFFF) {
        this.hint = hint;
        this.phaseID = phaseID;
        this.passLayoutID = passLayoutID;
    }
    reset (hint: QueueHint, phaseID: number, passLayoutID: number): void {
        this.hint = hint;
        this.phaseID = phaseID;
        this.passLayoutID = passLayoutID;
        this.viewport = null;
    }
    declare hint: QueueHint;
    declare phaseID: number;
    declare passLayoutID: number;
    viewport: Viewport | null = null;
}

export const enum CullingFlags {
    NONE = 0,
    CAMERA_FRUSTUM = 0x1,
    LIGHT_FRUSTUM = 0x2,
    LIGHT_BOUNDS = 0x4,
}

export class SceneData {
    constructor (
        scene: RenderScene | null = null,
        camera: Camera | null = null,
        flags: SceneFlags = SceneFlags.NONE,
        light: LightInfo = new LightInfo(),
        cullingFlags: CullingFlags = CullingFlags.CAMERA_FRUSTUM,
        shadingLight: Light | null = null,
    ) {
        this.scene = scene;
        this.camera = camera;
        this.light = light;
        this.flags = flags;
        this.cullingFlags = cullingFlags;
        this.shadingLight = shadingLight;
    }
    reset (
        scene: RenderScene | null,
        camera: Camera | null,
        flags: SceneFlags,
        cullingFlags: CullingFlags,
        shadingLight: Light | null,
    ): void {
        this.scene = scene;
        this.camera = camera;
        this.light.reset(null, 0, false, null);
        this.flags = flags;
        this.cullingFlags = cullingFlags;
        this.shadingLight = shadingLight;
    }
    declare /*pointer*/ scene: RenderScene | null;
    declare /*pointer*/ camera: Camera | null;
    declare readonly light: LightInfo;
    declare flags: SceneFlags;
    declare cullingFlags: CullingFlags;
    declare /*refcount*/ shadingLight: Light | null;
}

export class Dispatch {
    constructor (
        material: Material | null = null,
        passID = 0,
        threadGroupCountX = 0,
        threadGroupCountY = 0,
        threadGroupCountZ = 0,
    ) {
        this.material = material;
        this.passID = passID;
        this.threadGroupCountX = threadGroupCountX;
        this.threadGroupCountY = threadGroupCountY;
        this.threadGroupCountZ = threadGroupCountZ;
    }
    reset (
        material: Material | null,
        passID: number,
        threadGroupCountX: number,
        threadGroupCountY: number,
        threadGroupCountZ: number,
    ): void {
        this.material = material;
        this.passID = passID;
        this.threadGroupCountX = threadGroupCountX;
        this.threadGroupCountY = threadGroupCountY;
        this.threadGroupCountZ = threadGroupCountZ;
    }
    declare /*refcount*/ material: Material | null;
    declare passID: number;
    declare threadGroupCountX: number;
    declare threadGroupCountY: number;
    declare threadGroupCountZ: number;
}

export const enum BlitType {
    FULLSCREEN_QUAD,
    DRAW_2D,
    DRAW_PROFILE,
    DRAW_3D,
}

export class Blit {
    constructor (
        material: Material | null = null,
        passID = 0,
        sceneFlags: SceneFlags = SceneFlags.NONE,
        camera: Camera | null = null,
        blitType: BlitType = BlitType.FULLSCREEN_QUAD,
    ) {
        this.material = material;
        this.passID = passID;
        this.sceneFlags = sceneFlags;
        this.camera = camera;
        this.blitType = blitType;
    }
    reset (
        material: Material | null,
        passID: number,
        sceneFlags: SceneFlags,
        camera: Camera | null,
        blitType: BlitType,
    ): void {
        this.material = material;
        this.passID = passID;
        this.sceneFlags = sceneFlags;
        this.camera = camera;
        this.blitType = blitType;
        this.models.length = 0;
    }
    declare /*refcount*/ material: Material | null;
    declare passID: number;
    declare sceneFlags: SceneFlags;
    declare /*pointer*/ camera: Camera | null;
    declare blitType: BlitType;
    readonly models: Model[] = [];
}

export class RenderData {
    reset (): void {
        this.constants.clear();
        this.buffers.clear();
        this.textures.clear();
        this.samplers.clear();
        this.custom = '';
    }
    readonly constants: Map<number, number[]> = new Map<number, number[]>();
    readonly buffers: Map<number, Buffer> = new Map<number, Buffer>();
    readonly textures: Map<number, Texture> = new Map<number, Texture>();
    readonly samplers: Map<number, Sampler> = new Map<number, Sampler>();
    custom = '';
}

export const enum RenderGraphValue {
    RasterPass,
    RasterSubpass,
    ComputeSubpass,
    Compute,
    Resolve,
    Copy,
    Move,
    Raytrace,
    Queue,
    Scene,
    Blit,
    Dispatch,
    Clear,
    Viewport,
}

export function getRenderGraphValueName (kind: RenderGraphValue): string {
    switch (kind) {
    case RenderGraphValue.RasterPass: return 'RasterPass';
    case RenderGraphValue.RasterSubpass: return 'RasterSubpass';
    case RenderGraphValue.ComputeSubpass: return 'ComputeSubpass';
    case RenderGraphValue.Compute: return 'Compute';
    case RenderGraphValue.Resolve: return 'Resolve';
    case RenderGraphValue.Copy: return 'Copy';
    case RenderGraphValue.Move: return 'Move';
    case RenderGraphValue.Raytrace: return 'Raytrace';
    case RenderGraphValue.Queue: return 'Queue';
    case RenderGraphValue.Scene: return 'Scene';
    case RenderGraphValue.Blit: return 'Blit';
    case RenderGraphValue.Dispatch: return 'Dispatch';
    case RenderGraphValue.Clear: return 'Clear';
    case RenderGraphValue.Viewport: return 'Viewport';
    default: return '';
    }
}

export interface RenderGraphValueType {
    [RenderGraphValue.RasterPass]: RasterPass;
    [RenderGraphValue.RasterSubpass]: RasterSubpass;
    [RenderGraphValue.ComputeSubpass]: ComputeSubpass;
    [RenderGraphValue.Compute]: ComputePass;
    [RenderGraphValue.Resolve]: ResolvePass;
    [RenderGraphValue.Copy]: CopyPass;
    [RenderGraphValue.Move]: MovePass;
    [RenderGraphValue.Raytrace]: RaytracePass;
    [RenderGraphValue.Queue]: RenderQueue;
    [RenderGraphValue.Scene]: SceneData;
    [RenderGraphValue.Blit]: Blit;
    [RenderGraphValue.Dispatch]: Dispatch;
    [RenderGraphValue.Clear]: ClearView[];
    [RenderGraphValue.Viewport]: Viewport;
}

export interface RenderGraphVisitor {
    rasterPass(value: RasterPass): unknown;
    rasterSubpass(value: RasterSubpass): unknown;
    computeSubpass(value: ComputeSubpass): unknown;
    compute(value: ComputePass): unknown;
    resolve(value: ResolvePass): unknown;
    copy(value: CopyPass): unknown;
    move(value: MovePass): unknown;
    raytrace(value: RaytracePass): unknown;
    queue(value: RenderQueue): unknown;
    scene(value: SceneData): unknown;
    blit(value: Blit): unknown;
    dispatch(value: Dispatch): unknown;
    clear(value: ClearView[]): unknown;
    viewport(value: Viewport): unknown;
}

export type RenderGraphObject = RenderGraphValueType[RenderGraphValue];

export class RenderGraph implements BidirectionalGraph
, AdjacencyGraph
, VertexListGraph
, MutableGraph
, PropertyGraph
, NamedGraph
, ComponentGraph
, PolymorphicGraph
, ReferenceGraph
, MutableReferenceGraph {
    // Graph
    readonly N = 4294967295;

    // IncidenceGraph
    edge (u: number, v: number): boolean {
        return this.o[u].some((e) => e.target === v);
    }
    source (e: ED): number {
        return e.source as number;
    }
    target (e: ED): number {
        return e.target as number;
    }
    oe (v: number): OutEI {
        return new OutEI(this.o[v].values(), v);
    }
    od (v: number): number {
        return this.o[v].length;
    }

    // BidirectionalGraph
    ie (v: number): InEI {
        return new InEI(this.i[v].values(), v);
    }
    id (v: number): number {
        return this.i[v].length;
    }
    d (v: number): number {
        return this.od(v) + this.id(v);
    }

    // AdjacencyGraph
    adj (v: number): AdjI {
        return new AdjI(this, this.oe(v));
    }

    // VertexListGraph
    v (): IterableIterator<number> {
        return this.o.keys();
    }
    nv (): number {
        return this.o.length;
    }

    // MutableGraph
    clear (): void {
        this.z(0);
        this.index.clear();
        this.sortedVertices.length = 0;
        this.globalRenderData.reset();
    }

    addVertex<T extends RenderGraphValue> (
        id: T,
        object: RenderGraphValueType[T],
        componentName: string,
        componentLayout: string,
        componentData: RenderData,
        componentValid: boolean,
        parent: number = this.N,
    ): number {
        const v = this.o.length;
        if (v >= this.N) throw new RangeError('Vertex limit exceeded');
        const siblings = this.c[parent];
        try {
            this.o.push([]);
            this.i.push([]);
            this.c.push([]);
            this.p.push(parent);
            this.t.push(id);
            this.a.push(object);
            this.n.push(componentName);
            this.l.push(componentLayout);
            this.d1.push(componentData);
            this.v1.push(componentValid);
            if (parent !== this.N) siblings.push(new OutE(v));
        } catch (error) {
            this.z(v);
            throw error;
        }
        return v;
    }
    addEdge (u: number, v: number): ED | null {
        const edge = new ED(u, v);
        const out = this.o[u];
        out.push(new OutE(v));
        try {
            this.i[v].push(new OutE(u));
        } catch (error) {
            out.pop();
            throw error;
        }
        return edge;
    }
    removeEdge (e: ED): void {
        const u = e.source as number;
        const v = e.target as number;
        const out = this.o[u];
        const index = out.findIndex((other) => other.target === v);
        if (index < 0) return;
        out.splice(index, 1);
        const incoming = this.i[v];
        incoming.splice(incoming.findIndex((other) => other.target === u), 1);
    }
    removeEdges (u: number, v: number): void {
        const compact = (list: OutE[], neighbor: number): void => {
            let count = 0;
            for (const edge of list) if (edge.target !== neighbor) list[count++] = edge;
            list.length = count;
        };
        compact(this.o[u], v);
        compact(this.i[v], u);
    }

    // NamedGraph
    vertexName (v: number): string {
        return this.n[v];
    }

    // ComponentGraph
    getName (v: number): string {
        return this.n[v];
    }
    setName (v: number, value: string): void {
        this.n[v] = value;
    }
    getLayout (v: number): string {
        return this.l[v];
    }
    setLayout (v: number, value: string): void {
        this.l[v] = value;
    }
    getData (v: number): RenderData {
        return this.d1[v];
    }
    getValid (v: number): boolean {
        return this.v1[v];
    }
    setValid (v: number, value: boolean): void {
        this.v1[v] = value;
    }

    // PolymorphicGraph
    h (id: RenderGraphValue, v: number): boolean {
        return this.t[v] === id;
    }
    w (v: number): RenderGraphValue {
        return this.t[v];
    }
    object (v: number): RenderGraphObject {
        return this.a[v];
    }
    value<T extends RenderGraphValue> (id: T, v: number): RenderGraphValueType[T] {
        return this.a[v] as RenderGraphValueType[typeof id];
    }
    visitVertex (visitor: RenderGraphVisitor, v: number): unknown {
        const object = this.a[v];
        switch (this.t[v]) {
        case RenderGraphValue.RasterPass:
            return visitor.rasterPass(object as RasterPass);
        case RenderGraphValue.RasterSubpass:
            return visitor.rasterSubpass(object as RasterSubpass);
        case RenderGraphValue.ComputeSubpass:
            return visitor.computeSubpass(object as ComputeSubpass);
        case RenderGraphValue.Compute:
            return visitor.compute(object as ComputePass);
        case RenderGraphValue.Resolve:
            return visitor.resolve(object as ResolvePass);
        case RenderGraphValue.Copy:
            return visitor.copy(object as CopyPass);
        case RenderGraphValue.Move:
            return visitor.move(object as MovePass);
        case RenderGraphValue.Raytrace:
            return visitor.raytrace(object as RaytracePass);
        case RenderGraphValue.Queue:
            return visitor.queue(object as RenderQueue);
        case RenderGraphValue.Scene:
            return visitor.scene(object as SceneData);
        case RenderGraphValue.Blit:
            return visitor.blit(object as Blit);
        case RenderGraphValue.Dispatch:
            return visitor.dispatch(object as Dispatch);
        case RenderGraphValue.Clear:
            return visitor.clear(object as ClearView[]);
        case RenderGraphValue.Viewport:
            return visitor.viewport(object as Viewport);
        default:
            throw new Error('Unknown vertex kind');
        }
    }
    j<T extends RenderGraphObject> (v: number): T {
        return this.a[v] as T;
    }

    // ReferenceGraph
    reference (u: number, v: number): boolean {
        return u !== this.N && this.p[v] === u;
    }
    parent (e: ED): number {
        return e.source as number;
    }
    child (e: ED): number {
        return e.target as number;
    }
    parents (v: number): OneInEI {
        return new OneInEI(this.p[v], v, this.N);
    }
    children (v: number): OutEI {
        return new OutEI(this.c[v].values(), v);
    }
    numParents (v: number): number {
        return this.p[v] === this.N ? 0 : 1;
    }
    numChildren (v: number): number {
        return this.c[v].length;
    }
    getParent (v: number): number {
        return this.p[v];
    }

    // MutableReferenceGraph
    addReference (u: number, v: number): ED | null {
        if (this.p[v] !== this.N) return null;
        const children = this.c[u];
        const index = children.findIndex((e) => (e.target as number) > v);
        for (let p = u; p !== this.N; p = this.p[p]) if (p === v) return null;
        children.splice(index < 0 ? children.length : index, 0, new OutE(v));
        this.p[v] = u;
        return new ED(u, v);
    }
    removeReference (e: ED): void {
        this.removeReferences(e.source as number, e.target as number);
    }
    removeReferences (u: number, v: number): void {
        if (!this.reference(u, v)) return;
        const children = this.c[u];
        children.splice(children.findIndex((e) => e.target === v), 1);
        this.p[v] = this.N;
    }

    private z (length: number): void {
        this.o.length = length;
        this.i.length = length;
        this.c.length = length;
        this.p.length = length;
        this.t.length = length;
        this.a.length = length;
        this.n.length = length;
        this.l.length = length;
        this.d1.length = length;
        this.v1.length = length;
    }

    private readonly o: OutE[][] = [];
    private readonly i: OutE[][] = [];
    private readonly c: OutE[][] = [];
    private readonly p: number[] = [];
    private readonly t: RenderGraphValue[] = [];
    private readonly a: RenderGraphObject[] = [];
    private readonly n: string[] = [];
    private readonly l: string[] = [];
    private readonly d1: RenderData[] = [];
    private readonly v1: boolean[] = [];
    readonly index: Map<string, number> = new Map<string, number>();
    readonly sortedVertices: number[] = [];
    readonly globalRenderData: RenderData = new RenderData();
}

function createPool<T> (Constructor: new () => T): RecyclePool<T> {
    return new RecyclePool<T>(() => new Constructor(), 16);
}

export class RenderGraphObjectPool {
    constructor (renderCommon: RenderCommonObjectPool) {
        this.renderCommon = renderCommon;
    }
    reset (): void {
        this.cv.reset(); // ClearValue
        this.rv.reset(); // RasterView
        this.cv1.reset(); // ComputeView
        this.rd.reset(); // ResourceDesc
        this.rt.reset(); // ResourceTraits
        this.rs.reset(); // RenderSwapchain
        this.rs1.reset(); // ResourceStates
        this.mb.reset(); // ManagedBuffer
        this.pb.reset(); // PersistentBuffer
        this.mt.reset(); // ManagedTexture
        this.pt.reset(); // PersistentTexture
        this.mr.reset(); // ManagedResource
        this.s.reset(); // Subpass
        this.sg.reset(); // SubpassGraph
        this.rs2.reset(); // RasterSubpass
        this.cs.reset(); // ComputeSubpass
        this.rp.reset(); // RasterPass
        this.prpaf.reset(); // PersistentRenderPassAndFramebuffer
        this.fv.reset(); // FormatView
        this.sv.reset(); // SubresourceView
        this.rg.reset(); // ResourceGraph
        this.cp.reset(); // ComputePass
        this.rp1.reset(); // ResolvePass
        this.cp1.reset(); // CopyPass
        this.mp.reset(); // MovePass
        this.rp2.reset(); // RaytracePass
        this.cv2.reset(); // ClearView
        this.rq.reset(); // RenderQueue
        this.sd.reset(); // SceneData
        this.d.reset(); // Dispatch
        this.b.reset(); // Blit
        this.rd1.reset(); // RenderData
        this.rg1.reset(); // RenderGraph
    }
    createClearValue (
        x = 0,
        y = 0,
        z = 0,
        w = 0,
    ): ClearValue {
        const v = this.cv.add(); // ClearValue
        v.reset(x, y, z, w);
        return v;
    }
    createRasterView (
        slotName = '',
        accessType: AccessType = AccessType.WRITE,
        attachmentType: AttachmentType = AttachmentType.RENDER_TARGET,
        loadOp: LoadOp = LoadOp.LOAD,
        storeOp: StoreOp = StoreOp.STORE,
        clearFlags: ClearFlagBit = ClearFlagBit.ALL,
        shaderStageFlags: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ): RasterView {
        const v = this.rv.add(); // RasterView
        v.reset(slotName, accessType, attachmentType, loadOp, storeOp, clearFlags, shaderStageFlags);
        return v;
    }
    createComputeView (
        name = '',
        accessType: AccessType = AccessType.READ,
        clearFlags: ClearFlagBit = ClearFlagBit.NONE,
        clearValueType: ClearValueType = ClearValueType.NONE,
        shaderStageFlags: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ): ComputeView {
        const v = this.cv1.add(); // ComputeView
        v.reset(name, accessType, clearFlags, clearValueType, shaderStageFlags);
        return v;
    }
    createResourceDesc (): ResourceDesc {
        const v = this.rd.add(); // ResourceDesc
        v.reset();
        return v;
    }
    createResourceTraits (
        residency: ResourceResidency = ResourceResidency.MANAGED,
    ): ResourceTraits {
        const v = this.rt.add(); // ResourceTraits
        v.reset(residency);
        return v;
    }
    createRenderSwapchain (
        swapchain: Swapchain | null = null,
        isDepthStencil = false,
    ): RenderSwapchain {
        const v = this.rs.add(); // RenderSwapchain
        v.reset(swapchain, isDepthStencil);
        return v;
    }
    createResourceStates (): ResourceStates {
        const v = this.rs1.add(); // ResourceStates
        v.reset();
        return v;
    }
    createManagedBuffer (
        buffer: Buffer | null = null,
    ): ManagedBuffer {
        const v = this.mb.add(); // ManagedBuffer
        v.reset(buffer);
        return v;
    }
    createPersistentBuffer (
        buffer: Buffer | null = null,
    ): PersistentBuffer {
        const v = this.pb.add(); // PersistentBuffer
        v.reset(buffer);
        return v;
    }
    createManagedTexture (
        texture: Texture | null = null,
    ): ManagedTexture {
        const v = this.mt.add(); // ManagedTexture
        v.reset(texture);
        return v;
    }
    createPersistentTexture (
        texture: Texture | null = null,
    ): PersistentTexture {
        const v = this.pt.add(); // PersistentTexture
        v.reset(texture);
        return v;
    }
    createManagedResource (): ManagedResource {
        const v = this.mr.add(); // ManagedResource
        v.reset();
        return v;
    }
    createSubpass (): Subpass {
        const v = this.s.add(); // Subpass
        v.reset();
        return v;
    }
    createSubpassGraph (): SubpassGraph {
        const v = this.sg.add(); // SubpassGraph
        v.clear();
        return v;
    }
    createRasterSubpass (
        subpassID = 0xFFFFFFFF,
        count = 1,
        quality = 0,
    ): RasterSubpass {
        const v = this.rs2.add(); // RasterSubpass
        v.reset(subpassID, count, quality);
        return v;
    }
    createComputeSubpass (
        subpassID = 0xFFFFFFFF,
    ): ComputeSubpass {
        const v = this.cs.add(); // ComputeSubpass
        v.reset(subpassID);
        return v;
    }
    createRasterPass (): RasterPass {
        const v = this.rp.add(); // RasterPass
        v.reset();
        return v;
    }
    createPersistentRenderPassAndFramebuffer (
        renderPass: RenderPass | null = null,
        framebuffer: Framebuffer | null = null,
    ): PersistentRenderPassAndFramebuffer {
        const v = this.prpaf.add(); // PersistentRenderPassAndFramebuffer
        v.reset(renderPass, framebuffer);
        return v;
    }
    createFormatView (): FormatView {
        const v = this.fv.add(); // FormatView
        v.reset();
        return v;
    }
    createSubresourceView (): SubresourceView {
        const v = this.sv.add(); // SubresourceView
        v.reset();
        return v;
    }
    createResourceGraph (): ResourceGraph {
        const v = this.rg.add(); // ResourceGraph
        v.clear();
        return v;
    }
    createComputePass (): ComputePass {
        const v = this.cp.add(); // ComputePass
        v.reset();
        return v;
    }
    createResolvePass (): ResolvePass {
        const v = this.rp1.add(); // ResolvePass
        v.reset();
        return v;
    }
    createCopyPass (): CopyPass {
        const v = this.cp1.add(); // CopyPass
        v.reset();
        return v;
    }
    createMovePass (): MovePass {
        const v = this.mp.add(); // MovePass
        v.reset();
        return v;
    }
    createRaytracePass (): RaytracePass {
        const v = this.rp2.add(); // RaytracePass
        v.reset();
        return v;
    }
    createClearView (
        slotName = '',
        clearFlags: ClearFlagBit = ClearFlagBit.ALL,
    ): ClearView {
        const v = this.cv2.add(); // ClearView
        v.reset(slotName, clearFlags);
        return v;
    }
    createRenderQueue (
        hint: QueueHint = QueueHint.RENDER_OPAQUE,
        phaseID = 0xFFFFFFFF,
        passLayoutID = 0xFFFFFFFF,
    ): RenderQueue {
        const v = this.rq.add(); // RenderQueue
        v.reset(hint, phaseID, passLayoutID);
        return v;
    }
    createSceneData (
        scene: RenderScene | null = null,
        camera: Camera | null = null,
        flags: SceneFlags = SceneFlags.NONE,
        cullingFlags: CullingFlags = CullingFlags.CAMERA_FRUSTUM,
        shadingLight: Light | null = null,
    ): SceneData {
        const v = this.sd.add(); // SceneData
        v.reset(scene, camera, flags, cullingFlags, shadingLight);
        return v;
    }
    createDispatch (
        material: Material | null = null,
        passID = 0,
        threadGroupCountX = 0,
        threadGroupCountY = 0,
        threadGroupCountZ = 0,
    ): Dispatch {
        const v = this.d.add(); // Dispatch
        v.reset(material, passID, threadGroupCountX, threadGroupCountY, threadGroupCountZ);
        return v;
    }
    createBlit (
        material: Material | null = null,
        passID = 0,
        sceneFlags: SceneFlags = SceneFlags.NONE,
        camera: Camera | null = null,
        blitType: BlitType = BlitType.FULLSCREEN_QUAD,
    ): Blit {
        const v = this.b.add(); // Blit
        v.reset(material, passID, sceneFlags, camera, blitType);
        return v;
    }
    createRenderData (): RenderData {
        const v = this.rd1.add(); // RenderData
        v.reset();
        return v;
    }
    createRenderGraph (): RenderGraph {
        const v = this.rg1.add(); // RenderGraph
        v.clear();
        return v;
    }
    public readonly renderCommon: RenderCommonObjectPool;
    private readonly cv: RecyclePool<ClearValue> = createPool(ClearValue);
    private readonly rv: RecyclePool<RasterView> = createPool(RasterView);
    private readonly cv1: RecyclePool<ComputeView> = createPool(ComputeView);
    private readonly rd: RecyclePool<ResourceDesc> = createPool(ResourceDesc);
    private readonly rt: RecyclePool<ResourceTraits> = createPool(ResourceTraits);
    private readonly rs: RecyclePool<RenderSwapchain> = createPool(RenderSwapchain);
    private readonly rs1: RecyclePool<ResourceStates> = createPool(ResourceStates);
    private readonly mb: RecyclePool<ManagedBuffer> = createPool(ManagedBuffer);
    private readonly pb: RecyclePool<PersistentBuffer> = createPool(PersistentBuffer);
    private readonly mt: RecyclePool<ManagedTexture> = createPool(ManagedTexture);
    private readonly pt: RecyclePool<PersistentTexture> = createPool(PersistentTexture);
    private readonly mr: RecyclePool<ManagedResource> = createPool(ManagedResource);
    private readonly s: RecyclePool<Subpass> = createPool(Subpass);
    private readonly sg: RecyclePool<SubpassGraph> = createPool(SubpassGraph);
    private readonly rs2: RecyclePool<RasterSubpass> = createPool(RasterSubpass);
    private readonly cs: RecyclePool<ComputeSubpass> = createPool(ComputeSubpass);
    private readonly rp: RecyclePool<RasterPass> = createPool(RasterPass);
    private readonly prpaf: RecyclePool<PersistentRenderPassAndFramebuffer> = createPool(PersistentRenderPassAndFramebuffer);
    private readonly fv: RecyclePool<FormatView> = createPool(FormatView);
    private readonly sv: RecyclePool<SubresourceView> = createPool(SubresourceView);
    private readonly rg: RecyclePool<ResourceGraph> = createPool(ResourceGraph);
    private readonly cp: RecyclePool<ComputePass> = createPool(ComputePass);
    private readonly rp1: RecyclePool<ResolvePass> = createPool(ResolvePass);
    private readonly cp1: RecyclePool<CopyPass> = createPool(CopyPass);
    private readonly mp: RecyclePool<MovePass> = createPool(MovePass);
    private readonly rp2: RecyclePool<RaytracePass> = createPool(RaytracePass);
    private readonly cv2: RecyclePool<ClearView> = createPool(ClearView);
    private readonly rq: RecyclePool<RenderQueue> = createPool(RenderQueue);
    private readonly sd: RecyclePool<SceneData> = createPool(SceneData);
    private readonly d: RecyclePool<Dispatch> = createPool(Dispatch);
    private readonly b: RecyclePool<Blit> = createPool(Blit);
    private readonly rd1: RecyclePool<RenderData> = createPool(RenderData);
    private readonly rg1: RecyclePool<RenderGraph> = createPool(RenderGraph);
}
