import { Input } from '../../cocos/input';
import { EventTouch } from '../../cocos/input/types';
import { InputEventType } from '../../cocos/input/types/event-enum';
import { touchManager } from '../../pal/input/touch-manager';

type InputPrivateMouseDispatch = {
    _dispatchMouseDownEvent: (nativeMouseEvent: MouseEvent) => void;
    _dispatchMouseUpEvent: (nativeMouseEvent: MouseEvent) => void;
};

function createNativeMouseEvent (clientX: number, clientY: number, buttons: number): MouseEvent {
    return {
        button: 0,
        buttons,
        clientX,
        clientY,
        movementX: 0,
        movementY: 0,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    } as unknown as MouseEvent;
}

afterEach(() => {
    touchManager.releaseTouch(0);
});

test('simulated touch cancels the previous touch before a repeated mouse down', () => {
    const testInput = new Input();
    const privateInput = testInput as unknown as InputPrivateMouseDispatch;
    const receivedEvents: InputEventType[] = [];
    const recordTouchEvent = (eventTouch: EventTouch): void => {
        receivedEvents.push(eventTouch.type as InputEventType);
    };

    testInput.on(Input.EventType.TOUCH_START, recordTouchEvent);
    testInput.on(Input.EventType.TOUCH_END, recordTouchEvent);
    testInput.on(Input.EventType.TOUCH_CANCEL, recordTouchEvent);

    privateInput._dispatchMouseDownEvent(createNativeMouseEvent(10, 20, 1));
    privateInput._dispatchMouseDownEvent(createNativeMouseEvent(30, 40, 1));
    privateInput._dispatchMouseUpEvent(createNativeMouseEvent(30, 40, 0));

    expect(receivedEvents).toEqual([
        Input.EventType.TOUCH_START,
        Input.EventType.TOUCH_CANCEL,
        Input.EventType.TOUCH_START,
        Input.EventType.TOUCH_END,
    ]);
});
