/*
 Copyright (c) 2024 Xiamen Yaji Software Co., Ltd.
 https://www.cocos.com/
*/
import { B2ObjectType, getTSObjectFromWASMObjectPtr } from './instantiated';
import { PhysicsContact } from './physics-contact';

const pools: PhysicsContact[] = [];

export class PhysicsContactManager {
    static get (b2contact: number): PhysicsContact {
        let c = pools.pop();
        if (!c) {
            c = new PhysicsContact();
        }
        c.init(b2contact);
        return c;
    }
    static find (b2contact: number): PhysicsContact | null {
        return getTSObjectFromWASMObjectPtr<PhysicsContact>(B2ObjectType.Contact, b2contact);
    }

    static put (b2contact: number): void {
        const c = getTSObjectFromWASMObjectPtr<PhysicsContact>(B2ObjectType.Contact, b2contact);
        if (!c) return;

        pools.push(c);
        c.reset();
    }

    static clear (): void {
        pools.length = 0;
    }
}
