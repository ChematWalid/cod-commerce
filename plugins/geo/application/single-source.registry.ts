/** Where another plugin registers the one source of a seam. */
export interface SourceRegistrar<Source> {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: Source): void;
}

/** The source of a seam as its reader sees it: the registered one, else the default. */
export interface SourceHolder<Source> {
  current(): Source;
}

/**
 * Holds the one source of a seam another plugin registers on bootstrap, answering with a complete default until
 * then. A copy of the offers' `SingleSourceRegistry` (D2423): a plugin never imports another plugin's internals, and
 * registering instead of overriding a provider keeps geo free of a dependency on delivery pricing (D3127).
 */
export class SingleSourceRegistry<Source> implements SourceRegistrar<Source>, SourceHolder<Source> {
  private registered: Source | undefined;

  /** `name` labels the refusal of a second registration, e.g. `'town availability source'`. */
  constructor(
    private readonly name: string,
    private readonly fallback: Source,
  ) {}

  register(source: Source): void {
    if (this.registered !== undefined) throw new Error(`A ${this.name} is already registered`);
    this.registered = source;
  }

  current(): Source {
    return this.registered ?? this.fallback;
  }
}
