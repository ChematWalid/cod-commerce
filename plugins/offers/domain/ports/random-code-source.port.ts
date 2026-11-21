/** Where generated discount codes draw their random part (D2512); a test hands out scripted draws. */
export interface RandomCodeSource {
  /** `length` characters drawn uniformly from `alphabet`. */
  next(alphabet: string, length: number): string;
}
