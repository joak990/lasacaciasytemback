-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "checkInDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "checkOutDone" BOOLEAN NOT NULL DEFAULT false;
