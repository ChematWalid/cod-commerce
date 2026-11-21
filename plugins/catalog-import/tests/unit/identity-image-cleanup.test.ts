import { CATALOG_IMPORT_ERROR_CODES, toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { AiSwitchPort } from '../../application/ports/ai-switch.port';
import { IdentityImageCleanup } from '../../infrastructure/identity-image-cleanup';
import { IdentityPolisher } from '../../infrastructure/identity-polisher';

const SCOPE = { businessId: toBusinessId('1'), storeId: toStoreId('2') };
const IMAGE = { bytes: new Uint8Array([137, 80, 78, 71]), contentType: 'image/png' };

const switchOf = (enabled: boolean): AiSwitchPort & { asked: unknown[] } => {
  const asked: unknown[] = [];
  return {
    asked,
    isEnabled: (scope) => {
      asked.push(scope);
      return Promise.resolve(enabled);
    },
  };
};

describe('the AI hooks (D2215)', () => {
  it('image cleanup returns the input image', async () => {
    // Arrange
    const ai = switchOf(true);

    // Act
    const cleaned = await new IdentityImageCleanup(ai).cleanup(SCOPE, IMAGE);

    // Assert
    expect(cleaned).toBe(IMAGE);
    expect(ai.asked).toEqual([SCOPE]);
  });

  it('image cleanup refuses when `ai.enabled` is off', async () => {
    // Act and Assert
    await expect(new IdentityImageCleanup(switchOf(false)).cleanup(SCOPE, IMAGE)).rejects.toMatchObject({
      code: CATALOG_IMPORT_ERROR_CODES.AI_DISABLED,
    });
  });

  it('polish returns the text unchanged', async () => {
    // Arrange
    const text = { title: 'Synthetic kaftan', description: '<p>Light</p>' };

    // Act
    const polished = await new IdentityPolisher().polish(SCOPE, text);

    // Assert
    expect(polished).toEqual(text);
  });
});
