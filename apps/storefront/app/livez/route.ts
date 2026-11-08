import { connection } from 'next/server';

/** Liveness: the process answers. Never cached, never host-resolved. */
export async function GET(): Promise<Response> {
  await connection();
  return Response.json({ status: 'ok' });
}
