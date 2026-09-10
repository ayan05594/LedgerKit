# Credit-card reward research

`LedgerKit_credit_card_catalogue_rewards_second_pass.xlsx` is the maintained
source workbook for the 295-card India catalogue. Its `Catalogue` sheet maps
exactly to the stable card names in `src/data/credit-card-seed.ts`.

Blank workbook cells mean **unknown or not sufficiently verified**. They must
never be interpreted as zero, no cap, no exclusion, or no fee.

After updating the workbook, regenerate the normalized application data:

    npm run db:research:import

Then regenerate a timestamped catalogue migration after updating the output
path used for the release:

    node --import tsx --input-type=module -e "import {writeFileSync} from 'node:fs'; import {generateCardCatalogSql} from './scripts/generate-card-catalog-sql.mjs'; writeFileSync('supabase/migrations/<timestamp>_card_research.sql', generateCardCatalogSql()+'\\n', 'utf8');"

The import utility uses Python and `openpyxl`; neither is required by the
production application or Vercel build.
