import { describe, expect, it } from 'vitest';
import { CREATE_OFFERS_KEY, EDIT_OFFERS_KEY } from '../../dashboard/constants';
import { editorAccessOf } from '../../dashboard/model/editor-access';

const DRAFT = { allowedMoves: ['publish', 'archive'], editable: true } as const;
const ACTIVE = { allowedMoves: ['pause', 'archive'], editable: true } as const;
const ARCHIVED = { allowedMoves: [], editable: false } as const;

describe('the editor access (D2543)', () => {
  it('lets a creator save and publish a new offer', () => {
    // Arrange, Act
    const access = editorAccessOf(null, new Set([CREATE_OFFERS_KEY, EDIT_OFFERS_KEY]));

    // Assert
    expect(access).toEqual({ canSave: true, canPublish: true, isDraft: true });
  });

  it('shows Publish only while the server allows the move', () => {
    // Arrange
    const held = new Set([EDIT_OFFERS_KEY]);

    // Act
    const [draft, active] = [editorAccessOf(DRAFT, held), editorAccessOf(ACTIVE, held)];

    // Assert
    expect(draft.isDraft).toBe(true);
    expect(active).toEqual({ canSave: true, canPublish: false, isDraft: false });
  });

  it('saves nothing on an offer the server says is no longer editable', () => {
    // Arrange, Act
    const access = editorAccessOf(ARCHIVED, new Set([EDIT_OFFERS_KEY]));

    // Assert
    expect(access.canSave).toBe(false);
  });

  it('saves an existing offer only with the edit key', () => {
    // Arrange, Act
    const access = editorAccessOf(DRAFT, new Set([CREATE_OFFERS_KEY]));

    // Assert
    expect(access.canSave).toBe(false);
  });

  it('saves a new draft but never publishes it for a member with create and not edit', () => {
    // Arrange, Act
    const access = editorAccessOf(null, new Set([CREATE_OFFERS_KEY]));

    // Assert
    expect(access).toEqual({ canSave: true, canPublish: false, isDraft: true });
  });

  it('publishes a saved draft with the edit key', () => {
    // Arrange, Act
    const access = editorAccessOf(DRAFT, new Set([EDIT_OFFERS_KEY]));

    // Assert
    expect(access.canPublish).toBe(true);
  });
});
