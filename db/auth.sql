create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "tenantId" text, "kind" text not null);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "tenantAccessToken" ("id" text not null primary key, "sessionId" text not null unique references "session" ("id") on delete cascade, "subject" text not null, "accessToken" text not null, "refreshToken" text not null, "accessTokenExpiresAt" timestamptz not null, "idToken" text);

create table "eventAccessToken" ("id" text not null primary key, "sessionId" text not null references "session" ("id") on delete cascade, "eventId" text not null, "accessToken" text not null, "expiresAt" timestamptz not null);

create table "pendingLogin" ("id" text not null primary key, "kind" text not null, "tenantId" text not null, "host" text not null, "bindingHash" text not null, "returnPath" text not null, "expiresAt" timestamptz not null, "codeHash" text unique, "userId" text, "subject" text, "accessToken" text, "refreshToken" text, "accessTokenExpiresAt" timestamptz, "idToken" text, "stateHash" text unique, "codeVerifier" text);

create table "tenantRegistration" ("id" text not null primary key, "tenantId" text not null, "ownershipClaimToken" text not null, "name" text not null, "subdomain" text not null, "displayName" text not null, "bindingHash" text not null unique, "expiresAt" timestamptz not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "eventAccessToken_sessionId_idx" on "eventAccessToken" ("sessionId");

create table "pendingConnectionAuthorization" ("id" text not null primary key, "stateHash" text not null unique, "codeVerifier" text not null, "nonce" text not null, "tenantId" text not null, "eventId" text not null, "pageEdgeDeviceId" text not null, "cameraIds" text not null, "staffSub" text not null, "returnPath" text not null, "redirectUri" text not null, "expiresAt" timestamptz not null);

create table "connectionAuthorization" ("id" text not null primary key, "connectionKey" text not null unique, "tenantId" text not null, "eventId" text not null, "pageEdgeDeviceId" text not null, "cameraIds" text not null, "staffSub" text not null, "accessToken" text not null, "refreshToken" text not null, "idToken" text, "accessTokenExpiresAt" timestamptz not null, "createdAt" timestamptz not null, "expiresAt" timestamptz not null);

create table "connectionEventAccess" ("id" text not null primary key, "connectionAuthorizationId" text not null references "connectionAuthorization" ("id") on delete cascade, "cacheKey" text not null unique, "eventId" text not null, "accessToken" text not null, "expiresAt" timestamptz not null);

create index "connectionAuthorization_eventId_idx" on "connectionAuthorization" ("eventId");

create index "connectionEventAccess_connectionAuthorizationId_idx" on "connectionEventAccess" ("connectionAuthorizationId");
