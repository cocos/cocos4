import { Node } from '../../cocos/scene-graph';
import { ParticleSystem2D } from '../../cocos/particle-2d/particle-system-2d';

describe('ParticleSystem2D editor preview', () => {
    let node: Node;
    let particles: ParticleSystem2D;

    beforeEach(() => {
        node = new Node('particles');
        particles = node.addComponent(ParticleSystem2D)!;
    });

    afterEach(() => {
        node.destroy();
    });

    test('restarts emission when preview is enabled again without changing selection', () => {
        particles.preview = true;
        expect(particles.active).toBe(true);

        for (let cycle = 0; cycle < 3; ++cycle) {
            particles.preview = false;
            expect(particles.active).toBe(false);
            particles.preview = true;
            expect(particles.active).toBe(true);
        }
    });

    test('keeps preview disabled on focus and preserves focus restart when enabled', () => {
        particles.preview = false;
        particles.onFocusInEditor();
        expect(particles.active).toBe(false);

        particles.preview = true;
        particles.onLostFocusInEditor();
        expect(particles.active).toBe(false);
        particles.onFocusInEditor();
        expect(particles.active).toBe(true);
    });
});
