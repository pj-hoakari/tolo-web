// 会場マップ・スタジオで使うアイコン（階段・エレベーターの線画と、場所の種類のマーク）

import {
  Accessibility as AccessibilityIcon,
  Baby as BabyIcon,
  Cigarette as CigaretteIcon,
  CupSoda as CupSodaIcon,
  DoorOpen as DoorOpenIcon,
  BriefcaseMedical as FirstAidIcon,
  Flag as FlagIcon,
  Info as InfoKindIcon,
  Luggage as LuggageIcon,
  Mars as MarsIcon,
  PlugZap as PlugZapIcon,
  Presentation as PresentationIcon,
  ShoppingBag as ShoppingBagIcon,
  Sofa as SofaIcon,
  Toilet as ToiletIcon,
  Utensils as UtensilsIcon,
  Venus as VenusIcon,
} from "lucide-react";
import type * as React from "react";
import type { ConnectorType, PaletteKey } from "./venueMap";

// 階移動の種類アイコン（lucide に無いので線画で描く）
export function ConnectorIcon({
  type,
  className,
  style,
}: {
  type: ConnectorType;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {type === "stairs" && <path d="M3 20h5v-5h5v-5h5V5h3" />}
      {type === "escalator" && (
        <>
          <path d="M3 20h4L17 8h4" />
          <path d="m14 4 3 0 0 3" />
        </>
      )}
      {type === "elevator" && (
        <>
          <rect x={5} y={3} width={14} height={18} rx={2} />
          <path d="m9 10 3-3 3 3" />
          <path d="m9 14 3 3 3-3" />
        </>
      )}
    </svg>
  );
}

// 種類（マーク）えらびの見本に重ねるアイコン（tolo-web の案内マップと同じアイコン）
export const KIND_ICON: Partial<
  Record<
    PaletteKey,
    React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  >
> = {
  "toilet-men": MarsIcon,
  "toilet-women": VenusIcon,
  toilet: ToiletIcon,
  "toilet-accessible": AccessibilityIcon,
  food: UtensilsIcon,
  shop: ShoppingBagIcon,
  vending: CupSodaIcon,
  rest: SofaIcon,
  nursing: BabyIcon,
  "first-aid": FirstAidIcon,
  info: InfoKindIcon,
  locker: LuggageIcon,
  charging: PlugZapIcon,
  smoking: CigaretteIcon,
  entrance: DoorOpenIcon,
  meeting: FlagIcon,
  exhibit: PresentationIcon,
};

export function KindIcon({ kind }: { kind: PaletteKey }) {
  const Icon = KIND_ICON[kind];
  if (!Icon) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none flex size-full items-center justify-center text-white"
    >
      <Icon className="size-[68%]" />
    </span>
  );
}
