import { Module } from '@nestjs/common';
import { IntegrationSyncModule } from './modules/integration-sync/index.js';
import { StatusModule } from './modules/status/status.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogsModule } from './modules/catalogs/catalogs.module.js';
import { UniversitiesModule } from './modules/universities/universities.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ReportsModule } from './modules/reports/index.js';
import { CatalogImportModule } from './modules/catalog-import/index.js';
import { StatisticsModule } from './modules/statistics/index.js';

@Module({
  imports: [
    StatusModule,
    AuthModule,
    CatalogsModule,
    UniversitiesModule,
    ProjectsModule,
    DashboardModule,
    ReportsModule,
    CatalogImportModule,
    StatisticsModule,
    IntegrationSyncModule,
  ],
})
export class AppModule {}
