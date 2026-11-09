import {
  Boxes,
  ChartColumn,
  House,
  LayoutGrid,
  type LucideIcon,
  MapPinned,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import type { ShellIconName } from '../model/types';

/** The drawn icon of each navigation group. */
export const SHELL_NAV_ICONS: Readonly<Record<ShellIconName, LucideIcon>> = {
  home: House,
  orders: ShoppingCart,
  tracking: MapPinned,
  products: Package,
  analytics: ChartColumn,
  inventory: Warehouse,
  finance: Wallet,
  team: Users,
  delivery: Truck,
  apps: LayoutGrid,
  sourcing: Boxes,
  settings: Settings,
};
