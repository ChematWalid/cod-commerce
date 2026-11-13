import { describe, expect, it } from 'vitest';
import { parsePooledJobId, toPooledJobId } from '../../domain/pooled-job-id';

describe('pooled job ids', () => {
  it('round-trips a pool and a BullMQ id', () => {
    // Act
    const id = toPooledJobId('critical', 'od-7301-demo-log');

    // Assert
    expect(id).toBe('critical.od-7301-demo-log');
    expect(parsePooledJobId(id)).toEqual({ pool: 'critical', bullId: 'od-7301-demo-log' });
  });

  it('keeps dots after the first one in the BullMQ id', () => {
    expect(parsePooledJobId('bulk.a.b')).toEqual({ pool: 'bulk', bullId: 'a.b' });
  });

  it('accepts a numeric id', () => {
    expect(parsePooledJobId(42)).toBeUndefined();
    expect(parsePooledJobId('bulk.42')).toEqual({ pool: 'bulk', bullId: '42' });
  });

  it.each(['42', 'llm.1', 'critical.', '.1', ''])('refuses %j', (id) => {
    expect(parsePooledJobId(id)).toBeUndefined();
  });
});
