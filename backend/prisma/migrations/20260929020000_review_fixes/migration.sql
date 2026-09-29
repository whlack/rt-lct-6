CREATE TYPE "VisibilityMode" AS ENUM ('ASSIGNED', 'ALL', 'SELECTED');
ALTER TABLE users ADD COLUMN visibility_mode "VisibilityMode" NOT NULL DEFAULT 'ASSIGNED';
CREATE TABLE kam_visible_universities (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id, university_id)
);
CREATE TABLE kam_visible_projects (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id, project_id)
);
ALTER TABLE export_jobs DROP CONSTRAINT export_format;
ALTER TABLE export_jobs ADD CONSTRAINT export_format CHECK (format IN ('xls','xlsx','pdf','png','json'));
