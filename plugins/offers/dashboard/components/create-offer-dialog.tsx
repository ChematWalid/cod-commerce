import { useLingui } from '@lingui/react';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { APP_TYPE_CARD_TEST_ID, CREATE_DIALOG_TEST_ID } from '../constants';
import type { OfferAppTypeDto } from '../dto';
import { type AppTypeCard, appTypeCards } from '../model/app-type-cards';

/** The dialog's two views (D2523). */
const VIEW_BY_GOAL = 'by-goal';
const VIEW_ALL = 'all';

interface CreateOfferDialogProps {
  readonly open: boolean;
  /** `undefined` while `offerAppTypes` loads. */
  readonly appTypes: readonly OfferAppTypeDto[] | undefined;
  readonly onChoose: (appTypeId: string) => void;
  readonly onClose: () => void;
}

/** A card: under a goal, the goal is the headline and the kind its subtitle; under all kinds, the kind alone. */
function CardButton(props: {
  readonly card: AppTypeCard;
  readonly byGoal: boolean;
  readonly onChoose: (appTypeId: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const { card } = props;
  const headlineId = props.byGoal && card.goalLabelId !== null ? card.goalLabelId : card.labelId;
  return (
    <button
      type="button"
      data-testid={APP_TYPE_CARD_TEST_ID}
      data-app-type={card.id}
      className="cod-offers-card hover:bg-accent focus-visible:ring-ring grid gap-1 rounded-lg border p-4 text-start focus-visible:ring-2"
      onClick={() => {
        props.onChoose(card.id);
      }}
    >
      <span className="flex flex-wrap items-center gap-2 font-medium">
        {i18n._(headlineId)}
        {card.recommended ? <Badge variant="success">{i18n._('offers.recommended')}</Badge> : null}
      </span>
      {props.byGoal ? <span className="text-sm">{i18n._(card.labelId)}</span> : null}
      <span className="text-muted-foreground text-sm">{i18n._(card.hintId)}</span>
    </button>
  );
}

function CardGrid(props: {
  readonly cards: readonly AppTypeCard[];
  readonly byGoal: boolean;
  readonly onChoose: (appTypeId: string) => void;
}): ReactNode {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {props.cards.map((card) => (
        <CardButton key={card.id} card={card} byGoal={props.byGoal} onChoose={props.onChoose} />
      ))}
    </div>
  );
}

function DialogBody({ appTypes, onChoose }: Pick<CreateOfferDialogProps, 'appTypes' | 'onChoose'>): ReactNode {
  const { i18n } = useLingui();
  if (appTypes === undefined) return <p>{i18n._('offers.loading')}</p>;
  const cards = appTypeCards(appTypes);
  return (
    <Tabs defaultValue={VIEW_BY_GOAL}>
      <TabsList>
        <TabsTrigger value={VIEW_BY_GOAL}>{i18n._('offers.create-by-goal')}</TabsTrigger>
        <TabsTrigger value={VIEW_ALL}>{i18n._('offers.create-all-kinds')}</TabsTrigger>
      </TabsList>
      <TabsContent value={VIEW_BY_GOAL} className="pt-3">
        <CardGrid cards={cards.byGoal} byGoal onChoose={onChoose} />
      </TabsContent>
      <TabsContent value={VIEW_ALL} className="pt-3">
        <CardGrid cards={cards.all} byGoal={false} onChoose={onChoose} />
      </TabsContent>
    </Tabs>
  );
}

/** "Create offer": a card per goal, or every kind; choosing one opens the editor of that app type (AC1). */
export function CreateOfferDialog({ open, appTypes, onChoose, onClose }: CreateOfferDialogProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* Seven cards outgrow a phone's height: the dialog scrolls inside the viewport so its title stays reachable. */}
      <DialogContent
        data-testid={CREATE_DIALOG_TEST_ID}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{i18n._('offers.create-title')}</DialogTitle>
          <DialogDescription>{i18n._('offers.create-description')}</DialogDescription>
        </DialogHeader>
        <DialogBody appTypes={appTypes} onChoose={onChoose} />
      </DialogContent>
    </Dialog>
  );
}
