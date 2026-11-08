import './styles/rtl.css';
import { defineDashboardExtension } from '@vendure/dashboard';
import { DocumentLangSync } from './components/document-lang-sync';
import { LoginBrand, LoginWelcome } from './components/login-brand';
import { DOCUMENT_LANG_PROVIDER_ID } from './constants';
import { shellPlaceholderRoute } from './routes/shell-placeholder';

defineDashboardExtension({
  routes: [shellPlaceholderRoute],
  login: { logo: { component: LoginBrand }, beforeForm: { component: LoginWelcome } },
  customProviders: [{ id: DOCUMENT_LANG_PROVIDER_ID, component: DocumentLangSync }],
});
