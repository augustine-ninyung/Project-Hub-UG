-- Students confirm their email to sign in, then an admin approves them before
-- they can upload, comment or report.
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_APPROVED';

ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);
CREATE INDEX "User_approvedAt_idx" ON "User"("approvedAt");

-- Until now an admin's "verify" was the approval, so verified students keep
-- everything they could already do.
UPDATE "User" SET "approvedAt" = "emailVerifiedAt" WHERE "emailVerifiedAt" IS NOT NULL;

-- Admins are never locked out.
UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP),
    "approvedAt" = COALESCE("approvedAt", CURRENT_TIMESTAMP)
WHERE "role" = 'ADMIN';
