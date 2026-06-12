export default async function TenantTop({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return (
    <div>
      <h1>Tenant Top</h1>
      <p>Tenant ID: {tenantId}</p>
    </div>
  );
}
