/** Where another plugin registers the one source of a seam (D2423). */
export interface SourceRegistrar<Source> {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: Source): void;
}

/** The source of a seam as the pricing snapshot reads it: the registered one, else the default. */
export interface SourceHolder<Source> {
  current(): Source;
}

/**
 * Holds the one source of a seam another plugin registers on bootstrap (precedent: the catalog's order-manager check
 * and sold-out source registries, D2114, D2107), answering with a complete default until then. Registering instead of
 * overriding a provider keeps the offers free of a dependency on the plugin that supplies the source.
 */
export class SingleSourceRegistry<Source> implements SourceRegistrar<Source>, SourceHolder<Source> {
  private registered: Source | undefined;

  /** `name` labels the refusal of a second registration, e.g. `'collection membership source'`. */
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
