-- CreateTable
CREATE TABLE "taxi_trips" (
    "id" SERIAL NOT NULL,
    "fare_amount" DECIMAL(10,2) NOT NULL,
    "pickup_datetime" TIMESTAMP(3) NOT NULL,
    "pickup_longitude" DECIMAL(10,6) NOT NULL,
    "pickup_latitude" DECIMAL(10,6) NOT NULL,
    "dropoff_longitude" DECIMAL(10,6) NOT NULL,
    "dropoff_latitude" DECIMAL(10,6) NOT NULL,

    CONSTRAINT "taxi_trips_pkey" PRIMARY KEY ("id")
);
