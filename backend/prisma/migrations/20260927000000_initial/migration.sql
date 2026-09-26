CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "keycloak_subject" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_keycloak_subject_key" ON "users"("keycloak_subject");

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "minimum_level" INTEGER NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "permissions_minimum_level_check" CHECK ("minimum_level" IN (10, 20, 30))
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
