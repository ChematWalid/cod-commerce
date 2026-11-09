import { api } from '@vendure/dashboard';

/**
 * The auth Admin API as the dashboard calls it. Documents are untyped and typed by the interfaces here, as
 * `plugins/_template` does, because the generated `@/gql` types only exist after `build:dashboard`.
 */
export interface AuthPublicConfigDto {
  readonly oauthEnabled: boolean;
  readonly oauthProviders: readonly string[];
  readonly platformDomain: string;
}

export interface AccountStatusDto {
  readonly emailVerified: boolean;
  readonly verificationRequired: boolean;
  readonly resendAvailableAt: string | null;
  readonly pendingEmail: string | null;
}

export interface AccountProfileDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly phone: string | null;
  readonly avatarUrl: string | null;
  readonly emailVerified: boolean;
}

export interface RegisterMerchantInputDto {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly businessName: string;
  readonly storeName: string;
  readonly subdomain: string;
  readonly storeLanguage: string;
  readonly emailLocale: string;
}

export interface RegisterMerchantResultDto {
  readonly businessId: string;
  readonly storeId: string;
  readonly verificationEmailSent: boolean;
}

export interface UpdateProfileInputDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

const PROFILE_FIELDS = 'firstName lastName emailAddress phone avatarUrl emailVerified';

async function mutate<T>(document: string, variables: object = {}): Promise<T> {
  return (await api.mutate(document, variables)) as T;
}

export async function fetchAuthPublicConfig(): Promise<AuthPublicConfigDto> {
  const document = 'query AuthPublicConfig { authPublicConfig { oauthEnabled oauthProviders platformDomain } }';
  const result = await api.query<{ authPublicConfig: AuthPublicConfigDto }>(document);
  return result.authPublicConfig;
}

export async function fetchAccountStatus(): Promise<AccountStatusDto> {
  const document =
    'query AccountStatus { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }';
  const result = await api.query<{ accountStatus: AccountStatusDto }>(document);
  return result.accountStatus;
}

export async function fetchAccountProfile(): Promise<AccountProfileDto> {
  const document = `query AccountProfile { accountProfile { ${PROFILE_FIELDS} } }`;
  const result = await api.query<{ accountProfile: AccountProfileDto }>(document);
  return result.accountProfile;
}

export async function registerMerchant(input: RegisterMerchantInputDto): Promise<RegisterMerchantResultDto> {
  const document = `mutation RegisterMerchant($input: RegisterMerchantInput!) {
    registerMerchant(input: $input) { businessId storeId verificationEmailSent }
  }`;
  const result = await mutate<{ registerMerchant: RegisterMerchantResultDto }>(document, { input });
  return result.registerMerchant;
}

export async function verifyEmail(token: string): Promise<void> {
  await mutate('mutation VerifyEmail($token: String!) { verifyEmail(token: $token) { success } }', { token });
}

export async function confirmEmailChange(token: string): Promise<void> {
  const document = 'mutation ConfirmEmailChange($token: String!) { confirmEmailChange(token: $token) { success } }';
  await mutate(document, { token });
}

export async function verifyEmailOtp(code: string): Promise<void> {
  await mutate('mutation VerifyEmailOtp($code: String!) { verifyEmailOtp(code: $code) { success } }', { code });
}

export async function resendEmailVerification(): Promise<string> {
  const document = 'mutation ResendEmailVerification { resendEmailVerification { nextAllowedAt } }';
  const result = await mutate<{ resendEmailVerification: { nextAllowedAt: string } }>(document);
  return result.resendEmailVerification.nextAllowedAt;
}

export async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<void> {
  const document = `mutation ChangeAccountPassword($currentPassword: String!, $newPassword: String!) {
    changeAccountPassword(currentPassword: $currentPassword, newPassword: $newPassword) { success }
  }`;
  await mutate(document, { currentPassword, newPassword });
}

export async function requestEmailChange(newEmail: string, currentPassword: string): Promise<void> {
  const document = `mutation RequestEmailChange($newEmail: String!, $currentPassword: String!) {
    requestEmailChange(newEmail: $newEmail, currentPassword: $currentPassword) { success }
  }`;
  await mutate(document, { newEmail, currentPassword });
}

export async function updateAccountProfile(input: UpdateProfileInputDto): Promise<AccountProfileDto> {
  const document = `mutation UpdateAccountProfile($input: UpdateAccountProfileInput!) {
    updateAccountProfile(input: $input) { ${PROFILE_FIELDS} }
  }`;
  const result = await mutate<{ updateAccountProfile: AccountProfileDto }>(document, { input });
  return result.updateAccountProfile;
}

export async function setAccountAvatar(file: File | null): Promise<void> {
  const document =
    'mutation SetActiveAdministratorAvatar($file: Upload) { setActiveAdministratorAvatar(file: $file) { id } }';
  await mutate(document, { file });
}

/** Uploads the logo on the active store's channel and sets it on the business and the store (D34). */
export async function saveBusinessLogo(file: File, storeId: string): Promise<void> {
  const upload = 'mutation UploadBusinessLogo($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }';
  const { uploadBusinessLogo } = await mutate<{ uploadBusinessLogo: { assetId: string } }>(upload, { file });
  const input = { logoAssetId: uploadBusinessLogo.assetId };
  await mutate('mutation SetBusinessLogo($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id } }', {
    input,
  });
  await mutate(
    'mutation SetStoreLogo($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }',
    {
      id: storeId,
      input,
    },
  );
}
