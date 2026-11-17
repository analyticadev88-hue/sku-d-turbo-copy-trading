CREATE TABLE "Mt5Account" (
    "login" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "provisioningError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mt5Account_pkey" PRIMARY KEY ("login")
);

CREATE INDEX "Mt5Account_userId_idx" ON "Mt5Account"("userId");

ALTER TABLE "Mt5Account"
ADD CONSTRAINT "Mt5Account_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
