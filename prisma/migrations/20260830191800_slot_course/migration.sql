-- Every slot that exists today is its meal's only dish, and the middle of the
-- three is where it belongs. The default goes as soon as it has done that job,
-- so a slot written without a course fails loudly from here on.
ALTER TABLE "MenuSlot" ADD COLUMN "course" "Course" NOT NULL DEFAULT 'SECOND';
ALTER TABLE "MenuSlot" ALTER COLUMN "course" DROP DEFAULT;

-- No collision is possible: the index being dropped already forbade two rows
-- sharing [menuId, day, meal], so no two rows can meet now that they all carry
-- the same course.
DROP INDEX "MenuSlot_menuId_day_meal_key";

CREATE UNIQUE INDEX "MenuSlot_menuId_day_meal_course_key" ON "MenuSlot" ("menuId", "day", "meal", "course");
