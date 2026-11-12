import { describe, expect, it } from 'vitest';
import { withoutDatedPartitions } from '../e2e/support/schema-catalog';

describe('withoutDatedPartitions', () => {
  it('drops the rows of date-named partitions and keeps one partition count per parent', () => {
    const snapshot = {
      tables: [
        { name: 'outbox_event', kind: 'p', parent: null, bound: null },
        { name: 'outbox_event_p20261112', kind: 'r', parent: 'outbox_event', bound: "FOR VALUES FROM ('2026-11-12')" },
        { name: 'outbox_event_p20261113', kind: 'r', parent: 'outbox_event', bound: "FOR VALUES FROM ('2026-11-13')" },
        { name: 'migrations', kind: 'r', parent: null, bound: null },
      ],
      columns: [
        { table: 'outbox_event', name: 'id' },
        { table: 'outbox_event_p20261112', name: 'id' },
      ],
      indexes: [
        { table: 'outbox_event_p20261112', name: 'outbox_event_p20261112_pkey' },
        { table: 'outbox_event', name: 'outbox_event_pkey' },
      ],
    };

    const normalised = withoutDatedPartitions(snapshot);

    expect(normalised['tables']).toEqual([
      { name: 'outbox_event', kind: 'p', parent: null, bound: null },
      { name: 'migrations', kind: 'r', parent: null, bound: null },
    ]);
    expect(normalised['columns']).toEqual([{ table: 'outbox_event', name: 'id' }]);
    expect(normalised['indexes']).toEqual([{ table: 'outbox_event', name: 'outbox_event_pkey' }]);
    expect(normalised['partitionCounts']).toEqual([{ parent: 'outbox_event', count: 2 }]);
  });

  it('gives the same result for two windows of the same size on different days', () => {
    const window = (days: string[]): Record<string, unknown[]> => ({
      tables: days.map((day) => ({ name: `t_p${day}`, parent: 't', bound: day })),
    });

    expect(withoutDatedPartitions(window(['20261112', '20261113']))).toEqual(
      withoutDatedPartitions(window(['20261113', '20261114'])),
    );
  });
});
