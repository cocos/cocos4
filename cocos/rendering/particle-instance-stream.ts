import { cclegacy, Mat4 } from '../core';
import { BufferInfo, BufferUsageBit, MemoryUsageBit, InputAssemblerInfo } from '../gfx';
import type { Buffer, Device, InputAssembler } from '../gfx';
import type { SubModel } from '../render-scene/scene';
import type { Pass } from '../render-scene/core/pass';

type Entry = { subModel: SubModel | null } & ({ passIdx: number } | { passIndex: number });
const sources = new WeakMap<SubModel, ParticleInstanceStream>();

function sameMaterialState (a: Pass, b: Pass): boolean {
    if (a.hash !== b.hash || a.dynamicStates || b.dynamicStates) return false;
    const world = a.defines.CC_USE_WORLD_SPACE;
    const transformBinding = world ? a.getBinding('particleWorldMatrix') : -1;
    for (const { binding, count } of a.descriptorSet.layout.bindings) {
        if (binding === transformBinding) continue;
        const lhs = a.blocksInt[binding];
        const rhs = b.blocksInt[binding];
        if (lhs || rhs) {
            if (!lhs || !rhs || lhs.length !== rhs.length) return false;
            for (let i = 0; i < lhs.length; ++i) {
                if (lhs[i] !== rhs[i]) return false;
            }
        } else {
            for (let i = 0; i < count; ++i) {
                if (a.descriptorSet.getTexture(binding, i) !== b.descriptorSet.getTexture(binding, i)
                    || a.descriptorSet.getSampler(binding, i) !== b.descriptorSet.getSampler(binding, i)) return false;
            }
        }
    }
    return true;
}

/** CPU billboard instance records, in the order already selected by camera culling and queue sorting. */
export class ParticleInstanceStream {
    private slots: { buffer: Buffer; bytes: Uint8Array; ia: InputAssembler }[] = [];
    private frame = -1;
    private cursor = 0;
    public group = '';

    constructor (readonly subModel: SubModel, readonly data: Uint8Array, readonly matrix: Readonly<Mat4>) {
        sources.set(subModel, this);
    }

    public destroy (): void {
        sources.delete(this.subModel);
        for (const slot of this.slots) {
            slot.ia.destroy();
            slot.buffer.destroy();
        }
        this.slots.length = 0;
    }

    public merge (device: Device, streams: ParticleInstanceStream[], count: number): InputAssembler {
        const frame = cclegacy.director.getTotalFrames();
        if (frame !== this.frame) {
            this.frame = frame;
            this.cursor = 0;
        }
        const source = this.subModel.inputAssembler;
        const stride = source.vertexBuffers[0].stride;
        const size = count * stride;
        let slot = this.slots[this.cursor];
        if (!slot || slot.bytes.length < size) {
            if (slot) {
                slot.ia.destroy();
                slot.buffer.destroy();
            }
            const capacity = stride * 2 ** Math.ceil(Math.log2(count));
            const buffer = device.createBuffer(new BufferInfo(
                BufferUsageBit.VERTEX | BufferUsageBit.TRANSFER_DST,
                MemoryUsageBit.DEVICE,
                capacity,
                stride,
            ));
            const ia = device.createInputAssembler(new InputAssemblerInfo(source.attributes, [buffer, source.vertexBuffers[1]], source.indexBuffer));
            slot = this.slots[this.cursor] = { buffer, bytes: new Uint8Array(capacity), ia };
        }
        ++this.cursor;
        let offset = 0;
        for (const stream of streams) {
            const length = stream.subModel.inputAssembler.instanceCount * stride;
            slot.bytes.set(stream.data.subarray(0, length), offset);
            offset += length;
        }
        slot.buffer.update(slot.bytes.subarray(0, size));
        slot.ia.indexCount = source.indexCount;
        slot.ia.instanceCount = count;
        return slot.ia;
    }
}

export function batchParticleDraws (device: Device, entries: readonly Entry[], start: number, end: number):
{ ia: InputAssembler; last: number } | null {
    const first = entries[start];
    const sub = first.subModel!;
    const stream = sources.get(sub);
    if (!stream?.group || !sub.inputAssembler.instanceCount) return null;
    const index = 'passIdx' in first ? first.passIdx : first.passIndex;
    const pass = sub.passes[index];
    let streams: ParticleInstanceStream[] | undefined;
    let count = sub.inputAssembler.instanceCount;
    let i = start + 1;
    for (; i < end; ++i) {
        const next = entries[i];
        const other = next.subModel!;
        const candidate = sources.get(other);
        if (!candidate || candidate.group !== stream.group || !other.inputAssembler.instanceCount
            || ('passIdx' in next ? next.passIdx : next.passIndex) !== index
            || sub.shaders[index] !== other.shaders[index]
            || sub.inputAssembler.attributesHash !== other.inputAssembler.attributesHash
            || (!pass.defines.CC_USE_WORLD_SPACE && !Mat4.strictEquals(stream.matrix, candidate.matrix))
            || !sameMaterialState(pass, other.passes[index])) break;
        (streams ??= [stream]).push(candidate);
        count += other.inputAssembler.instanceCount;
    }
    return streams ? { ia: stream.merge(device, streams, count), last: i - 1 } : null;
}
