import { useLingui } from '@lingui/react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  AdministratorAvatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  MenuBranding,
  useAuth,
  useUiLanguageLoader,
  useUserSettings,
} from '@vendure/dashboard';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  ACCOUNT_LANGUAGE_TEST_ID,
  ACCOUNT_LOGOUT_TEST_ID,
  ACCOUNT_MENU_LANGUAGES,
  ACCOUNT_MENU_TEST_ID,
  ACCOUNT_MENU_THEMES,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROFILE_TEST_ID,
  ACCOUNT_SECURITY_PATH,
  ACCOUNT_SECURITY_TEST_ID,
  ACCOUNT_THEME_TEST_ID,
  accountOptionTestId,
  type AccountMenuTheme,
  LOGIN_PATH,
} from '../constants';
import { useShellAudience } from '../hooks/use-is-merchant';

const THEME_ICONS: Readonly<Record<AccountMenuTheme, ReactNode>> = {
  light: <Sun aria-hidden />,
  dark: <Moon aria-hidden />,
  system: <Monitor aria-hidden />,
};

/** The theme labels, one message id each, so the extractor sees them. */
const THEME_MESSAGE_IDS: Readonly<Record<AccountMenuTheme, string>> = {
  light: 'shell.account.theme.light',
  dark: 'shell.account.theme.dark',
  system: 'shell.account.theme.system',
};

const isTheme = (value: string): value is AccountMenuTheme => ACCOUNT_MENU_THEMES.some((theme) => theme === value);

/** Signs out the current session (`logout` ends only that one, D22), then drops cached data and opens the login page. */
function useLogout(): () => void {
  const { logout } = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  return () => {
    logout()
      .then(() => router.invalidate())
      .then(() => navigate({ to: LOGIN_PATH }))
      .catch((error: unknown) => {
        console.error('Could not sign out', error);
      });
  };
}

/** The language radio: stores the choice with the user's settings, which sets `html[dir]` and the sidebar side. */
function LanguageRadios(): ReactNode {
  const { settings, setDisplayLanguage } = useUserSettings();
  const { loadAndActivateLocale } = useUiLanguageLoader();
  return (
    <DropdownMenuRadioGroup
      value={settings.displayLanguage}
      onValueChange={(code: string) => {
        setDisplayLanguage(code);
        void loadAndActivateLocale(code);
      }}
    >
      {ACCOUNT_MENU_LANGUAGES.map(({ code, label }) => (
        <DropdownMenuRadioItem
          key={code}
          value={code}
          data-testid={accountOptionTestId(ACCOUNT_LANGUAGE_TEST_ID, code)}
        >
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

function ThemeRadios(): ReactNode {
  const { i18n } = useLingui();
  const { settings, setTheme } = useUserSettings();
  return (
    <DropdownMenuRadioGroup
      value={settings.theme}
      onValueChange={(value: string) => {
        if (isTheme(value)) setTheme(value);
      }}
    >
      {ACCOUNT_MENU_THEMES.map((theme) => (
        <DropdownMenuRadioItem
          key={theme}
          value={theme}
          data-testid={accountOptionTestId(ACCOUNT_THEME_TEST_ID, theme)}
        >
          {THEME_ICONS[theme]}
          {i18n._(THEME_MESSAGE_IDS[theme])}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** The signed-in name and e-mail at the top of the menu, each cut off at the end of its own line. */
function Identity({ name, email }: { readonly name: string; readonly email: string }): ReactNode {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="flex min-w-0 flex-col gap-0.5 text-start font-normal">
        <span className="truncate font-medium">{name}</span>
        <bdi dir="ltr" className="text-muted-foreground truncate text-xs" style={{ direction: 'ltr' }}>
          {email}
        </bdi>
      </DropdownMenuLabel>
    </DropdownMenuGroup>
  );
}

/** The Language and Theme rows, each opening a radio group. */
function PreferenceSubmenus(): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger data-testid={ACCOUNT_LANGUAGE_TEST_ID}>
          {i18n._('shell.account.language')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <LanguageRadios />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger data-testid={ACCOUNT_THEME_TEST_ID}>
          {i18n._('shell.account.theme')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ThemeRadios />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

/** The rows below the identity: the two pages, the two preference submenus and Log out. */
function MenuRows(): ReactNode {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <>
      <DropdownMenuItem
        data-testid={ACCOUNT_PROFILE_TEST_ID}
        onClick={() => void navigate({ to: ACCOUNT_PROFILE_PATH })}
      >
        {i18n._('shell.account.profile')}
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid={ACCOUNT_SECURITY_TEST_ID}
        onClick={() => void navigate({ to: ACCOUNT_SECURITY_PATH })}
      >
        {i18n._('shell.account.security')}
      </DropdownMenuItem>
      <PreferenceSubmenus />
      <DropdownMenuSeparator />
      <DropdownMenuItem data-testid={ACCOUNT_LOGOUT_TEST_ID} onClick={logout}>
        <LogOut aria-hidden />
        {i18n._('shell.account.logout')}
      </DropdownMenuItem>
    </>
  );
}

function MerchantAccountMenu(): ReactNode {
  const { i18n } = useLingui();
  const { user } = useAuth();
  if (user === undefined) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            data-testid={ACCOUNT_MENU_TEST_ID}
            aria-label={i18n._('shell.account.menu')}
            className="rounded-full"
          />
        }
      >
        <AdministratorAvatar preview={user.avatar?.preview} name={name} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        <Identity name={name} email={user.emailAddress} />
        <DropdownMenuSeparator />
        <MenuRows />
        <DropdownMenuSeparator />
        {/* The Vendure notice stays (D79, ADR 0001 section 8). */}
        <MenuBranding />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The merchant's account menu in the top bar. Platform staff keep the stock one in the sidebar (D79). */
export function AccountMenu(): ReactNode {
  return useShellAudience() === 'merchant' ? <MerchantAccountMenu /> : null;
}
