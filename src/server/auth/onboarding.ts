import type { BetterAuthPlugin } from "better-auth";
import type { RealAuth } from "./betterAuth";
import { randomToken, sha256 } from "./login";

export const ONBOARDING_COOKIE = "__Host-tolo.onboarding";
const TENANT_REGISTRATION = "tenantRegistration";

export type TenantRegistration = {
  id: string;
  tenantId: string;
  ownershipClaimToken: string;
  name: string;
  subdomain: string;
  displayName: string;
  bindingHash: string;
  expiresAt: Date;
};

export type OnboardingInput = Pick<
  TenantRegistration,
  "name" | "subdomain" | "displayName"
>;

export type StartedRegistration = Pick<
  TenantRegistration,
  "tenantId" | "ownershipClaimToken" | "expiresAt"
>;

export const tenantOnboarding = {
  id: "tolo-onboarding",
  schema: {
    tenantRegistration: {
      fields: {
        tenantId: { type: "string", required: true },
        ownershipClaimToken: { type: "string", required: true },
        name: { type: "string", required: true },
        subdomain: { type: "string", required: true },
        displayName: { type: "string", required: true },
        bindingHash: { type: "string", required: true, unique: true },
        expiresAt: { type: "date", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;

export function createOnboarding({ auth }: Pick<RealAuth, "auth">) {
  async function bound(
    binding: string | undefined,
  ): Promise<TenantRegistration | undefined> {
    if (!binding) return undefined;
    const { adapter } = await auth.$context;
    const registration = await adapter.findOne<TenantRegistration>({
      model: TENANT_REGISTRATION,
      where: [{ field: "bindingHash", value: sha256(binding) }],
    });
    return registration && registration.expiresAt > new Date()
      ? registration
      : undefined;
  }

  return {
    bound,

    async keep(
      binding: string | undefined,
      input: OnboardingInput,
      start: () => Promise<StartedRegistration>,
    ): Promise<{ binding: string; expiresAt: Date }> {
      const { adapter } = await auth.$context;
      const current = await bound(binding);
      if (binding && current) {
        await adapter.update({
          model: TENANT_REGISTRATION,
          where: [{ field: "id", value: current.id }],
          update: {
            subdomain: input.subdomain,
            displayName: input.displayName,
          },
        });
        return { binding, expiresAt: current.expiresAt };
      }
      await adapter.deleteMany({
        model: TENANT_REGISTRATION,
        where: [{ field: "expiresAt", operator: "lt", value: new Date() }],
      });
      const started = await start();
      const value = randomToken();
      await adapter.create({
        model: TENANT_REGISTRATION,
        data: { ...input, ...started, bindingHash: sha256(value) },
      });
      return { binding: value, expiresAt: started.expiresAt };
    },

    async forget(id: string): Promise<void> {
      const { adapter } = await auth.$context;
      await adapter.delete({
        model: TENANT_REGISTRATION,
        where: [{ field: "id", value: id }],
      });
    },
  };
}
