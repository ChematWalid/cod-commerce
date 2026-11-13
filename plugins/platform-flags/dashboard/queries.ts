import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { FLAGS_QUERY_KEY, type OverrideScope } from './constants';

/** One override of a flag, as the Admin API answers it. */
export interface FlagOverrideDto {
  readonly scope: OverrideScope;
  readonly scopeId: string;
  readonly enabled: boolean;
}

/** A flag with its overrides. */
export interface FlagDto {
  readonly key: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly rolloutPercent: number;
  readonly updatedAt: string;
  readonly overrides: readonly FlagOverrideDto[];
}

/** The fields staff change on a flag. */
export interface FlagPatch {
  readonly defaultEnabled?: boolean;
  readonly rolloutPercent?: number;
}

/** The identity of an override. */
export interface OverrideKey {
  readonly key: string;
  readonly scope: OverrideScope;
  readonly scopeId: string;
}

/** An override to create or replace. */
export interface OverrideInput extends OverrideKey {
  readonly enabled: boolean;
}

const FLAG_FIELDS = /* GraphQL */ `
  fragment PlatformFlagFields on FeatureFlag {
    key
    description
    defaultEnabled
    rolloutPercent
    updatedAt
    overrides {
      scope
      scopeId
      enabled
    }
  }
`;

const FLAGS_QUERY = /* GraphQL */ `
  query PlatformFeatureFlags {
    featureFlags {
      ...PlatformFlagFields
    }
  }
  ${FLAG_FIELDS}
`;

const UPDATE_FLAG_MUTATION = /* GraphQL */ `
  mutation PlatformUpdateFeatureFlag($input: UpdateFeatureFlagInput!) {
    updateFeatureFlag(input: $input) {
      ...PlatformFlagFields
    }
  }
  ${FLAG_FIELDS}
`;

const SET_OVERRIDE_MUTATION = /* GraphQL */ `
  mutation PlatformSetFeatureFlagOverride($input: FeatureFlagOverrideInput!) {
    setFeatureFlagOverride(input: $input) {
      ...PlatformFlagFields
    }
  }
  ${FLAG_FIELDS}
`;

const REMOVE_OVERRIDE_MUTATION = /* GraphQL */ `
  mutation PlatformRemoveFeatureFlagOverride($input: FeatureFlagOverrideKeyInput!) {
    removeFeatureFlagOverride(input: $input) {
      ...PlatformFlagFields
    }
  }
  ${FLAG_FIELDS}
`;

/** Every flag. Disabled until `enabled`, so a caller who is not platform staff sends no query. */
export function useFeatureFlags(enabled: boolean): ReturnType<typeof useQuery<readonly FlagDto[]>> {
  return useQuery({
    queryKey: FLAGS_QUERY_KEY,
    queryFn: async () => (await api.query<{ readonly featureFlags: readonly FlagDto[] }>(FLAGS_QUERY)).featureFlags,
    enabled,
    retry: false,
  });
}

/** Writes the flag the server returned into the cached list, so every row shows the saved state. */
export function useReplaceFlag(): (flag: FlagDto) => void {
  const queryClient = useQueryClient();
  return (flag) => {
    queryClient.setQueryData<readonly FlagDto[]>(FLAGS_QUERY_KEY, (flags) =>
      flags?.map((candidate) => (candidate.key === flag.key ? flag : candidate)),
    );
  };
}

/** Documents are untyped here, as in the other dashboards: the answer is typed where it is read. */
async function mutateFlag(document: string, name: string, input: object): Promise<FlagDto> {
  const answer = (await api.mutate(document, { input })) as Readonly<Record<string, FlagDto>>;
  const flag = answer[name];
  if (flag === undefined) throw new Error(`The answer has no ${name}`);
  return flag;
}

export function updateFlag(key: string, patch: FlagPatch): Promise<FlagDto> {
  return mutateFlag(UPDATE_FLAG_MUTATION, 'updateFeatureFlag', { key, ...patch });
}

export function setOverride(input: OverrideInput): Promise<FlagDto> {
  return mutateFlag(SET_OVERRIDE_MUTATION, 'setFeatureFlagOverride', input);
}

export function removeOverride(input: OverrideKey): Promise<FlagDto> {
  return mutateFlag(REMOVE_OVERRIDE_MUTATION, 'removeFeatureFlagOverride', input);
}
