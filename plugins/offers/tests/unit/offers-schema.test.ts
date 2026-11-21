import { describe, expect, it } from 'vitest';
import { offersAdminApiSchema } from '../../api/schema';

/** The parts of a GraphQL type reference this test reads. */
interface TypeRef {
  readonly kind: string;
  readonly type?: TypeRef;
  readonly name?: { readonly value: string };
}

/** The parts of a GraphQL definition this test reads. */
interface Definition {
  readonly kind: string;
  readonly name?: { readonly value: string };
  readonly fields?: readonly { readonly name: { readonly value: string }; readonly type: TypeRef }[];
}

/** A type reference as written in the schema, such as `Float!`. */
function typeText(type: TypeRef): string {
  if (type.kind === 'NonNullType' && type.type) return `${typeText(type.type)}!`;
  if (type.kind === 'ListType' && type.type) return `[${typeText(type.type)}]`;
  return type.name?.value ?? '';
}

/** The written type of each field of the schema's object type `typeName`, by field name. */
function fieldTypesOf(typeName: string): Record<string, string> {
  const definitions = offersAdminApiSchema.definitions as readonly Definition[];
  const type = definitions.find(
    (definition) => definition.kind === 'ObjectTypeDefinition' && definition.name?.value === typeName,
  );
  return Object.fromEntries((type?.fields ?? []).map((field) => [field.name.value, typeText(field.type)]));
}

describe('offers Admin API schema (D2535)', () => {
  it('types the summed money of an offer performance as Float, since a sum outgrows a 32-bit Int', () => {
    // Arrange
    const typeName = 'OfferPerformance';

    // Act
    const fieldTypes = fieldTypesOf(typeName);

    // Assert
    expect(fieldTypes).toEqual({ orders: 'Int!', deliveredRevenue: 'Float!', discountGiven: 'Float!' });
  });
});
