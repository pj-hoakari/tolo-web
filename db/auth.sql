create table if not exists "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table if not exists "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "tenantId" text, "kind" text not null, "eventId" text, "edgeDeviceId" text, "host" text, "browserHash" text);

alter table "session" add column if not exists "eventId" text;

alter table "session" add column if not exists "edgeDeviceId" text;

alter table "session" add column if not exists "host" text;

alter table "session" add column if not exists "browserHash" text;

create table if not exists "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table if not exists "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table if not exists "tenantAccessToken" ("id" text not null primary key, "sessionId" text not null unique references "session" ("id") on delete cascade, "subject" text not null, "accessToken" text not null, "refreshToken" text not null, "accessTokenExpiresAt" timestamptz not null, "idToken" text);

create table if not exists "eventAccessToken" ("id" text not null primary key, "sessionId" text not null references "session" ("id") on delete cascade, "eventId" text not null, "accessToken" text not null, "expiresAt" timestamptz not null);

create table if not exists "pendingLogin" ("id" text not null primary key, "kind" text not null, "tenantId" text not null, "host" text not null, "hostGeneration" integer not null default 0, "browserHash" text not null, "bindingHash" text not null, "returnPath" text not null, "expiresAt" timestamptz not null, "codeHash" text unique, "userId" text, "subject" text, "accessToken" text, "refreshToken" text, "accessTokenExpiresAt" timestamptz, "idToken" text, "stateHash" text unique, "codeVerifier" text);

create table if not exists "tenantRegistration" ("id" text not null primary key, "tenantId" text not null, "ownershipClaimToken" text not null, "name" text not null, "subdomain" text not null, "displayName" text not null, "bindingHash" text not null unique, "expiresAt" timestamptz not null);

alter table "pendingLogin" add column if not exists "kind" text not null default 'login';

alter table "pendingLogin" add column if not exists "hostGeneration" integer not null default 0;

alter table "pendingLogin" add column if not exists "browserHash" text;

alter table "pendingLogin" add column if not exists "stateHash" text;

alter table "pendingLogin" add column if not exists "codeVerifier" text;

create table if not exists "browserHostState" ("id" text not null primary key, "host" text not null, "browserHash" text not null, "generation" integer not null default 0, "machineAt" timestamptz, "updatedAt" timestamptz not null);

alter table "browserHostState" add column if not exists "browserHash" text;

alter table "browserHostState" drop constraint if exists "browserHostState_host_key";

create unique index if not exists "browserHostState_host_browserHash_idx" on "browserHostState" ("host", "browserHash");

create index if not exists "session_userId_idx" on "session" ("userId");

create index if not exists "account_userId_idx" on "account" ("userId");

create index if not exists "verification_identifier_idx" on "verification" ("identifier");

create index if not exists "eventAccessToken_sessionId_idx" on "eventAccessToken" ("sessionId");

create table if not exists "pendingConnectionAuthorization" ("id" text not null primary key, "stateHash" text not null unique, "codeVerifier" text not null, "nonce" text not null, "tenantId" text not null, "eventId" text not null, "pageEdgeDeviceId" text not null, "cameraIds" text not null, "staffSub" text not null, "host" text not null, "returnPath" text not null, "redirectUri" text not null, "generation" integer not null default 0, "expiresAt" timestamptz not null);

alter table "pendingConnectionAuthorization" add column if not exists "generation" integer not null default 0;

-- Existing pending flows have no trusted return host and must be restarted.
alter table "pendingConnectionAuthorization" add column if not exists "host" text not null default '';

create table if not exists "connectionDelegationState" ("id" text not null primary key, "connectionKey" text not null unique, "generation" integer not null, "deletedAt" timestamptz, "updatedAt" timestamptz not null);

create table if not exists "connectionAuthorization" ("id" text not null primary key, "connectionKey" text not null unique, "tenantId" text not null, "eventId" text not null, "pageEdgeDeviceId" text not null, "cameraIds" text not null, "staffSub" text not null, "accessToken" text not null, "refreshToken" text not null, "idToken" text, "accessTokenExpiresAt" timestamptz not null, "createdAt" timestamptz not null, "expiresAt" timestamptz not null);

create table if not exists "connectionEventAccess" ("id" text not null primary key, "connectionAuthorizationId" text not null references "connectionAuthorization" ("id") on delete cascade, "cacheKey" text not null unique, "eventId" text not null, "accessToken" text not null, "expiresAt" timestamptz not null);

create index if not exists "connectionAuthorization_eventId_idx" on "connectionAuthorization" ("eventId");

create index if not exists "connectionEventAccess_connectionAuthorizationId_idx" on "connectionEventAccess" ("connectionAuthorizationId");

create table if not exists "pendingMachineAuthorization" ("id" text not null primary key, "stateHash" text not null unique, "codeVerifier" text not null, "nonce" text not null, "tenantId" text not null, "eventId" text not null, "pageEdgeDeviceId" text not null, "staffSub" text not null, "host" text not null, "browserHash" text not null, "bindingHash" text not null, "returnPath" text not null, "redirectUri" text not null, "expiresAt" timestamptz not null);

alter table "pendingMachineAuthorization" add column if not exists "browserHash" text;

create table if not exists "pendingMachineHandoff" ("id" text not null primary key, "codeHash" text not null unique, "tenantId" text not null, "eventId" text not null, "edgeDeviceId" text not null, "userId" text not null, "subject" text not null, "accessToken" text not null, "refreshToken" text not null, "idToken" text, "accessTokenExpiresAt" timestamptz not null, "host" text not null, "browserHash" text not null, "bindingHash" text not null, "returnPath" text not null, "expiresAt" timestamptz not null);

alter table "pendingMachineHandoff" add column if not exists "browserHash" text;
