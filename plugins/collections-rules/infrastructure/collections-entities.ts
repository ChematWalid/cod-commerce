import { CollectionDefinitionEntity } from './collection-definition.entity';
import { CollectionMemberEntity } from './collection-member.entity';

/** The plugin's own tables (D2300), each a `TenantEntity` reached only through `TenantRepository`. */
export const COLLECTIONS_ENTITIES = [CollectionDefinitionEntity, CollectionMemberEntity];
