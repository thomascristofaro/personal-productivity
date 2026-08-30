CREATE TYPE "Course" AS ENUM ('FIRST', 'SECOND', 'SIDE');

-- The default exists only to fill the 33 rows that are already here. Dropping it
-- immediately is what makes a recipe saved without a course fail loudly, rather
-- than becoming a secondo in silence.
ALTER TABLE "Recipe" ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "Recipe" ALTER COLUMN "course" DROP DEFAULT;
