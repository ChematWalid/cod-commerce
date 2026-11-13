import './styles/flags.css';
import { defineDashboardExtension } from '@vendure/dashboard';
import { Flag } from 'lucide-react';
import { PLATFORM_SECTION_ID, PLATFORM_SECTION_TITLE } from './constants';
import { flagsRoute } from './routes/flags-page';

/** Sorts after the stock bottom sections. */
const PLATFORM_SECTION_ORDER = 900;

defineDashboardExtension({
  navSections: [
    {
      id: PLATFORM_SECTION_ID,
      title: PLATFORM_SECTION_TITLE,
      icon: Flag,
      placement: 'bottom',
      order: PLATFORM_SECTION_ORDER,
    },
  ],
  routes: [flagsRoute],
});
