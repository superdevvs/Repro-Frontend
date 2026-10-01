import { expect as baseExpect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve('..','output','calls-support-implementation');
const expect = baseExpect.configure({ timeout: 45000 });
test('real Calls API: directory, history pagination, durable transcript and private note on phone', async ({ page, context, baseURL }) => {
  test.setTimeout(300000);
  if (!baseURL || !['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local Calls fixture only.');
  const account = JSON.parse(fs.readFileSync(path.join(output,'runtime-accounts.json'),'utf8')).admin;
  const record = JSON.parse(fs.readFileSync(path.join(output,'calls-runtime-records.json'),'utf8'))[6];
  const api = 'http://127.0.0.1:8035';
  await page.setViewportSize({ width:390,height:844 });
  await context.addInitScript(({ account }) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken',account.token); localStorage.setItem('user',JSON.stringify(account.user)); localStorage.setItem('theme','light'); }, { account });
  const errors: string[] = []; const requests: {path:string;status:number}[]=[];
  let closing=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**', async route=>{
    const request=route.request(); const url=new URL(request.url()); const p=url.pathname.replace(/^\/api/,'');
    const featureRead = request.method()==='GET' && (['/voice/directory','/voice/calls','/voice/numbers','/voice/phone/settings','/voice/push/settings','/voice/scheduled-calls','/user','/me/permissions','/notifications'].includes(p) || /^\/voice\/calls\/\d+(\/transcript)?$/.test(p));
    const featureWrite = request.method()==='POST' && /^\/voice\/calls\/\d+\/(note|transcript\/reconcile)$/.test(p);
    if(featureRead || featureWrite) {
      try {
        const response=await route.fetch({url:api+url.pathname+url.search,headers:{...request.headers(),authorization:'Bearer '+account.token},timeout:60000});
        requests.push({path:p,status:response.status()}); return await route.fulfill({response});
      } catch { if(closing||page.isClosed()||request.failure()?.errorText.includes('ERR_ABORTED'))return; throw new Error('Isolated Calls API failed: '+p); }
    }
    if(request.method()!=='GET' && p!=='/system-telemetry/events') throw new Error('Unapproved provider/mutation path in local Calls acceptance: '+p);
    const data=p==='/voice/browser/config'?{enabled:false,ready:false,blockers:['Carrier disabled for local browser acceptance.'],capabilities:{human_outbound:false}} : {data:[],success:true};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/calls/people');
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Search people'}).fill('Calls QA');
  await expect(page.getByText('Calls QA Person 01',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next people'}).click();
  await expect(page.getByText('Calls QA Person 21',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Photographers',exact:true}).click();
  await expect(page.getByText('Calls QA Person 03',{exact:true})).toBeVisible();
  await expect(page.getByText('Calls QA Person 01',{exact:true})).toHaveCount(0);
  await page.screenshot({path:path.join(output,'calls-real-people-phone.png')});
  await page.goto('/calls/inbox');
  await expect(page.getByRole('button',{name:'Next conversations'})).toBeEnabled();
  await page.getByRole('button',{name:'Next conversations'}).click();
  await expect(page.getByRole('navigation',{name:'Conversations pages'})).toContainText('21');
  await page.goto('/calls/inbox/'+record.call_id+'?tab=transcript');
  await expect(page.getByRole('heading',{name:record.name,exact:true})).toBeVisible();
  await expect(page.getByLabel('Transcript text')).toContainText('Open Download Center from your delivered shoot.');
  await expect(page.getByRole('button',{name:'Recover from recording'})).toHaveCount(0);
  await page.getByRole('button',{name:'Refresh saved transcript'}).click();
  await expect(page.getByLabel('Transcript text')).toContainText('I cannot find the downloaded photos.');
  await page.getByRole('textbox',{name:'Search saved transcript'}).fill('Download Center');
  await expect(page.getByLabel('Transcript text')).not.toContainText('I cannot find');
  await page.screenshot({path:path.join(output,'calls-real-transcript-phone.png')});
  const note='Local acceptance note '+Date.now();
  await page.getByPlaceholder('Add a private note…').fill(note);
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByPlaceholder('Add a private note…')).toHaveValue('');
  await page.getByRole('button',{name:'notes',exact:true}).click();
  await expect(page.getByText(note,{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'notes',exact:true}).click();
  await expect(page.getByText(note,{exact:true})).toBeVisible();
  expect(requests.filter(item=>item.status>=400)).toEqual([]);
  expect(requests.some(item=>item.path.endsWith('/transcript/reconcile'))).toBe(true);
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(output,'calls-real-api-verification.json'),JSON.stringify({passed:true,scope:'Actual isolated Laravel controllers, SQLite, authorization, directory/history pagination, durable transcript reconcile and note persistence. Carrier/provider requests disabled.',requests},null,2));
  closing=true;
});
