"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from "@/components/ui/dialog";
import { useI18n } from "./i18n";

// 確かめる・知らせるための小さな画面（tolo-web の Dialog）。window.confirm / alert の代わりに使う。
//  - confirm(message, { confirmLabel, destructive }) … 「キャンセル」と実行のボタン。押した方を true / false で返す
//  - notify(message) … 「閉じる」だけ
// dialog を画面のどこかに置いておく（開いていないときは何も出さない）。open は開いているあいだ true（地図のキー操作を止めるのに使う）
type Request = {
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

export function useConfirm() {
  const { t } = useI18n();
  const [request, setRequest] = React.useState<Request | null>(null);
  const confirm = React.useCallback(
    (
      message: string,
      options: { confirmLabel: string; destructive?: boolean },
    ) =>
      new Promise<boolean>((resolve) =>
        setRequest({ message, ...options, resolve }),
      ),
    [],
  );
  const notify = React.useCallback(
    (message: string) =>
      new Promise<void>((resolve) =>
        setRequest({ message, resolve: () => resolve() }),
      ),
    [],
  );
  const finish = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  const dialog = (
    <DialogOverlay
      isOpen={request !== null}
      onOpenChange={(open) => !open && finish(false)}
    >
      <DialogContent
        role={request?.confirmLabel ? "alertdialog" : "dialog"}
        closeButton={false}
        className="sm:max-w-md"
      >
        <DialogDescription className="text-sm leading-relaxed text-foreground">
          {request?.message}
        </DialogDescription>
        <DialogFooter>
          {request?.confirmLabel ? (
            <>
              <Button variant="outline" onPress={() => finish(false)}>
                {t("キャンセル")}
              </Button>
              <Button
                variant={request.destructive ? "destructive" : "default"}
                onPress={() => finish(true)}
                autoFocus
              >
                {request.confirmLabel}
              </Button>
            </>
          ) : (
            <Button onPress={() => finish(true)} autoFocus>
              {t("閉じる")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogOverlay>
  );
  return { confirm, notify, dialog, open: request !== null };
}
