import { BadRequestException } from '@nestjs/common';
import type { AreaLevelInputDto, CreateBusinessRoleInputDto, UpdateBusinessRoleInputDto } from './dto';

type Fields = Readonly<Record<string, unknown>>;

const recordOf = (body: unknown): Fields =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Fields) : {};

const refuse = (field: string): never => {
  throw new BadRequestException(`${field} has the wrong type`);
};

const optionalText = (fields: Fields, name: string): string | null | undefined => {
  const value = fields[name];
  if (value === undefined || value === null || typeof value === 'string') return value;
  return refuse(name);
};

const optionalStrings = (fields: Fields, name: string): readonly string[] | undefined => {
  const value = fields[name];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  return refuse(name);
};

const isAreaLevel = (value: unknown): value is AreaLevelInputDto => {
  const entry = recordOf(value);
  return typeof entry['area'] === 'string' && typeof entry['level'] === 'string';
};

const optionalAreaLevels = (fields: Fields): readonly AreaLevelInputDto[] | undefined => {
  const value = fields['areaLevels'];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.every(isAreaLevel)) return value;
  return refuse('areaLevels');
};

const choicesFrom = (fields: Fields) => ({
  startFromRoleId: optionalText(fields, 'startFromRoleId'),
  areaLevels: optionalAreaLevels(fields),
  grants: optionalStrings(fields, 'grants'),
  revokes: optionalStrings(fields, 'revokes'),
});

/** A create body in the shape of the GraphQL input. @throws BadRequestException naming the field, never its value. */
export function createRoleBody(body: unknown): CreateBusinessRoleInputDto {
  const fields = recordOf(body);
  const name = fields['name'];
  if (typeof name !== 'string') return refuse('name');
  return { name, description: optionalText(fields, 'description'), ...choicesFrom(fields) };
}

/** An update body: a field left out keeps its value, and `description: null` clears it. */
export function updateRoleBody(body: unknown): UpdateBusinessRoleInputDto {
  const fields = recordOf(body);
  return {
    name: optionalText(fields, 'name'),
    ...('description' in fields ? { description: optionalText(fields, 'description') } : {}),
    ...choicesFrom(fields),
  };
}

/** The copy's language of a duplicate body, if sent. */
export function duplicateLocale(body: unknown): string | undefined {
  return optionalText(recordOf(body), 'locale') ?? undefined;
}
