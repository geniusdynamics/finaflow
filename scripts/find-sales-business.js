import {getDb} from './api/queries/connection';
import {locations,businesses,dailySales} from './db/schema';
import {eq,and,isNull,inArray} from 'drizzle-orm';

async function findSalesBusiness() {
  const db=getDb();
  const locs=await db.select().from(locations).where(inArray(locations.id,[5,38]));
  console.log('Locations with sales:',locs.map(l=>({id:l.id,name:l.name,businessId:l.businessId})));
  const bizIds=[...new Set(locs.map(l=>l.businessId))];
  const bizs=await db.select().from(businesses).where(inArray(businesses.id,bizIds));
  console.log('Businesses:',bizs.map(b=>({id:b.id,name:b.name,accountId:b.accountId,isDemo:b.isDemo})));
}

findSalesBusiness().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
