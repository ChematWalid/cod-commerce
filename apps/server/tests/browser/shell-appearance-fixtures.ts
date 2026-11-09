import { ACCOUNT_MENU_TEST_ID, ACCOUNT_THEME_TEST_ID, accountOptionTestId } from '@cod/plugin-merchant-shell';
import type { Page } from 'playwright-core';
import { closeMenus } from './dashboard-session';

/** The account menu's theme choices (`UserSettings.theme`). */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** WCAG 2.x AA for normal-size text. */
export const MIN_TEXT_CONTRAST = 4.5;

const SAVE_SETTINGS_MUTATION = 'setSettingsStoreValue';

const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);

/** Picks a theme as a user does: account menu, Theme, the radio. Waits for the server to store it. */
export async function chooseTheme(page: Page, theme: ThemeChoice): Promise<void> {
  await byTestId(page, ACCOUNT_MENU_TEST_ID).click();
  await byTestId(page, ACCOUNT_THEME_TEST_ID).click();
  const option = byTestId(page, accountOptionTestId(ACCOUNT_THEME_TEST_ID, theme));
  if ((await option.getAttribute('aria-checked')) !== 'true') {
    const saved = page.waitForResponse(
      (response) => response.request().postData()?.includes(SAVE_SETTINGS_MUTATION) ?? false,
    );
    await option.click();
    await saved;
  }
  await closeMenus(page);
}

/** Whether the document carries the `dark` class the stock stylesheet keys its dark tokens on. */
export const isDark = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));

/** The contrast ratio of the first element matching `selector`, from its computed colours (WCAG 2.x relative luminance). */
export function contrastRatio(page: Page, selector: string): Promise<number> {
  return page.evaluate((target: string): number => {
    const element = document.querySelector(target);
    if (element === null) throw new Error(`nothing matches ${target}`);
    type Rgba = { r: number; g: number; b: number; a: number };
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('no 2d context');
    // The canvas resolves any CSS colour (oklch, color-mix) to sRGB, which getComputedStyle does not.
    const parse = (css: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const over = (top: Rgba, below: Rgba): Rgba => ({
      r: top.r * top.a + below.r * (1 - top.a),
      g: top.g * top.a + below.g * (1 - top.a),
      b: top.b * top.a + below.b * (1 - top.a),
      a: 1,
    });
    const layers: Rgba[] = [];
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const colour = parse(getComputedStyle(node).backgroundColor);
      if (colour.a > 0) layers.push(colour);
    }
    const background = layers.reduceRight((below, top) => over(top, below), { r: 255, g: 255, b: 255, a: 1 });
    const text = over(parse(getComputedStyle(element).color), background);
    const channel = (value: number): number => {
      const unit = value / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: Rgba): number => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const [lighter = 0, darker = 0] = [luminance(text), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  }, selector);
}

/** One computed style property of the first element matching `selector`. */
export function computedStyle(page: Page, selector: string, property: 'rotate' | 'scale'): Promise<string> {
  return page.evaluate(
    ({ target, name }: { target: string; name: string }) => {
      const element = document.querySelector(target);
      if (element === null) throw new Error(`nothing matches ${target}`);
      return getComputedStyle(element).getPropertyValue(name);
    },
    { target: selector, name: property },
  );
}

/** The physical offsets of the `::before` marker of the first element matching `selector`. */
export function markerOffsets(page: Page, selector: string): Promise<{ left: string; right: string }> {
  return page.evaluate((target: string) => {
    const element = document.querySelector(target);
    if (element === null) throw new Error(`nothing matches ${target}`);
    const { left, right } = getComputedStyle(element, '::before');
    return { left, right };
  }, selector);
}
