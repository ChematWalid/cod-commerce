/** Hands out new row ids; ids are made by the application before insert, never by the database (ADR 0003). */
export interface IdGeneratorPort {
  next(): string;
}
