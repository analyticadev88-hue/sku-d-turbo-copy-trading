-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mentorId" TEXT;

-- CreateIndex
CREATE INDEX "User_mentorId_idx" ON "User"("mentorId");
