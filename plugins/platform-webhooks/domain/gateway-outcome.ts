/** What the gateway decided about one request; the controller maps it to a status (D109). */
export type GatewayOutcome =
  'accepted' | 'duplicate' | 'disabled' | 'unknown-provider' | 'unknown-account' | 'bad-signature';
