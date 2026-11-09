/** The part of an HTTP request the binding reads. */
export interface BindingRequest {
  readonly headers: { readonly cookie?: string | undefined };
}

/** The part of an HTTP response the binding writes. */
export interface BindingResponse {
  cookie(name: string, value: string, options: object): unknown;
  clearCookie(name: string, options: object): unknown;
}

/** The value that ties a flow to the browser that started it (D36, login CSRF). */
export interface OAuthBrowserBindingPort {
  read(request: BindingRequest): string | undefined;
  write(response: BindingResponse, value: string): void;
  clear(response: BindingResponse): void;
}
