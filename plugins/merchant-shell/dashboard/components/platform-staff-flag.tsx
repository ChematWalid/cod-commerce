import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import { PLATFORM_STAFF_ATTRIBUTE } from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';

/** Marks `<html>` for platform staff, for whom the stylesheet keeps the stock sidebar header and footer (D79). */
export function PlatformStaffFlag({ children }: PropsWithChildren): ReactNode {
  const isStaff = useShellAudience() === 'staff';
  useEffect(() => {
    document.documentElement.toggleAttribute(PLATFORM_STAFF_ATTRIBUTE, isStaff);
  }, [isStaff]);
  return children;
}
