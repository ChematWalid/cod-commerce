import { api, Page, PageBlock, PageLayout, PageTitle } from '@vendure/dashboard';
import { type ReactNode, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../domain/constants';
import { TEMPLATE_NOTES_TEST_ID } from '../constants';
import {
  TEMPLATE_NOTES_QUERY,
  type TemplateNoteDto,
  type TemplateNotesResult,
  type TemplateNotesVariables,
} from '../notes-query';

const PAGE_ID = 'template-notes';
const NOTES_BLOCK_ID = 'template-notes-list';

/** The notes once loaded, or why they could not be. */
type NotesState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly notes: readonly TemplateNoteDto[] }
  | { readonly status: 'failed'; readonly message: string };

function useTemplateNotes(): NotesState {
  const [state, setState] = useState<NotesState>({ status: 'loading' });
  useEffect(() => {
    const variables: TemplateNotesVariables = { take: DEFAULT_PAGE_SIZE };
    api
      .query<TemplateNotesResult>(TEMPLATE_NOTES_QUERY, variables)
      .then((result) => {
        setState({ status: 'loaded', notes: result.templateNotes });
      })
      .catch((error: unknown) => {
        // Shown on the page rather than swallowed: an empty list must never hide a failed query.
        setState({ status: 'failed', message: error instanceof Error ? error.message : String(error) });
      });
  }, []);
  return state;
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
  return (
    <Page pageId={PAGE_ID}>
      <PageTitle>Notes</PageTitle>
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
