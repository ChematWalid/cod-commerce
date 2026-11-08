import { useLingui } from '@lingui/react';
import { useQuery } from '@tanstack/react-query';
import { api, Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../domain/constants';
import { TEMPLATE_NOTES_NAV_ITEM, TEMPLATE_NOTES_TEST_ID } from '../constants';
import {
  TEMPLATE_NOTES_QUERY,
  type TemplateNoteDto,
  type TemplateNotesResult,
  type TemplateNotesVariables,
} from '../notes-query';

const PAGE_ID = 'template-notes';
const NOTES_BLOCK_ID = 'template-notes-list';
const NOTES_QUERY_KEY = ['template-notes'] as const;

/** The notes once loaded, or why they could not be. */
type NotesState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly notes: readonly TemplateNoteDto[] }
  | { readonly status: 'failed'; readonly message: string };

/**
 * Reads the notes through the dashboard's query client: switching the channel invalidates every query, so this
 * one refetches with the new channel's token. While it fetches the page shows the loading state, never the
 * previous business's notes.
 */
function useTemplateNotes(): NotesState {
  const query = useQuery({
    queryKey: NOTES_QUERY_KEY,
    queryFn: () => {
      const variables: TemplateNotesVariables = { take: DEFAULT_PAGE_SIZE };
      return api.query<TemplateNotesResult>(TEMPLATE_NOTES_QUERY, variables);
    },
    retry: false,
  });
  if (query.isFetching) {
    return { status: 'loading' };
  }
  if (query.isError) {
    // Shown on the page rather than swallowed: an empty list must never hide a failed query.
    return { status: 'failed', message: query.error.message };
  }
  return query.isSuccess ? { status: 'loaded', notes: query.data.templateNotes } : { status: 'loading' };
}

function NotesList({ state }: { readonly state: NotesState }): ReactNode {
  if (state.status === 'loading') {
    return <p>…</p>;
  }
  if (state.status === 'failed') {
    return <p role="alert">{state.message}</p>;
  }
  return (
    <ul>
      {state.notes.map((note) => (
        <li key={note.id}>
          <strong>{note.title}</strong> {note.body}
        </li>
      ))}
    </ul>
  );
}

/** The template's notes page: the newest notes of the business of the selected channel. */
export function NotesPage(): ReactNode {
  const state = useTemplateNotes();
  const { i18n } = useLingui();
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>{i18n._(TEMPLATE_NOTES_NAV_ITEM.title)}</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId={NOTES_BLOCK_ID}>
          <div data-testid={TEMPLATE_NOTES_TEST_ID}>
            <NotesList state={state} />
          </div>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}
