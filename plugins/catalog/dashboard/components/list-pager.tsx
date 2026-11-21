import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { pageCountOf } from '../model/list-search';
import { LtrRun } from './ltr-run';

interface ListPagerProps {
  readonly page: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
}

/** Previous and next, shown only when the list holds more than one page. */
export function ListPager({ page, total, onPage }: ListPagerProps): ReactNode {
  const { i18n } = useLingui();
  const pages = pageCountOf(total);
  if (pages === 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {i18n._('catalog.page-previous')}
      </Button>
      <LtrRun>{`${String(page)} / ${String(pages)}`}</LtrRun>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {i18n._('catalog.page-next')}
      </Button>
    </div>
  );
}
