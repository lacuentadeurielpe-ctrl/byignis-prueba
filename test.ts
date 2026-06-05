import * as mindee from 'mindee'; let c = new mindee.Client({apiKey: '1'}); c.enqueueAndGetResult(mindee.v1.product.InvoiceV4, {} as any, {});  
