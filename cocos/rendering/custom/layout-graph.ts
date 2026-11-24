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
import { COCOS_RUNTIME, HTML5 } from 'internal:constants';
import { DescriptorSetLayoutInfo, Format, MemoryAccessBit, SampleType, ShaderStageFlagBit, Type, UniformBlock, ViewDimension } from '../../gfx';
import { AdjI, ED, OneInEI, OutE, OutEI, findRelative, getPath } from './graph';
import { loadDescriptorSetLayoutInfo, loadUniformBlock, saveDescriptorSetLayoutInfo, saveUniformBlock } from './serialization';
import { ParameterType, UpdateFrequency } from './types';
import type { DescriptorSet, DescriptorSetLayout, PipelineLayout } from '../../gfx';
import type { AddressableGraph, AdjacencyGraph, BidirectionalGraph, ComponentGraph, MutableGraph, MutableReferenceGraph, NamedGraph, PolymorphicGraph, PropertyGraph, ReferenceGraph, VertexListGraph } from './graph';
import type { RenderCommonObjectPool } from './types';
import { RecyclePool } from '../../core/memop';
import type { OutputArchive, InputArchive } from './archive';

export const enum LayoutType {
    VULKAN,
    WEBGPU,
}

export class Layout {
    static type: LayoutType = LayoutType.VULKAN;
    static isWebGPU: boolean = false;
}

export const enum DescriptorTypeOrder {
    UNIFORM_BUFFER,
    DYNAMIC_UNIFORM_BUFFER,
    SAMPLER_TEXTURE,
    SAMPLER,
    TEXTURE,
    STORAGE_BUFFER,
    DYNAMIC_STORAGE_BUFFER,
    STORAGE_IMAGE,
    INPUT_ATTACHMENT,
}

export class Descriptor {
    constructor (type: Type = Type.UNKNOWN) {
        this.type = type;
    }
    reset (type: Type): void {
        this.type = type;
        this.count = 1;
    }
    declare type: Type;
    count = 1;
}

export class DescriptorBlock {
    reset (): void {
        this.descriptors.clear();
        this.uniformBlocks.clear();
        this.capacity = 0;
        this.count = 0;
    }
    readonly descriptors: Map<string, Descriptor> = new Map<string, Descriptor>();
    readonly uniformBlocks: Map<string, UniformBlock> = new Map<string, UniformBlock>();
    capacity = 0;
    count = 0;
}

export class DescriptorBlockFlattened {
    reset (): void {
        this.descriptorNames.length = 0;
        this.uniformBlockNames.length = 0;
        this.descriptors.length = 0;
        this.uniformBlocks.length = 0;
        this.capacity = 0;
        this.count = 0;
    }
    readonly descriptorNames: string[] = [];
    readonly uniformBlockNames: string[] = [];
    readonly descriptors: Descriptor[] = [];
    readonly uniformBlocks: UniformBlock[] = [];
    capacity = 0;
    count = 0;
}

export class DescriptorBlockIndex {
    constructor (
        updateFrequency: UpdateFrequency = UpdateFrequency.PER_INSTANCE,
        parameterType: ParameterType = ParameterType.CONSTANTS,
        descriptorType: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ) {
        this.updateFrequency = updateFrequency;
        this.parameterType = parameterType;
        this.descriptorType = descriptorType;
        this.visibility = visibility;
    }
    declare updateFrequency: UpdateFrequency;
    declare parameterType: ParameterType;
    declare descriptorType: DescriptorTypeOrder;
    declare visibility: ShaderStageFlagBit;
}

export class DescriptorGroupBlockIndex {
    constructor (
        updateFrequency: UpdateFrequency = UpdateFrequency.PER_INSTANCE,
        parameterType: ParameterType = ParameterType.CONSTANTS,
        descriptorType: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
        accessType: MemoryAccessBit = MemoryAccessBit.READ_ONLY,
        viewDimension: ViewDimension = ViewDimension.UNKNOWN,
        sampleType: SampleType = SampleType.FLOAT,
        format: Format = Format.UNKNOWN,
    ) {
        this.updateFrequency = updateFrequency;
        this.parameterType = parameterType;
        this.descriptorType = descriptorType;
        this.visibility = visibility;
        this.accessType = accessType;
        this.viewDimension = viewDimension;
        this.sampleType = sampleType;
        this.format = format;
    }
    declare updateFrequency: UpdateFrequency;
    declare parameterType: ParameterType;
    declare descriptorType: DescriptorTypeOrder;
    declare visibility: ShaderStageFlagBit;
    declare accessType: MemoryAccessBit;
    declare viewDimension: ViewDimension;
    declare sampleType: SampleType;
    declare format: Format;
}

export class DescriptorDB {
    reset (): void {
        this.blocks.clear();
        this.groupBlocks.clear();
    }
    readonly blocks: Map<string, DescriptorBlock> = new Map<string, DescriptorBlock>();
    readonly groupBlocks: Map<string, DescriptorBlock> = new Map<string, DescriptorBlock>();
}

export class RenderPhase {
    reset (): void {
        this.shaders.clear();
    }
    readonly shaders: Set<string> = new Set<string>();
}

export const enum RenderPassType {
    SINGLE_RENDER_PASS,
    RENDER_PASS,
    RENDER_SUBPASS,
}

export const enum LayoutGraphValue {
    RenderStage,
    RenderPhase,
}

export function getLayoutGraphValueName (kind: LayoutGraphValue): string {
    switch (kind) {
    case LayoutGraphValue.RenderStage: return 'RenderStage';
    case LayoutGraphValue.RenderPhase: return 'RenderPhase';
    default: return '';
    }
}

export interface LayoutGraphValueType {
    [LayoutGraphValue.RenderStage]: RenderPassType;
    [LayoutGraphValue.RenderPhase]: RenderPhase;
}

export interface LayoutGraphVisitor {
    renderStage(value: RenderPassType): unknown;
    renderPhase(value: RenderPhase): unknown;
}

export type LayoutGraphObject = LayoutGraphValueType[LayoutGraphValue];

export class LayoutGraph implements BidirectionalGraph
, AdjacencyGraph
, VertexListGraph
, MutableGraph
, PropertyGraph
, NamedGraph
, ComponentGraph
, PolymorphicGraph
, ReferenceGraph
, MutableReferenceGraph
, AddressableGraph {
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
        this.r.length = 0;
        this.c.length = 0;
        this.p.length = 0;
        this.t.length = 0;
        this.a.length = 0;
        this._names.length = 0;
        this._descriptors.length = 0;
    }

    addVertex<T extends LayoutGraphValue> (
        id: T,
        object: LayoutGraphValueType[T],
        componentName: string,
        componentDescriptors: DescriptorDB,
        parent: number = this.N,
    ): number {
        const v = this.c.length;
        if (v >= this.N) throw new RangeError('Vertex limit exceeded');
        const siblings = parent === this.N ? this.r : this.c[parent];
        try {
            this.c.push([]);
            this.p.push(parent);
            this.t.push(id);
            this.a.push(object);
            this._names.push(componentName);
            this._descriptors.push(componentDescriptors);
            siblings.push(new OutE(v));
        } catch (error) {
            this.c.length = v;
            this.p.length = v;
            this.t.length = v;
            this.a.length = v;
            this._names.length = v;
            this._descriptors.length = v;
            throw error;
        }
        return v;
    }

    addEdge (u: number, v: number): ED | null {
        if (this.p[v] !== this.N || u >= v) return null;
        const children = this.c[u];
        const index = children.findIndex((e) => (e.target as number) > v);
        children.splice(index < 0 ? children.length : index, 0, new OutE(v));
        this.r.splice(this.r.findIndex((e) => e.target === v), 1);
        this.p[v] = u;
        return new ED(u, v);
    }

    // NamedGraph
    vertexName (v: number): string {
        return this._names[v];
    }

    // ComponentGraph
    getName (v: number): string {
        return this._names[v];
    }
    getDescriptors (v: number): DescriptorDB {
        return this._descriptors[v];
    }

    // PolymorphicGraph
    h (id: LayoutGraphValue, v: number): boolean {
        return this.t[v] === id;
    }
    w (v: number): LayoutGraphValue {
        return this.t[v];
    }
    object (v: number): LayoutGraphObject {
        return this.a[v];
    }
    value<T extends LayoutGraphValue> (id: T, v: number): LayoutGraphValueType[T] {
        return this.a[v] as LayoutGraphValueType[typeof id];
    }
    visitVertex (visitor: LayoutGraphVisitor, v: number): unknown {
        const object = this.a[v];
        switch (this.t[v]) {
        case LayoutGraphValue.RenderStage:
            return visitor.renderStage(object as RenderPassType);
        case LayoutGraphValue.RenderPhase:
            return visitor.renderPhase(object as RenderPhase);
        default:
            throw new Error('Unknown vertex kind');
        }
    }
    j<T extends LayoutGraphObject> (v: number): T {
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

    // ParentGraph
    locateChild (parent: number, name: string): number {
        const children = parent === this.N ? this.r : this.c[parent];
        for (const edge of children) {
            const v = edge.target as number;
            if (this.vertexName(v) === name) return v;
        }
        return this.N;
    }

    // AddressableGraph
    locate (absPath: string): number {
        return this.locateRelative(absPath);
    }

    locateRelative (path: string, start: number = this.N): number {
        if (path.length === 0) return this.N;
        return findRelative(this, start, path) as number;
    }

    path (v: number): string {
        return getPath(this, v);
    }

    private readonly r: OutE[] = [];
    private readonly c: OutE[][] = [];
    private readonly p: number[] = [];
    private readonly t: LayoutGraphValue[] = [];
    private readonly a: LayoutGraphObject[] = [];
    private readonly _names: string[] = [];
    private readonly _descriptors: DescriptorDB[] = [];
}

export class UniformData {
    constructor (uniformID = 0xFFFFFFFF, uniformType: Type = Type.UNKNOWN, offset = 0) {
        this.uniformID = uniformID;
        this.uniformType = uniformType;
        this.offset = offset;
    }
    reset (uniformID: number, uniformType: Type, offset: number): void {
        this.uniformID = uniformID;
        this.uniformType = uniformType;
        this.offset = offset;
        this.size = 0;
    }
    declare uniformID: number;
    declare uniformType: Type;
    declare offset: number;
    size = 0;
}

export class UniformBlockData {
    reset (): void {
        this.bufferSize = 0;
        this.uniforms.length = 0;
    }
    bufferSize = 0;
    readonly uniforms: UniformData[] = [];
}

export class DescriptorData {
    constructor (descriptorID = 0, type: Type = Type.UNKNOWN, count = 1) {
        this.descriptorID = descriptorID;
        this.type = type;
        this.count = count;
    }
    reset (descriptorID: number, type: Type, count: number): void {
        this.descriptorID = descriptorID;
        this.type = type;
        this.count = count;
    }
    declare descriptorID: number;
    declare type: Type;
    declare count: number;
}

export class DescriptorBlockData {
    constructor (
        type: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
        capacity = 0,
        accessType: MemoryAccessBit = MemoryAccessBit.READ_ONLY,
        viewDimension: ViewDimension = ViewDimension.UNKNOWN,
        sampleType: SampleType = SampleType.FLOAT,
        format: Format = Format.UNKNOWN,
    ) {
        this.type = type;
        this.visibility = visibility;
        this.capacity = capacity;
        this.accessType = accessType;
        this.viewDimension = viewDimension;
        this.sampleType = sampleType;
        this.format = format;
    }
    reset (
        type: DescriptorTypeOrder,
        visibility: ShaderStageFlagBit,
        capacity: number,
        accessType: MemoryAccessBit,
        viewDimension: ViewDimension,
        sampleType: SampleType,
        format: Format,
    ): void {
        this.type = type;
        this.visibility = visibility;
        this.offset = 0;
        this.capacity = capacity;
        this.accessType = accessType;
        this.viewDimension = viewDimension;
        this.sampleType = sampleType;
        this.format = format;
        this.descriptors.length = 0;
    }
    declare type: DescriptorTypeOrder;
    declare visibility: ShaderStageFlagBit;
    offset = 0;
    declare capacity: number;
    declare accessType: MemoryAccessBit;
    declare viewDimension: ViewDimension;
    declare sampleType: SampleType;
    declare format: Format;
    readonly descriptors: DescriptorData[] = [];
}

export class DescriptorSetLayoutData {
    constructor (
        slot = 0xFFFFFFFF,
        capacity = 0,
        descriptorBlocks: DescriptorBlockData[] = [],
        uniformBlocks: Map<number, UniformBlock> = new Map<number, UniformBlock>(),
        bindingMap: Map<number, number> = new Map<number, number>(),
    ) {
        this.slot = slot;
        this.capacity = capacity;
        this.descriptorBlocks = descriptorBlocks;
        this.uniformBlocks = uniformBlocks;
        this.bindingMap = bindingMap;
    }
    reset (
        slot: number,
        capacity: number,
    ): void {
        this.slot = slot;
        this.capacity = capacity;
        this.uniformBlockCapacity = 0;
        this.samplerTextureCapacity = 0;
        this.descriptorBlocks.length = 0;
        this.uniformBlocks.clear();
        this.bindingMap.clear();
    }
    declare slot: number;
    declare capacity: number;
    uniformBlockCapacity = 0;
    samplerTextureCapacity = 0;
    declare readonly descriptorBlocks: DescriptorBlockData[];
    declare readonly uniformBlocks: Map<number, UniformBlock>;
    declare readonly bindingMap: Map<number, number>;
}

export class DescriptorSetData {
    constructor (
        descriptorSetLayoutData: DescriptorSetLayoutData = new DescriptorSetLayoutData(),
        descriptorSetLayout: DescriptorSetLayout | null = null,
        descriptorSet: DescriptorSet | null = null,
    ) {
        this.descriptorSetLayoutData = descriptorSetLayoutData;
        this.descriptorSetLayout = descriptorSetLayout;
        this.descriptorSet = descriptorSet;
    }
    reset (
        descriptorSetLayout: DescriptorSetLayout | null,
        descriptorSet: DescriptorSet | null,
    ): void {
        this.descriptorSetLayoutData.reset(0xFFFFFFFF, 0);
        this.descriptorSetLayoutInfo.reset();
        this.descriptorSetLayout = descriptorSetLayout;
        this.descriptorSet = descriptorSet;
    }
    declare readonly descriptorSetLayoutData: DescriptorSetLayoutData;
    readonly descriptorSetLayoutInfo: DescriptorSetLayoutInfo = new DescriptorSetLayoutInfo();
    declare /*refcount*/ descriptorSetLayout: DescriptorSetLayout | null;
    declare /*refcount*/ descriptorSet: DescriptorSet | null;
}

export class PipelineLayoutData {
    reset (): void {
        this.descriptorSets.clear();
        this.descriptorGroups.clear();
    }

    getSets (): Map<UpdateFrequency, DescriptorSetData> {
        return (COCOS_RUNTIME || HTML5) && Layout.isWebGPU ? this.descriptorGroups : this.descriptorSets;
    }

    getSet (frequency: UpdateFrequency): DescriptorSetData | undefined {
        return this.getSets().get(frequency);
    }
    readonly descriptorSets: Map<UpdateFrequency, DescriptorSetData> = new Map<UpdateFrequency, DescriptorSetData>();
    readonly descriptorGroups: Map<UpdateFrequency, DescriptorSetData> = new Map<UpdateFrequency, DescriptorSetData>();
}

export class ShaderBindingData {
    reset (): void {
        this.descriptorBindings.clear();
    }
    readonly descriptorBindings: Map<number, number> = new Map<number, number>();
}

export class ShaderLayoutData {
    reset (): void {
        this.layoutData.clear();
        this.bindingData.clear();
    }
    readonly layoutData: Map<UpdateFrequency, DescriptorSetLayoutData> = new Map<UpdateFrequency, DescriptorSetLayoutData>();
    readonly bindingData: Map<UpdateFrequency, ShaderBindingData> = new Map<UpdateFrequency, ShaderBindingData>();
}

export class TechniqueData {
    reset (): void {
        this.passes.length = 0;
    }
    readonly passes: ShaderLayoutData[] = [];
}

export class EffectData {
    reset (): void {
        this.techniques.clear();
    }
    readonly techniques: Map<string, TechniqueData> = new Map<string, TechniqueData>();
}

export class ShaderProgramData {
    reset (): void {
        this.layout.reset();
        this.pipelineLayout = null;
    }
    readonly layout: PipelineLayoutData = new PipelineLayoutData();
    /*refcount*/ pipelineLayout: PipelineLayout | null = null;
}

export class RenderStageData {
    reset (): void {
        this.descriptorVisibility.clear();
    }
    readonly descriptorVisibility: Map<number, ShaderStageFlagBit> = new Map<number, ShaderStageFlagBit>();
}

export class RenderPhaseData {
    reset (): void {
        this.rootSignature = '';
        this.shaderPrograms.length = 0;
        this.shaderIndex.clear();
        this.pipelineLayout = null;
    }
    rootSignature = '';
    readonly shaderPrograms: ShaderProgramData[] = [];
    readonly shaderIndex: Map<string, number> = new Map<string, number>();
    /*refcount*/ pipelineLayout: PipelineLayout | null = null;
}

export const enum LayoutGraphDataValue {
    RenderStage,
    RenderPhase,
}

export function getLayoutGraphDataValueName (kind: LayoutGraphDataValue): string {
    switch (kind) {
    case LayoutGraphDataValue.RenderStage: return 'RenderStage';
    case LayoutGraphDataValue.RenderPhase: return 'RenderPhase';
    default: return '';
    }
}

export interface LayoutGraphDataValueType {
    [LayoutGraphDataValue.RenderStage]: RenderStageData;
    [LayoutGraphDataValue.RenderPhase]: RenderPhaseData;
}

export interface LayoutGraphDataVisitor {
    renderStage(value: RenderStageData): unknown;
    renderPhase(value: RenderPhaseData): unknown;
}

export type LayoutGraphDataObject = LayoutGraphDataValueType[LayoutGraphDataValue];

export class LayoutGraphData implements BidirectionalGraph
, AdjacencyGraph
, VertexListGraph
, MutableGraph
, PropertyGraph
, NamedGraph
, ComponentGraph
, PolymorphicGraph
, ReferenceGraph
, MutableReferenceGraph
, AddressableGraph {
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
    clear (includeTransient = true): void {
        this.r.length = 0;
        this.c.length = 0;
        this.p.length = 0;
        this.t.length = 0;
        this.a.length = 0;
        this._names.length = 0;
        this._updateFrequencies.length = 0;
        this._layouts.length = 0;
        this.valueNames.length = 0;
        this.attributeIndex.clear();
        this.constantIndex.clear();
        this.shaderLayoutIndex.clear();
        this.effects.clear();
        if (includeTransient) this.constantMacros = '';
    }

    addVertex<T extends LayoutGraphDataValue> (
        id: T,
        object: LayoutGraphDataValueType[T],
        componentName: string,
        componentUpdate: UpdateFrequency,
        componentLayout: PipelineLayoutData,
        parent: number = this.N,
    ): number {
        const v = this.c.length;
        if (v >= this.N) throw new RangeError('Vertex limit exceeded');
        const siblings = parent === this.N ? this.r : this.c[parent];
        try {
            this.c.push([]);
            this.p.push(parent);
            this.t.push(id);
            this.a.push(object);
            this._names.push(componentName);
            this._updateFrequencies.push(componentUpdate);
            this._layouts.push(componentLayout);
            siblings.push(new OutE(v));
        } catch (error) {
            this.c.length = v;
            this.p.length = v;
            this.t.length = v;
            this.a.length = v;
            this._names.length = v;
            this._updateFrequencies.length = v;
            this._layouts.length = v;
            throw error;
        }
        return v;
    }

    addEdge (u: number, v: number): ED | null {
        if (this.p[v] !== this.N || u >= v) return null;
        const children = this.c[u];
        const index = children.findIndex((e) => (e.target as number) > v);
        children.splice(index < 0 ? children.length : index, 0, new OutE(v));
        this.r.splice(this.r.findIndex((e) => e.target === v), 1);
        this.p[v] = u;
        return new ED(u, v);
    }

    // NamedGraph
    vertexName (v: number): string {
        return this._names[v];
    }

    // ComponentGraph
    getName (v: number): string {
        return this._names[v];
    }
    getUpdate (v: number): UpdateFrequency {
        return this._updateFrequencies[v];
    }
    setUpdate (v: number, value: UpdateFrequency): void {
        this._updateFrequencies[v] = value;
    }
    getLayout (v: number): PipelineLayoutData {
        return this._layouts[v];
    }

    // PolymorphicGraph
    h (id: LayoutGraphDataValue, v: number): boolean {
        return this.t[v] === id;
    }
    w (v: number): LayoutGraphDataValue {
        return this.t[v];
    }
    object (v: number): LayoutGraphDataObject {
        return this.a[v];
    }
    value<T extends LayoutGraphDataValue> (id: T, v: number): LayoutGraphDataValueType[T] {
        return this.a[v] as LayoutGraphDataValueType[typeof id];
    }
    visitVertex (visitor: LayoutGraphDataVisitor, v: number): unknown {
        const object = this.a[v];
        switch (this.t[v]) {
        case LayoutGraphDataValue.RenderStage:
            return visitor.renderStage(object as RenderStageData);
        case LayoutGraphDataValue.RenderPhase:
            return visitor.renderPhase(object as RenderPhaseData);
        default:
            throw new Error('Unknown vertex kind');
        }
    }
    j<T extends LayoutGraphDataObject> (v: number): T {
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

    // ParentGraph
    locateChild (parent: number, name: string): number {
        const children = parent === this.N ? this.r : this.c[parent];
        for (const edge of children) {
            const v = edge.target as number;
            if (this.vertexName(v) === name) return v;
        }
        return this.N;
    }

    // AddressableGraph
    locate (absPath: string): number {
        return this.locateRelative(absPath);
    }

    locateRelative (path: string, start: number = this.N): number {
        if (path.length === 0) return this.N;
        return findRelative(this, start, path) as number;
    }

    path (v: number): string {
        return getPath(this, v);
    }

    private readonly r: OutE[] = [];
    private readonly c: OutE[][] = [];
    private readonly p: number[] = [];
    private readonly t: LayoutGraphDataValue[] = [];
    private readonly a: LayoutGraphDataObject[] = [];
    private readonly _names: string[] = [];
    private readonly _updateFrequencies: UpdateFrequency[] = [];
    private readonly _layouts: PipelineLayoutData[] = [];
    readonly valueNames: string[] = [];
    readonly attributeIndex: Map<string, number> = new Map<string, number>();
    readonly constantIndex: Map<string, number> = new Map<string, number>();
    readonly shaderLayoutIndex: Map<string, number> = new Map<string, number>();
    readonly effects: Map<string, EffectData> = new Map<string, EffectData>();
    constantMacros: string = '';
}

function createPool<T> (Constructor: new () => T): RecyclePool<T> {
    return new RecyclePool<T>(() => new Constructor(), 16);
}

export class LayoutGraphObjectPool {
    constructor (renderCommon: RenderCommonObjectPool) {
        this.renderCommon = renderCommon;
    }
    reset (): void {
        this.l.reset(); // Layout
        this.d.reset(); // Descriptor
        this.db.reset(); // DescriptorBlock
        this.dbf.reset(); // DescriptorBlockFlattened
        this.dbi.reset(); // DescriptorBlockIndex
        this.dgbi.reset(); // DescriptorGroupBlockIndex
        this.dd.reset(); // DescriptorDB
        this.rp.reset(); // RenderPhase
        this.lg.reset(); // LayoutGraph
        this.ud.reset(); // UniformData
        this.ubd.reset(); // UniformBlockData
        this.dd1.reset(); // DescriptorData
        this.dbd.reset(); // DescriptorBlockData
        this.dsld.reset(); // DescriptorSetLayoutData
        this.dsd.reset(); // DescriptorSetData
        this.pld.reset(); // PipelineLayoutData
        this.sbd.reset(); // ShaderBindingData
        this.sld.reset(); // ShaderLayoutData
        this.td.reset(); // TechniqueData
        this.ed.reset(); // EffectData
        this.spd.reset(); // ShaderProgramData
        this.rsd.reset(); // RenderStageData
        this.rpd.reset(); // RenderPhaseData
        this.lgd.reset(); // LayoutGraphData
    }
    createLayout (): Layout {
        const v = this.l.add(); // Layout
        return v;
    }
    createDescriptor (
        type: Type = Type.UNKNOWN,
    ): Descriptor {
        const v = this.d.add(); // Descriptor
        v.reset(type);
        return v;
    }
    createDescriptorBlock (): DescriptorBlock {
        const v = this.db.add(); // DescriptorBlock
        v.reset();
        return v;
    }
    createDescriptorBlockFlattened (): DescriptorBlockFlattened {
        const v = this.dbf.add(); // DescriptorBlockFlattened
        v.reset();
        return v;
    }
    createDescriptorBlockIndex (
        updateFrequency: UpdateFrequency = UpdateFrequency.PER_INSTANCE,
        parameterType: ParameterType = ParameterType.CONSTANTS,
        descriptorType: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
    ): DescriptorBlockIndex {
        const v = this.dbi.add(); // DescriptorBlockIndex
        v.updateFrequency = updateFrequency;
        v.parameterType = parameterType;
        v.descriptorType = descriptorType;
        v.visibility = visibility;
        return v;
    }
    createDescriptorGroupBlockIndex (
        updateFrequency: UpdateFrequency = UpdateFrequency.PER_INSTANCE,
        parameterType: ParameterType = ParameterType.CONSTANTS,
        descriptorType: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
        accessType: MemoryAccessBit = MemoryAccessBit.READ_ONLY,
        viewDimension: ViewDimension = ViewDimension.UNKNOWN,
        sampleType: SampleType = SampleType.FLOAT,
        format: Format = Format.UNKNOWN,
    ): DescriptorGroupBlockIndex {
        const v = this.dgbi.add(); // DescriptorGroupBlockIndex
        v.updateFrequency = updateFrequency;
        v.parameterType = parameterType;
        v.descriptorType = descriptorType;
        v.visibility = visibility;
        v.accessType = accessType;
        v.viewDimension = viewDimension;
        v.sampleType = sampleType;
        v.format = format;
        return v;
    }
    createDescriptorDB (): DescriptorDB {
        const v = this.dd.add(); // DescriptorDB
        v.reset();
        return v;
    }
    createRenderPhase (): RenderPhase {
        const v = this.rp.add(); // RenderPhase
        v.reset();
        return v;
    }
    createLayoutGraph (): LayoutGraph {
        const v = this.lg.add(); // LayoutGraph
        v.clear();
        return v;
    }
    createUniformData (
        uniformID = 0xFFFFFFFF,
        uniformType: Type = Type.UNKNOWN,
        offset = 0,
    ): UniformData {
        const v = this.ud.add(); // UniformData
        v.reset(uniformID, uniformType, offset);
        return v;
    }
    createUniformBlockData (): UniformBlockData {
        const v = this.ubd.add(); // UniformBlockData
        v.reset();
        return v;
    }
    createDescriptorData (
        descriptorID = 0,
        type: Type = Type.UNKNOWN,
        count = 1,
    ): DescriptorData {
        const v = this.dd1.add(); // DescriptorData
        v.reset(descriptorID, type, count);
        return v;
    }
    createDescriptorBlockData (
        type: DescriptorTypeOrder = DescriptorTypeOrder.UNIFORM_BUFFER,
        visibility: ShaderStageFlagBit = ShaderStageFlagBit.NONE,
        capacity = 0,
        accessType: MemoryAccessBit = MemoryAccessBit.READ_ONLY,
        viewDimension: ViewDimension = ViewDimension.UNKNOWN,
        sampleType: SampleType = SampleType.FLOAT,
        format: Format = Format.UNKNOWN,
    ): DescriptorBlockData {
        const v = this.dbd.add(); // DescriptorBlockData
        v.reset(type, visibility, capacity, accessType, viewDimension, sampleType, format);
        return v;
    }
    createDescriptorSetLayoutData (
        slot = 0xFFFFFFFF,
        capacity = 0,
    ): DescriptorSetLayoutData {
        const v = this.dsld.add(); // DescriptorSetLayoutData
        v.reset(slot, capacity);
        return v;
    }
    createDescriptorSetData (
        descriptorSetLayout: DescriptorSetLayout | null = null,
        descriptorSet: DescriptorSet | null = null,
    ): DescriptorSetData {
        const v = this.dsd.add(); // DescriptorSetData
        v.reset(descriptorSetLayout, descriptorSet);
        return v;
    }
    createPipelineLayoutData (): PipelineLayoutData {
        const v = this.pld.add(); // PipelineLayoutData
        v.reset();
        return v;
    }
    createShaderBindingData (): ShaderBindingData {
        const v = this.sbd.add(); // ShaderBindingData
        v.reset();
        return v;
    }
    createShaderLayoutData (): ShaderLayoutData {
        const v = this.sld.add(); // ShaderLayoutData
        v.reset();
        return v;
    }
    createTechniqueData (): TechniqueData {
        const v = this.td.add(); // TechniqueData
        v.reset();
        return v;
    }
    createEffectData (): EffectData {
        const v = this.ed.add(); // EffectData
        v.reset();
        return v;
    }
    createShaderProgramData (): ShaderProgramData {
        const v = this.spd.add(); // ShaderProgramData
        v.reset();
        return v;
    }
    createRenderStageData (): RenderStageData {
        const v = this.rsd.add(); // RenderStageData
        v.reset();
        return v;
    }
    createRenderPhaseData (): RenderPhaseData {
        const v = this.rpd.add(); // RenderPhaseData
        v.reset();
        return v;
    }
    createLayoutGraphData (): LayoutGraphData {
        const v = this.lgd.add(); // LayoutGraphData
        v.clear();
        return v;
    }
    public readonly renderCommon: RenderCommonObjectPool;
    private readonly l: RecyclePool<Layout> = createPool(Layout);
    private readonly d: RecyclePool<Descriptor> = createPool(Descriptor);
    private readonly db: RecyclePool<DescriptorBlock> = createPool(DescriptorBlock);
    private readonly dbf: RecyclePool<DescriptorBlockFlattened> = createPool(DescriptorBlockFlattened);
    private readonly dbi: RecyclePool<DescriptorBlockIndex> = createPool(DescriptorBlockIndex);
    private readonly dgbi: RecyclePool<DescriptorGroupBlockIndex> = createPool(DescriptorGroupBlockIndex);
    private readonly dd: RecyclePool<DescriptorDB> = createPool(DescriptorDB);
    private readonly rp: RecyclePool<RenderPhase> = createPool(RenderPhase);
    private readonly lg: RecyclePool<LayoutGraph> = createPool(LayoutGraph);
    private readonly ud: RecyclePool<UniformData> = createPool(UniformData);
    private readonly ubd: RecyclePool<UniformBlockData> = createPool(UniformBlockData);
    private readonly dd1: RecyclePool<DescriptorData> = createPool(DescriptorData);
    private readonly dbd: RecyclePool<DescriptorBlockData> = createPool(DescriptorBlockData);
    private readonly dsld: RecyclePool<DescriptorSetLayoutData> = createPool(DescriptorSetLayoutData);
    private readonly dsd: RecyclePool<DescriptorSetData> = createPool(DescriptorSetData);
    private readonly pld: RecyclePool<PipelineLayoutData> = createPool(PipelineLayoutData);
    private readonly sbd: RecyclePool<ShaderBindingData> = createPool(ShaderBindingData);
    private readonly sld: RecyclePool<ShaderLayoutData> = createPool(ShaderLayoutData);
    private readonly td: RecyclePool<TechniqueData> = createPool(TechniqueData);
    private readonly ed: RecyclePool<EffectData> = createPool(EffectData);
    private readonly spd: RecyclePool<ShaderProgramData> = createPool(ShaderProgramData);
    private readonly rsd: RecyclePool<RenderStageData> = createPool(RenderStageData);
    private readonly rpd: RecyclePool<RenderPhaseData> = createPool(RenderPhaseData);
    private readonly lgd: RecyclePool<LayoutGraphData> = createPool(LayoutGraphData);
}

export function saveDescriptor (a: OutputArchive, v: Descriptor): void {
    a.n(v.type);
    a.n(v.count);
}

export function loadDescriptor (a: InputArchive, v: Descriptor): void {
    v.type = a.n();
    v.count = a.n();
}

export function saveDescriptorBlock (a: OutputArchive, v: DescriptorBlock): void {
    a.n(v.descriptors.size);
    for (const [key0, item0] of v.descriptors) {
        a.s(key0);
        saveDescriptor(a, item0);
    }
    a.n(v.uniformBlocks.size);
    for (const [key0, item0] of v.uniformBlocks) {
        a.s(key0);
        saveUniformBlock(a, item0);
    }
    a.n(v.capacity);
    a.n(v.count);
}

export function loadDescriptorBlock (a: InputArchive, v: DescriptorBlock): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = new Descriptor();
        loadDescriptor(a, item0);
        v.descriptors.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = new UniformBlock();
        loadUniformBlock(a, item0);
        v.uniformBlocks.set(key0, item0);
    }
    v.capacity = a.n();
    v.count = a.n();
}

export function saveDescriptorBlockFlattened (a: OutputArchive, v: DescriptorBlockFlattened): void {
    a.n(v.descriptorNames.length);
    for (const item0 of v.descriptorNames) {
        a.s(item0);
    }
    a.n(v.uniformBlockNames.length);
    for (const item0 of v.uniformBlockNames) {
        a.s(item0);
    }
    a.n(v.descriptors.length);
    for (const item0 of v.descriptors) {
        saveDescriptor(a, item0);
    }
    a.n(v.uniformBlocks.length);
    for (const item0 of v.uniformBlocks) {
        saveUniformBlock(a, item0);
    }
    a.n(v.capacity);
    a.n(v.count);
}

export function loadDescriptorBlockFlattened (a: InputArchive, v: DescriptorBlockFlattened): void {
    const n = a.n();
    v.descriptorNames.length = n;
    for (let i = 0; i < n; ++i) {
        v.descriptorNames[i] = a.s();
    }
    const n1 = a.n();
    v.uniformBlockNames.length = n1;
    for (let i = 0; i < n1; ++i) {
        v.uniformBlockNames[i] = a.s();
    }
    const n2 = a.n();
    v.descriptors.length = n2;
    for (let i = 0; i < n2; ++i) {
        const item0 = new Descriptor();
        loadDescriptor(a, item0);
        v.descriptors[i] = item0;
    }
    const n3 = a.n();
    v.uniformBlocks.length = n3;
    for (let i = 0; i < n3; ++i) {
        const item0 = new UniformBlock();
        loadUniformBlock(a, item0);
        v.uniformBlocks[i] = item0;
    }
    v.capacity = a.n();
    v.count = a.n();
}

export function saveDescriptorBlockIndex (a: OutputArchive, v: DescriptorBlockIndex): void {
    a.n(v.updateFrequency);
    a.n(v.parameterType);
    a.n(v.descriptorType);
    a.n(v.visibility);
}

export function loadDescriptorBlockIndex (a: InputArchive, v: DescriptorBlockIndex): void {
    v.updateFrequency = a.n();
    v.parameterType = a.n();
    v.descriptorType = a.n();
    v.visibility = a.n();
}

export function saveDescriptorGroupBlockIndex (a: OutputArchive, v: DescriptorGroupBlockIndex): void {
    a.n(v.updateFrequency);
    a.n(v.parameterType);
    a.n(v.descriptorType);
    a.n(v.visibility);
    a.n(v.accessType);
    a.n(v.viewDimension);
    a.n(v.sampleType);
    a.n(v.format);
}

export function loadDescriptorGroupBlockIndex (a: InputArchive, v: DescriptorGroupBlockIndex): void {
    v.updateFrequency = a.n();
    v.parameterType = a.n();
    v.descriptorType = a.n();
    v.visibility = a.n();
    v.accessType = a.n();
    v.viewDimension = a.n();
    v.sampleType = a.n();
    v.format = a.n();
}

export function saveDescriptorDB (a: OutputArchive, v: DescriptorDB): void {
    a.n(v.blocks.size);
    for (const [key0, item0] of v.blocks) {
        saveDescriptorBlockIndex(a, JSON.parse(key0) as DescriptorBlockIndex);
        saveDescriptorBlock(a, item0);
    }
    a.n(v.groupBlocks.size);
    for (const [key0, item0] of v.groupBlocks) {
        saveDescriptorGroupBlockIndex(a, JSON.parse(key0) as DescriptorGroupBlockIndex);
        saveDescriptorBlock(a, item0);
    }
}

export function loadDescriptorDB (a: InputArchive, v: DescriptorDB): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = new DescriptorBlockIndex();
        loadDescriptorBlockIndex(a, key0);
        const item0 = new DescriptorBlock();
        loadDescriptorBlock(a, item0);
        v.blocks.set(JSON.stringify(key0), item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = new DescriptorGroupBlockIndex();
        loadDescriptorGroupBlockIndex(a, key0);
        const item0 = new DescriptorBlock();
        loadDescriptorBlock(a, item0);
        v.groupBlocks.set(JSON.stringify(key0), item0);
    }
}

export function saveRenderPhase (a: OutputArchive, v: RenderPhase): void {
    a.n(v.shaders.size);
    for (const item0 of v.shaders) {
        a.s(item0);
    }
}

export function loadRenderPhase (a: InputArchive, v: RenderPhase): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const item0 = a.s();
        v.shaders.add(item0);
    }
}

export function saveLayoutGraph (a: OutputArchive, g: LayoutGraph): void {
    const counts = new Array<number>(2).fill(0);
    let edges = 0;
    for (const v of g.v()) {
        edges += g.od(v);
        ++counts[g.w(v)];
    }
    a.n(g.nv());
    a.n(edges);
    for (const n of counts) a.n(n);
    for (const v of g.v()) {
        a.n(g.w(v));
        a.n(g.getParent(v));
        a.s(g.getName(v));
        saveDescriptorDB(a, g.getDescriptors(v));
        switch (g.w(v)) {
        case LayoutGraphValue.RenderStage:
            a.n(g.value(LayoutGraphValue.RenderStage, v));
            break;
        case LayoutGraphValue.RenderPhase:
            saveRenderPhase(a, g.value(LayoutGraphValue.RenderPhase, v));
            break;
        default:
            break;
        }
    }
}

export function loadLayoutGraph (a: InputArchive, g: LayoutGraph): void {
    g.clear();
    const size = a.n();
    let edges = a.n();
    const counts = Array.from({ length: 2 }, () => a.n());
    for (let i = 0; i < size; ++i) {
        const kind = a.n();
        const parent = a.n();
        if (kind >= counts.length || !counts[kind]) throw new RangeError('Invalid graph archive kind');
        --counts[kind];
        if (parent !== g.N) {
            if (parent >= i || !edges) throw new RangeError('Invalid graph archive parent');
            --edges;
        }
        const componentName = a.s();
        const componentDescriptors = new DescriptorDB();
        loadDescriptorDB(a, componentDescriptors);
        switch (kind) {
        case LayoutGraphValue.RenderStage: {
            const payload = a.n();
            g.addVertex(LayoutGraphValue.RenderStage, payload, componentName, componentDescriptors, parent);
            break;
        }
        case LayoutGraphValue.RenderPhase: {
            const payload = new RenderPhase();
            loadRenderPhase(a, payload);
            g.addVertex(LayoutGraphValue.RenderPhase, payload, componentName, componentDescriptors, parent);
            break;
        }
        default:
            break;
        }
    }
    if (edges || counts.some((n) => n !== 0)) throw new RangeError('Invalid graph archive counts');
}

export function saveUniformData (a: OutputArchive, v: UniformData): void {
    a.n(v.uniformID);
    a.n(v.uniformType);
    a.n(v.offset);
    a.n(v.size);
}

export function loadUniformData (a: InputArchive, v: UniformData): void {
    v.uniformID = a.n();
    v.uniformType = a.n();
    v.offset = a.n();
    v.size = a.n();
}

export function saveUniformBlockData (a: OutputArchive, v: UniformBlockData): void {
    a.n(v.bufferSize);
    a.n(v.uniforms.length);
    for (const item0 of v.uniforms) {
        saveUniformData(a, item0);
    }
}

export function loadUniformBlockData (a: InputArchive, v: UniformBlockData): void {
    v.bufferSize = a.n();
    const n = a.n();
    v.uniforms.length = n;
    for (let i = 0; i < n; ++i) {
        const item0 = new UniformData();
        loadUniformData(a, item0);
        v.uniforms[i] = item0;
    }
}

export function saveDescriptorData (a: OutputArchive, v: DescriptorData): void {
    a.n(v.descriptorID);
    a.n(v.type);
    a.n(v.count);
}

export function loadDescriptorData (a: InputArchive, v: DescriptorData): void {
    v.descriptorID = a.n();
    v.type = a.n();
    v.count = a.n();
}

export function saveDescriptorBlockData (a: OutputArchive, v: DescriptorBlockData): void {
    a.n(v.type);
    a.n(v.visibility);
    a.n(v.offset);
    a.n(v.capacity);
    a.n(v.accessType);
    a.n(v.viewDimension);
    a.n(v.sampleType);
    a.n(v.format);
    a.n(v.descriptors.length);
    for (const item0 of v.descriptors) {
        saveDescriptorData(a, item0);
    }
}

export function loadDescriptorBlockData (a: InputArchive, v: DescriptorBlockData): void {
    v.type = a.n();
    v.visibility = a.n();
    v.offset = a.n();
    v.capacity = a.n();
    v.accessType = a.n();
    v.viewDimension = a.n();
    v.sampleType = a.n();
    v.format = a.n();
    const n = a.n();
    v.descriptors.length = n;
    for (let i = 0; i < n; ++i) {
        const item0 = new DescriptorData();
        loadDescriptorData(a, item0);
        v.descriptors[i] = item0;
    }
}

export function saveDescriptorSetLayoutData (a: OutputArchive, v: DescriptorSetLayoutData): void {
    a.n(v.slot);
    a.n(v.capacity);
    a.n(v.uniformBlockCapacity);
    a.n(v.samplerTextureCapacity);
    a.n(v.descriptorBlocks.length);
    for (const item0 of v.descriptorBlocks) {
        saveDescriptorBlockData(a, item0);
    }
    a.n(v.uniformBlocks.size);
    for (const [key0, item0] of v.uniformBlocks) {
        a.n(key0);
        saveUniformBlock(a, item0);
    }
    a.n(v.bindingMap.size);
    for (const [key0, item0] of v.bindingMap) {
        a.n(key0);
        a.n(item0);
    }
}

export function loadDescriptorSetLayoutData (a: InputArchive, v: DescriptorSetLayoutData): void {
    v.slot = a.n();
    v.capacity = a.n();
    v.uniformBlockCapacity = a.n();
    v.samplerTextureCapacity = a.n();
    const n = a.n();
    v.descriptorBlocks.length = n;
    for (let i = 0; i < n; ++i) {
        const item0 = new DescriptorBlockData();
        loadDescriptorBlockData(a, item0);
        v.descriptorBlocks[i] = item0;
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = new UniformBlock();
        loadUniformBlock(a, item0);
        v.uniformBlocks.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = a.n();
        v.bindingMap.set(key0, item0);
    }
}

export function saveDescriptorSetData (a: OutputArchive, v: DescriptorSetData): void {
    saveDescriptorSetLayoutData(a, v.descriptorSetLayoutData);
    saveDescriptorSetLayoutInfo(a, v.descriptorSetLayoutInfo);
    // skip, v.descriptorSetLayout: DescriptorSetLayout
    // skip, v.descriptorSet: DescriptorSet
}

export function loadDescriptorSetData (a: InputArchive, v: DescriptorSetData): void {
    loadDescriptorSetLayoutData(a, v.descriptorSetLayoutData);
    loadDescriptorSetLayoutInfo(a, v.descriptorSetLayoutInfo);
    // skip, v.descriptorSetLayout: DescriptorSetLayout
    // skip, v.descriptorSet: DescriptorSet
}

export function savePipelineLayoutData (a: OutputArchive, v: PipelineLayoutData): void {
    a.n(v.descriptorSets.size);
    for (const [key0, item0] of v.descriptorSets) {
        a.n(key0);
        saveDescriptorSetData(a, item0);
    }
    a.n(v.descriptorGroups.size);
    for (const [key0, item0] of v.descriptorGroups) {
        a.n(key0);
        saveDescriptorSetData(a, item0);
    }
}

export function loadPipelineLayoutData (a: InputArchive, v: PipelineLayoutData): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = new DescriptorSetData();
        loadDescriptorSetData(a, item0);
        v.descriptorSets.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = new DescriptorSetData();
        loadDescriptorSetData(a, item0);
        v.descriptorGroups.set(key0, item0);
    }
}

export function saveShaderBindingData (a: OutputArchive, v: ShaderBindingData): void {
    a.n(v.descriptorBindings.size);
    for (const [key0, item0] of v.descriptorBindings) {
        a.n(key0);
        a.n(item0);
    }
}

export function loadShaderBindingData (a: InputArchive, v: ShaderBindingData): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = a.n();
        v.descriptorBindings.set(key0, item0);
    }
}

export function saveShaderLayoutData (a: OutputArchive, v: ShaderLayoutData): void {
    a.n(v.layoutData.size);
    for (const [key0, item0] of v.layoutData) {
        a.n(key0);
        saveDescriptorSetLayoutData(a, item0);
    }
    a.n(v.bindingData.size);
    for (const [key0, item0] of v.bindingData) {
        a.n(key0);
        saveShaderBindingData(a, item0);
    }
}

export function loadShaderLayoutData (a: InputArchive, v: ShaderLayoutData): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = new DescriptorSetLayoutData();
        loadDescriptorSetLayoutData(a, item0);
        v.layoutData.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = new ShaderBindingData();
        loadShaderBindingData(a, item0);
        v.bindingData.set(key0, item0);
    }
}

export function saveTechniqueData (a: OutputArchive, v: TechniqueData): void {
    a.n(v.passes.length);
    for (const item0 of v.passes) {
        saveShaderLayoutData(a, item0);
    }
}

export function loadTechniqueData (a: InputArchive, v: TechniqueData): void {
    const n = a.n();
    v.passes.length = n;
    for (let i = 0; i < n; ++i) {
        const item0 = new ShaderLayoutData();
        loadShaderLayoutData(a, item0);
        v.passes[i] = item0;
    }
}

export function saveEffectData (a: OutputArchive, v: EffectData): void {
    a.n(v.techniques.size);
    for (const [key0, item0] of v.techniques) {
        a.s(key0);
        saveTechniqueData(a, item0);
    }
}

export function loadEffectData (a: InputArchive, v: EffectData): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = new TechniqueData();
        loadTechniqueData(a, item0);
        v.techniques.set(key0, item0);
    }
}

export function saveShaderProgramData (a: OutputArchive, v: ShaderProgramData): void {
    savePipelineLayoutData(a, v.layout);
    // skip, v.pipelineLayout: PipelineLayout
}

export function loadShaderProgramData (a: InputArchive, v: ShaderProgramData): void {
    loadPipelineLayoutData(a, v.layout);
    // skip, v.pipelineLayout: PipelineLayout
}

export function saveRenderStageData (a: OutputArchive, v: RenderStageData): void {
    a.n(v.descriptorVisibility.size);
    for (const [key0, item0] of v.descriptorVisibility) {
        a.n(key0);
        a.n(item0);
    }
}

export function loadRenderStageData (a: InputArchive, v: RenderStageData): void {
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.n();
        const item0 = a.n();
        v.descriptorVisibility.set(key0, item0);
    }
}

export function saveRenderPhaseData (a: OutputArchive, v: RenderPhaseData): void {
    a.s(v.rootSignature);
    a.n(v.shaderPrograms.length);
    for (const item0 of v.shaderPrograms) {
        saveShaderProgramData(a, item0);
    }
    a.n(v.shaderIndex.size);
    for (const [key0, item0] of v.shaderIndex) {
        a.s(key0);
        a.n(item0);
    }
    // skip, v.pipelineLayout: PipelineLayout
}

export function loadRenderPhaseData (a: InputArchive, v: RenderPhaseData): void {
    v.rootSignature = a.s();
    const n = a.n();
    v.shaderPrograms.length = n;
    for (let i = 0; i < n; ++i) {
        const item0 = new ShaderProgramData();
        loadShaderProgramData(a, item0);
        v.shaderPrograms[i] = item0;
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = a.n();
        v.shaderIndex.set(key0, item0);
    }
    // skip, v.pipelineLayout: PipelineLayout
}

export function saveLayoutGraphData (a: OutputArchive, g: LayoutGraphData): void {
    const counts = new Array<number>(2).fill(0);
    let edges = 0;
    for (const v of g.v()) {
        edges += g.od(v);
        ++counts[g.w(v)];
    }
    a.n(g.nv());
    a.n(edges);
    for (const n of counts) a.n(n);
    for (const v of g.v()) {
        a.n(g.w(v));
        a.n(g.getParent(v));
        a.s(g.getName(v));
        a.n(g.getUpdate(v));
        savePipelineLayoutData(a, g.getLayout(v));
        switch (g.w(v)) {
        case LayoutGraphDataValue.RenderStage:
            saveRenderStageData(a, g.value(LayoutGraphDataValue.RenderStage, v));
            break;
        case LayoutGraphDataValue.RenderPhase:
            saveRenderPhaseData(a, g.value(LayoutGraphDataValue.RenderPhase, v));
            break;
        default:
            break;
        }
    }
    a.n(g.valueNames.length);
    for (const item0 of g.valueNames) {
        a.s(item0);
    }
    a.n(g.attributeIndex.size);
    for (const [key0, item0] of g.attributeIndex) {
        a.s(key0);
        a.n(item0);
    }
    a.n(g.constantIndex.size);
    for (const [key0, item0] of g.constantIndex) {
        a.s(key0);
        a.n(item0);
    }
    a.n(g.shaderLayoutIndex.size);
    for (const [key0, item0] of g.shaderLayoutIndex) {
        a.s(key0);
        a.n(item0);
    }
    a.n(g.effects.size);
    for (const [key0, item0] of g.effects) {
        a.s(key0);
        saveEffectData(a, item0);
    }
}

export function loadLayoutGraphData (a: InputArchive, g: LayoutGraphData): void {
    g.clear(false);
    const size = a.n();
    let edges = a.n();
    const counts = Array.from({ length: 2 }, () => a.n());
    for (let i = 0; i < size; ++i) {
        const kind = a.n();
        const parent = a.n();
        if (kind >= counts.length || !counts[kind]) throw new RangeError('Invalid graph archive kind');
        --counts[kind];
        if (parent !== g.N) {
            if (parent >= i || !edges) throw new RangeError('Invalid graph archive parent');
            --edges;
        }
        const componentName = a.s();
        const componentUpdate = a.n();
        const componentLayout = new PipelineLayoutData();
        loadPipelineLayoutData(a, componentLayout);
        switch (kind) {
        case LayoutGraphDataValue.RenderStage: {
            const payload = new RenderStageData();
            loadRenderStageData(a, payload);
            g.addVertex(LayoutGraphDataValue.RenderStage, payload, componentName, componentUpdate, componentLayout, parent);
            break;
        }
        case LayoutGraphDataValue.RenderPhase: {
            const payload = new RenderPhaseData();
            loadRenderPhaseData(a, payload);
            g.addVertex(LayoutGraphDataValue.RenderPhase, payload, componentName, componentUpdate, componentLayout, parent);
            break;
        }
        default:
            break;
        }
    }
    if (edges || counts.some((n) => n !== 0)) throw new RangeError('Invalid graph archive counts');
    const n = a.n();
    g.valueNames.length = n;
    for (let i = 0; i < n; ++i) {
        g.valueNames[i] = a.s();
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = a.n();
        g.attributeIndex.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = a.n();
        g.constantIndex.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = a.n();
        g.shaderLayoutIndex.set(key0, item0);
    }
    for (let left0 = a.n(); left0 > 0; --left0) {
        const key0 = a.s();
        const item0 = new EffectData();
        loadEffectData(a, item0);
        g.effects.set(key0, item0);
    }
}
