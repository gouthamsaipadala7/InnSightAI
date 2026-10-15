-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('standard', 'deluxe', 'suite', 'custom');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('available', 'occupied', 'dirty', 'cleaning');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('receptionist', 'manager');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('active', 'checked_out');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('dirty', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "total_rooms" INTEGER NOT NULL,
    "employees_count" INTEGER NOT NULL,
    "setup_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "category" "RoomCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "room_type_id" UUID NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "id_proof" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "checkin_time" TIMESTAMP(3) NOT NULL,
    "checkout_time" TIMESTAMP(3),
    "initial_payment" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2),
    "status" "BookingStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "assigned_staff" TEXT,
    "status" "HousekeepingStatus" NOT NULL DEFAULT 'dirty',
    "marked_dirty_at" TIMESTAMP(3),
    "cleaning_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_log" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_booking_counts" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_booking_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: room_types scoped by hotel
CREATE INDEX "room_types_hotel_id_idx" ON "room_types"("hotel_id");

-- CreateIndex: room numbers unique per hotel (also serves as the hotel_id index)
CREATE UNIQUE INDEX "rooms_hotel_id_room_number_key" ON "rooms"("hotel_id", "room_number");

-- CreateIndex: live availability board queries (hotel_id + status)
CREATE INDEX "rooms_hotel_id_status_idx" ON "rooms"("hotel_id", "status");

-- CreateIndex: usernames unique per hotel (also serves as the hotel_id index)
CREATE UNIQUE INDEX "employees_hotel_id_username_key" ON "employees"("hotel_id", "username");

-- CreateIndex: customers scoped by hotel
CREATE INDEX "customers_hotel_id_idx" ON "customers"("hotel_id");

-- CreateIndex: phone lookup at check-in, scoped by hotel
CREATE INDEX "customers_hotel_id_phone_idx" ON "customers"("hotel_id", "phone");

-- CreateIndex: bookings scoped by hotel
CREATE INDEX "bookings_hotel_id_idx" ON "bookings"("hotel_id");

-- CreateIndex: active / checked-out filtering, scoped by hotel
CREATE INDEX "bookings_hotel_id_status_idx" ON "bookings"("hotel_id", "status");

-- CreateIndex: custom date-range queries, scoped by hotel
CREATE INDEX "bookings_hotel_id_checkin_time_idx" ON "bookings"("hotel_id", "checkin_time");

-- CreateIndex: FK lookup helpers
CREATE INDEX "bookings_room_id_idx" ON "bookings"("room_id");
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex: housekeeping scoped by hotel
CREATE INDEX "housekeeping_hotel_id_idx" ON "housekeeping"("hotel_id");

-- CreateIndex: "which rooms need attention" board, scoped by hotel
CREATE INDEX "housekeeping_hotel_id_status_idx" ON "housekeeping"("hotel_id", "status");

-- CreateIndex: FK lookup helper
CREATE INDEX "housekeeping_room_id_idx" ON "housekeeping"("room_id");

-- CreateIndex: revenue_log scoped by hotel
CREATE INDEX "revenue_log_hotel_id_idx" ON "revenue_log"("hotel_id");

-- CreateIndex: revenue-by-date-range queries, scoped by hotel
CREATE INDEX "revenue_log_hotel_id_date_idx" ON "revenue_log"("hotel_id", "date");

-- CreateIndex: one rollup row per hotel per day — this unique index IS the
-- required (hotel_id, date) index the AI microservice queries on.
CREATE UNIQUE INDEX "daily_booking_counts_hotel_id_date_key" ON "daily_booking_counts"("hotel_id", "date");

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping" ADD CONSTRAINT "housekeeping_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping" ADD CONSTRAINT "housekeeping_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_log" ADD CONSTRAINT "revenue_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_log" ADD CONSTRAINT "revenue_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_booking_counts" ADD CONSTRAINT "daily_booking_counts_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
