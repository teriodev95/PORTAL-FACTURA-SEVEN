import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sales, syncLog } from '../db/schema';
import { createEvoClient, type EvoSale } from '../lib/evo';
import type { Env } from '../lib/env';

const PAGE_SIZE = 50;

/**
 * EVO → D1 Sales Sync
 *
 * Paginates through all EVO sales, fetches member details for each,
 * and upserts into the D1 `sales` table. Logs every run to `sync_log`.
 */
export async function runEvoSync(env: Env) {
  const startTime = Date.now();
  const now = new Date();
  const brtHour = ((now.getUTCHours() - 3) + 24) % 24;
  const insideWindow = brtHour >= 0 && brtHour < 5;

  const errors: string[] = [];
  let salesFetched = 0;
  let salesInserted = 0;
  let salesUpdated = 0;
  let pagesRequested = 0;
  let rateLimited = false;
  let verdict: 'SUCCESS' | 'RATE_LIMITED' | 'PARTIAL' | 'FAILED' = 'SUCCESS';

  const db = drizzle(env.DB);
  const evo = createEvoClient(env);

  console.log('=== EVO SYNC START ===');
  console.log(`UTC: ${now.toISOString()}`);
  console.log(`BRT hour: ${brtHour}:00 — ${insideWindow ? 'INSIDE' : 'OUTSIDE'} free window`);

  try {
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      let pageSales: EvoSale[];

      try {
        pageSales = await evo.getSalesPage(PAGE_SIZE, skip);
        pagesRequested++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          (err as { status?: number })?.status === 429 ||
          errMsg.toLowerCase().includes('limit');

        if (isRateLimit) {
          rateLimited = true;
          verdict = salesFetched > 0 ? 'PARTIAL' : 'RATE_LIMITED';
          errors.push(`Rate limited at page ${pagesRequested + 1} (skip=${skip}): ${errMsg}`);
          console.log(`RATE LIMITED at skip=${skip}: ${errMsg}`);
          break;
        }

        errors.push(`Page fetch error at skip=${skip}: ${errMsg}`);
        console.error(`Page fetch error at skip=${skip}:`, errMsg);
        verdict = salesFetched > 0 ? 'PARTIAL' : 'FAILED';
        break;
      }

      if (!pageSales || pageSales.length === 0) {
        hasMore = false;
        break;
      }

      salesFetched += pageSales.length;

      for (const sale of pageSales) {
        try {
          // Fetch full member details for RFC and email
          let customerRfc: string | null = null;
          let customerEmail: string | null = null;
          let customerName = '';

          // Use embedded member data from sale for the name
          if (sale.member) {
            customerName = `${sale.member.firstName ?? ''} ${sale.member.lastName ?? ''}`.trim();
          }

          // Fetch the member endpoint for documentId (RFC) and contacts (email)
          try {
            const member = await evo.getMember(sale.idMember);
            if (member) {
              customerRfc = member.documentId || null;
              customerEmail =
                member.contacts?.find((c) => c.contactType === 'E-mail')?.description || null;
              // If sale.member was missing name, fallback to member endpoint
              if (!customerName) {
                customerName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
              }
            }
          } catch (memberErr: unknown) {
            const memberErrMsg = memberErr instanceof Error ? memberErr.message : String(memberErr);
            const isMemberRateLimit =
              (memberErr as { status?: number })?.status === 429 ||
              memberErrMsg.toLowerCase().includes('limit');

            if (isMemberRateLimit) {
              rateLimited = true;
              verdict = salesFetched > 0 ? 'PARTIAL' : 'RATE_LIMITED';
              errors.push(`Rate limited fetching member ${sale.idMember}: ${memberErrMsg}`);
              console.log(`RATE LIMITED fetching member ${sale.idMember}`);
              hasMore = false;
              break;
            }

            // Non-rate-limit member error: continue with sale data only
            errors.push(`Member fetch error for idMember=${sale.idMember}: ${memberErrMsg}`);
            console.warn(`Member fetch error for idMember=${sale.idMember}:`, memberErrMsg);
          }

          // Map sale items
          const items = (sale.saleItens || []).map((item) => ({
            description: item.description || item.item,
            quantity: item.quantity,
            unitPrice: item.itemValue,
            salePrice: item.saleValue,
            discount: item.discount ?? 0,
          }));

          const total = items.reduce((sum, item) => sum + item.salePrice, 0);

          // Check if sale already exists
          const existing = await db
            .select({ idSale: sales.idSale })
            .from(sales)
            .where(eq(sales.idSale, sale.idSale))
            .limit(1);

          const saleRow = {
            idSale: sale.idSale,
            idMember: sale.idMember,
            idBranch: sale.idBranch,
            saleDate: sale.saleDate,
            customerName: customerName || 'Unknown',
            customerRfc,
            customerEmail,
            itemsJson: JSON.stringify(items),
            total,
            syncedAt: now.toISOString(),
          };

          if (existing.length > 0) {
            await db.update(sales).set(saleRow).where(eq(sales.idSale, sale.idSale));
            salesUpdated++;
          } else {
            await db.insert(sales).values(saleRow);
            salesInserted++;
          }
        } catch (saleErr: unknown) {
          const saleErrMsg = saleErr instanceof Error ? saleErr.message : String(saleErr);
          errors.push(`Error processing sale ${sale.idSale}: ${saleErrMsg}`);
          console.error(`Error processing sale ${sale.idSale}:`, saleErrMsg);
        }
      }

      // If we got rate limited processing members inside the loop, stop
      if (rateLimited) break;

      skip += PAGE_SIZE;

      // If we got fewer results than page size, we've reached the end
      if (pageSales.length < PAGE_SIZE) {
        hasMore = false;
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Top-level sync error: ${errMsg}`);
    console.error('Top-level sync error:', errMsg);
    verdict = 'FAILED';
  }

  // If no errors changed the verdict and we completed normally
  if (verdict === 'SUCCESS' && errors.length > 0) {
    verdict = 'PARTIAL';
  }

  const durationMs = Date.now() - startTime;

  console.log('=== EVO SYNC RESULTS ===');
  console.log(`Sales fetched: ${salesFetched}`);
  console.log(`Inserted: ${salesInserted}, Updated: ${salesUpdated}`);
  console.log(`Pages requested: ${pagesRequested}`);
  console.log(`Rate limited: ${rateLimited}`);
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Verdict: ${verdict}`);
  if (errors.length > 0) console.log(`Errors: ${JSON.stringify(errors)}`);

  // Persist sync log
  try {
    await db.insert(syncLog).values({
      runAt: now.toISOString(),
      brtHour,
      insideWindow,
      salesFetched,
      salesInserted,
      salesUpdated,
      pagesRequested,
      rateLimited,
      durationMs,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
      verdict,
    });
  } catch (logErr) {
    console.error('Failed to write sync log:', logErr);
  }

  console.log('=== EVO SYNC END ===');
}
