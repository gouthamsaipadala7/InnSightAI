CREATE TYPE "StaffStatus" AS ENUM ('available', 'assigned');

CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'available',
    "assigned_room_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_hotel_id_idx" ON "staff"("hotel_id");
CREATE INDEX "staff_hotel_id_status_idx" ON "staff"("hotel_id", "status");

ALTER TABLE "staff" ADD CONSTRAINT "staff_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_assigned_room_id_fkey" FOREIGN KEY ("assigned_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "housekeeping" ADD COLUMN "staff_id" UUID;
ALTER TABLE "housekeeping" ADD CONSTRAINT "housekeeping_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;