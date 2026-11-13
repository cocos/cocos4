/* Copyright (c) 2026 Xiamen Yaji Software Co., Ltd. */

import { Enum, Vec3 } from '../../core';
import type { IGeometry } from '../../primitive/define';
import type { SpriteFrame } from '../assets/sprite-frame';

/** @en World sprite geometry mode. @zh 世界精灵几何模式。 */
export enum SpriteDrawMode { SIMPLE = 0, SLICED = 1, TILED = 2 }
Enum(SpriteDrawMode);
/** @en World sprite tiling rule. @zh 世界精灵平铺规则。 */
export enum SpriteTileMode { CONTINUOUS = 0, ADAPTIVE = 1 }
Enum(SpriteTileMode);

// Keep every primitive within the portable 16-bit index range, including restart-index backends.
export const MAX_SPRITE_QUADS = 16383;
const EPSILON = 1e-6;
interface Axis {
    size: number;
    leading: number;
    trailing: number;
    startUV: number;
    endUV: number;
    unit: number;
    count: number;
    center: number;
    total: number;
}
interface Segment { start: number; end: number; uvStart: number; uvEnd: number }

function axis (
    size: number,
    pixels: number,
    before: number,
    after: number,
    ppu: number,
    mode: SpriteDrawMode,
    tileMode: SpriteTileMode,
    threshold: number,
): Axis | string {
    const border = (before + after) / ppu;
    const scale = border > size ? size / border : 1;
    const leading = before / ppu * scale;
    const trailing = after / ppu * scale;
    const center = Math.max(0, size - border);
    const unit = (pixels - before - after) / ppu;
    if (![border, leading, trailing, center, unit].every(Number.isFinite)) return 'source dimensions overflow local units';
    let count = center > 0 ? 1 : 0;
    if (mode === SpriteDrawMode.TILED && center > 0) {
        if (unit <= 0) return 'a non-empty tiled region requires a positive source repeat size';
        const ratio = center / unit;
        // Suppress a rounding-only tail at exact multiples, using a fixed tolerance in tile units.
        const nearest = Math.round(ratio);
        const normalized = Math.abs(ratio - nearest) <= EPSILON ? nearest : ratio;
        if (tileMode === SpriteTileMode.CONTINUOUS) {
            count = Math.max(1, Math.ceil(normalized));
        } else {
            const whole = Math.floor(normalized);
            const fraction = normalized - whole;
            count = Math.max(1, whole + (fraction > 0 && fraction + EPSILON >= threshold ? 1 : 0));
        }
    }
    const total = count + Number(leading > 0) + Number(trailing > 0);
    if (total === 0) return 'target size collapses to an empty axis';
    if (!Number.isFinite(total) || total > MAX_SPRITE_QUADS) return `geometry exceeds ${MAX_SPRITE_QUADS} quads`;
    return { size,
        leading,
        trailing,
        center,
        unit,
        count,
        startUV: before / pixels,
        endUV: 1 - after / pixels,
        total };
}

function segments (a: Axis, continuous: boolean): Segment[] {
    const result: Segment[] = [];
    if (a.leading > 0) result.push({ start: 0, end: a.leading, uvStart: 0, uvEnd: a.startUV });
    for (let i = 0; i < a.count; ++i) {
        const start = continuous ? i * a.unit : i * a.center / a.count;
        const end = i === a.count - 1 ? a.center : continuous ? (i + 1) * a.unit : (i + 1) * a.center / a.count;
        const fraction = continuous ? Math.min(1, (end - start) / a.unit) : 1;
        result.push({ start: a.leading + start,
            end: a.leading + end,
            uvStart: a.startUV,
            uvEnd: a.startUV + (a.endUV - a.startUV) * fraction });
    }
    if (a.trailing > 0) result.push({ start: a.size - a.trailing, end: a.size, uvStart: a.endUV, uvEnd: 1 });
    return result;
}

/** @engineInternal CPU geometry only. Resource ownership remains with SpriteRenderer. */
export function generateSpriteGeometry (
    frame: SpriteFrame,
    width: number,
    height: number,
    mode: SpriteDrawMode,
    tileMode: SpriteTileMode,
    threshold: number,
): { geometry: IGeometry | null; error?: string } {
    if (![width, height].every((v) => Number.isFinite(v) && v >= 0)) return { geometry: null, error: 'size must be finite and non-negative' };
    if (width === 0 || height === 0) return { geometry: null };
    if (mode !== SpriteDrawMode.SLICED && mode !== SpriteDrawMode.TILED) return { geometry: null, error: 'unsupported draw mode' };
    if (mode === SpriteDrawMode.TILED) {
        if (tileMode !== SpriteTileMode.CONTINUOUS && tileMode !== SpriteTileMode.ADAPTIVE) {
            return { geometry: null, error: 'unsupported tile mode' };
        }
        if (tileMode === SpriteTileMode.ADAPTIVE && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)) {
            return { geometry: null, error: 'adaptive threshold must be finite and between 0 and 1' };
        }
    }
    const { width: sourceWidth, height: sourceHeight } = frame.rect;
    const ppu = frame.pixelsToUnit;
    if (![sourceWidth, sourceHeight, ppu].every((v) => Number.isFinite(v) && v > 0)
        || !frame._isRectMesh()) return { geometry: null, error: 'a positive Rect source and PPU are required' };
    // UV flips are texture-axis flips. Rotation exchanges their local geometry axes.
    const swapX = frame.rotated ? frame.flipUVY : frame.flipUVX;
    const swapY = frame.rotated ? frame.flipUVX : frame.flipUVY;
    const left = swapX ? frame.insetRight : frame.insetLeft;
    const right = swapX ? frame.insetLeft : frame.insetRight;
    const bottom = swapY ? frame.insetTop : frame.insetBottom;
    const top = swapY ? frame.insetBottom : frame.insetTop;
    if (![left, right, bottom, top].every((v) => Number.isFinite(v) && v >= 0)
        || left + right > sourceWidth || bottom + top > sourceHeight) return { geometry: null, error: 'invalid source border' };
    const x = axis(width, sourceWidth, left, right, ppu, mode, tileMode, threshold);
    const y = axis(height, sourceHeight, bottom, top, ppu, mode, tileMode, threshold);
    if (typeof x === 'string') return { geometry: null, error: x };
    if (typeof y === 'string') return { geometry: null, error: y };
    const quads = x.total * y.total;
    // Check before allocating segment/vertex arrays, including extreme and overflowing ratios.
    if (quads > MAX_SPRITE_QUADS) return { geometry: null, error: `geometry exceeds ${MAX_SPRITE_QUADS} quads` };
    const originX = -frame.pivot.x * width;
    const originY = -frame.pivot.y * height;
    const maxX = originX + width;
    const maxY = originY + height;
    const uv = frame._getSourceUVs();
    if (![originX, originY, maxX, maxY].every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v)))
        || uv.length !== 8 || !uv.every((v) => Number.isFinite(Math.fround(v)))) return { geometry: null, error: 'invalid pivot, bounds or UVs' };
    // The fourth authored corner need not form a parallelogram with the other three.
    const crossU = (uv[6] - uv[4]) - (uv[2] - uv[0]);
    const crossV = (uv[7] - uv[5]) - (uv[3] - uv[1]);
    const continuous = mode === SpriteDrawMode.TILED && tileMode === SpriteTileMode.CONTINUOUS;
    const xs = segments(x, continuous);
    const ys = segments(y, continuous);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (const row of ys) {
        for (const col of xs) {
            const index = positions.length / 3;
            for (const [px, py, u, v] of [
                [col.start, row.start, col.uvStart, row.uvStart],
                [col.end, row.start, col.uvEnd, row.uvStart],
                [col.start, row.end, col.uvStart, row.uvEnd],
                [col.end, row.end, col.uvEnd, row.uvEnd],
            ]) {
                positions.push(originX + px, originY + py, 0);
                uvs.push(
                    uv[0] + (uv[2] - uv[0]) * u + (uv[4] - uv[0]) * v + crossU * u * v,
                    uv[1] + (uv[3] - uv[1]) * u + (uv[5] - uv[1]) * v + crossV * u * v,
                );
            }
            indices.push(index, index + 1, index + 2, index + 2, index + 1, index + 3);
        }
    }
    return { geometry: { positions, uvs, indices, minPos: new Vec3(originX, originY, 0), maxPos: new Vec3(maxX, maxY, 0) } };
}
