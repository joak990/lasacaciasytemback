-- AlterTable: Agregar campos DNI y preCheckInCompleted a Reservation
ALTER TABLE "Reservation" ADD COLUMN "guestDNI" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "preCheckInCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: Guest (Huéspedes adicionales)
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "isMainGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PreCheckInLink (Links temporales de pre-checkin)
CREATE TABLE "PreCheckInLink" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreCheckInLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreCheckInLink_reservationId_key" ON "PreCheckInLink"("reservationId");
CREATE UNIQUE INDEX "PreCheckInLink_token_key" ON "PreCheckInLink"("token");
CREATE INDEX "Guest_reservationId_idx" ON "Guest"("reservationId");
CREATE INDEX "PreCheckInLink_token_idx" ON "PreCheckInLink"("token");
CREATE INDEX "PreCheckInLink_expiresAt_idx" ON "PreCheckInLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCheckInLink" ADD CONSTRAINT "PreCheckInLink_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

