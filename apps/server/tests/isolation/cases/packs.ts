import { CATALOG_PACKS_ERROR_CODES } from '@cod/shared';
import { operationRequest, sweepCases } from '../endpoint-sweep';
import { ownChannel, type IsolationCase } from '../matrix';
import { packBody, packTargetOf, PACKS_ENDPOINTS, SAVE_PACK_DOCUMENT } from '../packs-operations';

/**
 * The pack cells (plugins/catalog-packs, P2.S2): every endpoint's sweep (B's pack by id, A's owner on A's second
 * store naming A's first-store pack (D2280), B's store token, a store-restricted member on the store it may not
 * reach), plus A's own pack saved with B's components, which must be
 * refused as not found and leave A's pack as it was.
 */
const SAVE_WITH_FOREIGN_COMPONENTS: IsolationCase = {
  id: 'packs.saveCatalogPack.foreign-components',
  entity: 'pack',
  endpoint: 'saveCatalogPack',
  access: 'write',
  title: "A's owner saves A's pack naming B's products as components: not found, A's pack unchanged",
  request: (a, b) => {
    const own = packTargetOf(a);
    const foreign = packTargetOf(b);
    const input = packBody({ ...own, componentId: foreign.componentId, otherComponentId: foreign.otherComponentId });
    return operationRequest(
      SAVE_PACK_DOCUMENT,
      { id: own.productId, input },
      { caller: a.owner, channel: ownChannel(a) },
    );
  },
  expect: { kind: 'code', code: CATALOG_PACKS_ERROR_CODES.COMPONENT_NOT_FOUND },
  reverse: true,
};

export const PACKS_CASES: readonly IsolationCase[] = [...sweepCases(PACKS_ENDPOINTS), SAVE_WITH_FOREIGN_COMPONENTS];
