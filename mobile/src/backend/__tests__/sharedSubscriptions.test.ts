/// <reference types="jest" />
import { createSubscriptionHub, sameElements, type StartSource } from '../sharedSubscriptions';

function source() {
  const s = {
    starts: 0,
    stops: 0,
    emit: null as ((v: number[]) => void) | null,
    fail: null as (() => void) | null,
    start: (emit, fail) => {
      s.starts++;
      s.emit = emit;
      s.fail = fail;
      return () => { s.stops++; };
    },
  } as { starts: number; stops: number; emit: ((v: number[]) => void) | null; fail: (() => void) | null; start: StartSource<number[]> };
  return s;
}

describe('createSubscriptionHub', () => {
  it('shares one source per key, fans out the same value, and stops with the last subscriber', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    const a = jest.fn();
    const b = jest.fn();
    const offA = hub.subscribe('k', src.start, a);
    const offB = hub.subscribe('k', src.start, b);
    expect(src.starts).toBe(1);
    expect(hub.size).toBe(1);

    const v = [1, 2];
    src.emit!(v);
    expect(a).toHaveBeenCalledWith(v);
    expect(b.mock.calls[0][0]).toBe(v); // same instance

    offA();
    offA(); // idempotent
    expect(src.stops).toBe(0);
    offB();
    expect(src.stops).toBe(1);
    expect(hub.size).toBe(0);

    // A new subscriber after everyone left starts a new source.
    hub.subscribe('k', src.start, jest.fn());
    expect(src.starts).toBe(2);
  });

  it('different keys get different sources', () => {
    const hub = createSubscriptionHub<number[]>();
    const s1 = source();
    const s2 = source();
    hub.subscribe('a', s1.start, jest.fn());
    hub.subscribe('b', s2.start, jest.fn());
    expect([s1.starts, s2.starts]).toEqual([1, 1]);
    expect(hub.size).toBe(2);
  });

  it('a late subscriber gets the latest value immediately; nothing before the first value', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    hub.subscribe('k', src.start, jest.fn());
    const early = jest.fn();
    hub.subscribe('k', src.start, early);
    expect(early).not.toHaveBeenCalled();
    const v = [3];
    src.emit!(v);
    const late = jest.fn();
    hub.subscribe('k', src.start, late);
    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0][0]).toBe(v);
  });

  it('does not re-deliver the same value', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    const cb = jest.fn();
    hub.subscribe('k', src.start, cb);
    const v = [1];
    src.emit!(v);
    src.emit!(v);
    expect(cb).toHaveBeenCalledTimes(1);
    src.emit!([1]); // a new value (by identity) is delivered
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('the same callback subscribed twice is two subscriptions', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    const cb = jest.fn();
    const off1 = hub.subscribe('k', src.start, cb);
    hub.subscribe('k', src.start, cb);
    src.emit!([1]);
    expect(cb).toHaveBeenCalledTimes(2);
    off1();
    src.emit!([2]);
    expect(cb).toHaveBeenCalledTimes(3);
    expect(src.stops).toBe(0);
  });

  it('a subscriber unsubscribing another during delivery does not break fan-out', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    let offB = () => {};
    const b = jest.fn();
    hub.subscribe('k', src.start, () => offB());
    offB = hub.subscribe('k', src.start, b);
    src.emit!([1]);
    expect(b).not.toHaveBeenCalled();
    expect(src.stops).toBe(0);
  });

  it('a source that emits synchronously while starting delivers to its first subscriber at once', () => {
    const hub = createSubscriptionHub<number[]>();
    let stops = 0;
    const cb = jest.fn();
    const off = hub.subscribe('k', (emit) => { emit([1]); return () => { stops++; }; }, cb);
    expect(cb).toHaveBeenCalledWith([1]);
    off();
    expect(stops).toBe(1);
    expect(hub.size).toBe(0);
  });

  it('after a failure, current subscribers stay attached but new ones start a fresh source', () => {
    const hub = createSubscriptionHub<number[]>();
    const src = source();
    const offA = hub.subscribe('k', src.start, jest.fn());
    src.fail!();
    expect(hub.size).toBe(0);
    const offB = hub.subscribe('k', src.start, jest.fn());
    expect(src.starts).toBe(2);
    offA();
    expect(src.stops).toBe(1); // the dead one
    expect(hub.size).toBe(1); // the fresh one is still live
    offB();
    expect(src.stops).toBe(2);
    expect(hub.size).toBe(0);
  });
});

describe('sameElements', () => {
  it('compares by identity and order', () => {
    const a = { x: 1 };
    const b = { x: 1 };
    expect(sameElements([a, b], [a, b])).toBe(true);
    expect(sameElements([a, b], [b, a])).toBe(false);
    expect(sameElements([a], [{ x: 1 }])).toBe(false);
    expect(sameElements(null, [])).toBe(false);
    expect(sameElements([], [])).toBe(true);
  });
});
