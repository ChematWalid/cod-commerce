import { describeNoteRepositoryContract } from '../contract/note-repository.contract';
import { InMemoryNoteRepository } from '../fakes/in-memory-note.repository';

describeNoteRepositoryContract('InMemoryNoteRepository', () => Promise.resolve(new InMemoryNoteRepository()));
