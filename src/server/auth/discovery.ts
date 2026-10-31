import { z } from "zod";

const idpMetadata = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  end_session_endpoint: z.string().optional(),
});

export function discoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

export function idpDiscovery(issuer: string) {
  let metadata: Promise<z.infer<typeof idpMetadata>> | undefined;
  return () => {
    metadata ??= fetch(discoveryUrl(issuer))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`IdP discovery failed with ${response.status}`);
        }
        return idpMetadata.parse(await response.json());
      })
      .catch((err) => {
        metadata = undefined;
        throw err;
      });
    return metadata;
  };
}
