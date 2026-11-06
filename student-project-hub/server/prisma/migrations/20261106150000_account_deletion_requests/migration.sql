-- Students can ask for their account to be deleted; an admin confirms.
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "User_deletionRequestedAt_idx" ON "User"("deletionRequestedAt");
