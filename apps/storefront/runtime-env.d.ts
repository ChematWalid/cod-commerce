// Next sets NEXT_RUNTIME and replaces `process.env.NEXT_RUNTIME` at build time; typed so the dot form compiles.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_RUNTIME?: 'nodejs' | 'edge';
  }
}
