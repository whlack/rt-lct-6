-- CreateTable
CREATE TABLE "directions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "primary_contact_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_contacts" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "university_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_assignments" (
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "university_assignments_pkey" PRIMARY KEY ("university_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directions_name_key" ON "directions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "universities_name_key" ON "universities"("name");

-- CreateIndex
CREATE INDEX "university_contacts_university_id_idx" ON "university_contacts"("university_id");

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "university_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_contacts" ADD CONSTRAINT "university_contacts_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_assignments" ADD CONSTRAINT "university_assignments_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_assignments" ADD CONSTRAINT "university_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
