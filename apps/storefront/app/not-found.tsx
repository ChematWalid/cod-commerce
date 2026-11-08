import type { ReactNode } from 'react';
import { NotFoundContent } from '../src/i18n/not-found-content';

/** The 404 page for unknown hosts, disabled stores, internal paths and missing pages. */
export default function NotFound(): ReactNode {
  return <NotFoundContent />;
}
