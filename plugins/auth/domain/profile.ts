/** An owner's own profile: the fields the profile page shows and saves. */
export interface AccountProfile {
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  /** E.164, or null when none is set. */
  readonly phone: string | null;
  /** Absolute URL of the photo's preview, or null when there is no photo. */
  readonly avatarUrl: string | null;
  readonly emailVerified: boolean;
}

/** What a profile save writes. */
export interface ProfileChange {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
}
