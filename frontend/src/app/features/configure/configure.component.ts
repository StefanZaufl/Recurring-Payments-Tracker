import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ConfigureBankAccountsSectionComponent } from './configure-bank-accounts-section.component';
import { ConfigureCategoriesSectionComponent } from './configure-categories-section.component';

@Component({
  selector: 'app-configure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfigureCategoriesSectionComponent, ConfigureBankAccountsSectionComponent],
  template: `
    <div class="animate-fade-in min-w-0 overflow-hidden">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Configure</h1>
        <p class="text-sm text-muted mt-0.5">Manage categories and bank accounts</p>
      </div>

      <div class="grid gap-6 lg:gap-8">
        <app-configure-categories-section />
        <app-configure-bank-accounts-section />
      </div>
    </div>
  `
})
export class ConfigureComponent {}
