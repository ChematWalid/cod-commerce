import type { ReactNode } from 'react';

/** The 404 page for unknown hosts, disabled stores, internal paths and missing pages. */
export default function NotFound(): ReactNode {
  return <main data-testid="not-found">Page not found</main>;
}
