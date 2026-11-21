import type { OfferAppType } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { emptyOfferForm, type OfferEditorForm } from '../../dashboard/model/editor-form';
import { type SummaryLine, type SummaryPreview, summaryOf } from '../../dashboard/model/summary';
import { dashboardMessages, renderMessage } from '../support/po-messages';

const QUANTITY_TYPE: OfferAppType = {
  id: 'quantity',
  kind: 'quantity',
  method: 'automatic',
  goal: 'sell_more',
  recommended: true,
};

const QUANTITY_FORM: OfferEditorForm = {
  ...emptyOfferForm(QUANTITY_TYPE, '42'),
  title: 'Two or three',
  config: {
    priceMode: 'percent',
    tiers: [
      { quantity: 2, price: 10, preselected: false, freeDelivery: false },
      { quantity: 3, price: 15, preselected: true, freeDelivery: true },
    ],
  },
  combinesWith: { order: false, product: false, delivery: true },
};

/** Two scenarios as the server priced them; the summary quotes the one that saves most, never computes one. */
const PREVIEW: SummaryPreview = {
  scenarios: [
    { pieces: 2, quote: { total: 9620, savings: 980 } },
    { pieces: 3, quote: { total: 13230, savings: 1470 } },
  ],
};

const render = (language: 'en' | 'ar', lines: readonly SummaryLine[]): string[] => {
  const messages = dashboardMessages(language);
  return lines.map((line) => renderMessage(messages, line.id, line.values));
};

describe('offer summary', () => {
  it('summarises a quantity offer in Arabic and English from the form', () => {
    // Act
    const lines = summaryOf(QUANTITY_FORM, PREVIEW);

    // Assert
    expect(render('en', lines)).toEqual([
      'From 2 pieces: 10 % off each piece.',
      'From 3 pieces: 15 % off each piece.',
      'From 3 pieces, delivery is free.',
      'The 3 pieces tier is picked on the form at first.',
      'Chosen products: 1.',
      'Applies by itself at checkout.',
      'For every buyer.',
      'Shown everywhere the store sells.',
      'Starts when published.',
      'Has no end date.',
      'Combines with delivery offers.',
      'Sample: 3 pieces cost 13230 DZD, saving 1470 DZD.',
    ]);
    expect(render('ar', lines)).toEqual([
      'ابتداءً من 2 قطعة: تخفيض 10 ٪ على كل قطعة.',
      'ابتداءً من 3 قطعة: تخفيض 15 ٪ على كل قطعة.',
      'ابتداءً من 3 قطعة، التوصيل مجاني.',
      'تُختار شريحة 3 قطعة مسبقًا في الاستمارة.',
      'المنتجات المختارة: 1.',
      'يُطبَّق تلقائيًا عند الطلب.',
      'لكل المشترين.',
      'يظهر في كل أماكن البيع.',
      'يبدأ عند النشر.',
      'بلا تاريخ انتهاء.',
      'يُجمع مع عروض التوصيل.',
      'مثال: 3 قطعة بـ 13230 دج، بتوفير 1470 دج.',
    ]);
  });

  it('summarises dates, limits and a kind it does not know without a sample', () => {
    // Arrange
    const form: OfferEditorForm = {
      ...QUANTITY_FORM,
      appTypeId: 'partner_app_card',
      kind: 'partner_kind',
      method: 'codes',
      startMode: 'date',
      startsAt: '2026-12-01T09:00',
      endsAt: '2026-12-31T23:00',
      totalUsageLimit: '100',
      perBuyerLimit: '1',
      combinesWith: { order: false, product: false, delivery: false },
      eligibility: { audience: 'first', channels: ['storefront'], wilayas: ['16'], deliveryMethods: ['home'] },
    };

    // Act
    const lines = render('en', summaryOf(form, undefined));

    // Assert
    expect(lines).toEqual([
      "This offer's own settings apply.",
      'Applies when the buyer types one of its codes.',
      "For a buyer's first order.",
      "Shown on 1 of the store's channels.",
      'Only in 1 wilayas.',
      'Home delivery only.',
      'Starts on 2026-12-01 09:00.',
      'Ends on 2026-12-31 23:00.',
      'Can be used 100 times in all.',
      'Each buyer can use it 1 times.',
      'Does not combine with other offers.',
    ]);
  });
});
