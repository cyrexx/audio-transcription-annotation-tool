-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AUTO_REJECTED', 'PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('FILE', 'PASTE');

-- CreateEnum
CREATE TYPE "SpanType" AS ENUM ('NUMBER', 'FORMATTING_COMMAND', 'SPELLED_OUT', 'NAMED_ENTITY', 'MEDICAL_TERM', 'MEASUREMENT');

-- CreateEnum
CREATE TYPE "DistanceEstimate" AS ENUM ('close', 'medium', 'far');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ItemStatus" NOT NULL,
    "annotator" TEXT,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "sampleRate" INTEGER,
    "channels" INTEGER,
    "bitDepth" INTEGER,
    "container" TEXT,
    "codec" TEXT,
    "metadata" JSONB NOT NULL,
    "rmsDbfs" DOUBLE PRECISION,
    "peakDbfs" DOUBLE PRECISION,
    "noiseFloorDbfs" DOUBLE PRECISION,
    "snrDb" DOUBLE PRECISION,
    "levelsError" TEXT,
    "transcriptId" TEXT,
    "correctedText" TEXT,
    "speechRateWpmOverride" DOUBLE PRECISION,
    "distanceOverride" "DistanceEstimate",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "TranscriptSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Span" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "SpanType" NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Span_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_filename_key" ON "Item"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "Item_transcriptId_key" ON "Item"("transcriptId");

-- CreateIndex
CREATE INDEX "Transcript_filename_idx" ON "Transcript"("filename");

-- CreateIndex
CREATE INDEX "Span_itemId_idx" ON "Span"("itemId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Span" ADD CONSTRAINT "Span_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

