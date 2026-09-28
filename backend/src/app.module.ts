import { Module } from '@nestjs/common';
import { StatusModule } from './modules/status/status.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { UniversitiesModule } from './modules/universities/universities.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ReportsModule } from './modules/reports/index.js';

@Module({
  imports: [
    StatusModule,
    AuthModule,
    CatalogsModule,
    UniversitiesModule,
    ProjectsModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
