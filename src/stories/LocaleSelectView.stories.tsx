import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  LocaleSelectView,
  type LocaleSelectViewProps,
} from "@/components/locale-select-view";
import { locales } from "@/i18n/locale";

/** 選択状態を自分で保持して、実際の切り替えを確認できるようにするラッパー */
function StatefulLocaleSelectView({
  locale,
  onSelect,
  ...props
}: LocaleSelectViewProps) {
  const [current, setCurrent] = useState(locale);
  return (
    <LocaleSelectView
      {...props}
      locale={current}
      onSelect={(next) => {
        setCurrent(next);
        onSelect(next);
      }}
    />
  );
}

const meta = {
  title: "Shared/LocaleSelect",
  component: LocaleSelectView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    locale: {
      control: { type: "select" },
      options: locales,
    },
  },
  args: {
    locale: "ja",
    label: "言語を切り替え",
    onSelect: fn(),
  },
  render: (args) => <StatefulLocaleSelectView {...args} />,
} satisfies Meta<typeof LocaleSelectView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定（日本語を選択中） */
export const Default: Story = {};

/** 英語ロケールで表示したとき。aria-label はラッパー側でメッセージから供給される */
export const English: Story = {
  args: {
    locale: "en",
    label: "Change language",
  },
};

/** Cookie 保存中。トリガーを無効化して二重操作を防ぐ */
export const Pending: Story = {
  args: {
    isPending: true,
  },
};

/** メニューを開いた状態。対応言語が自称表記で並び、現在のロケールが選択済みになる */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "言語を切り替え" }),
    );

    // メニューはポータルで body 直下に描画される
    const menu = within(document.body);
    const items = await menu.findAllByRole("menuitemradio");
    await expect(items).toHaveLength(locales.length);
    await expect(
      menu.getByRole("menuitemradio", { name: "日本語" }),
    ).toBeChecked();
  },
};

/** 別の言語を選ぶと onSelect にロケールが渡る */
export const Selecting: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "言語を切り替え" }),
    );

    const menu = within(document.body);
    await userEvent.click(
      await menu.findByRole("menuitemradio", { name: "한국어" }),
    );

    await expect(args.onSelect).toHaveBeenCalledWith("ko");
  },
};
