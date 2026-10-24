<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { PersonProfile } from '../../lib/server/people';
  let { data }: { data: PageData } = $props();
  type Site = { id:string; name:string; code:string };
  type Account = { id:string;role:string;active:boolean;siteIds:string[];invitationExpiresAt:string|null;invitationAcceptedAt:string|null };
  type Assignment = { id:string;title:string;siteId:string;dueAt:string;completedAt:string|null;deliverySource:string|null;cancelledAt:string|null };
  type Preview = { previewHash:string;counts:Record<string,number>;rows:{row:number;displayName:string;status:string;errors:string[]}[];missing:{id:string;displayName:string}[] };
  const admin = $derived(['tenant_admin','site_admin'].includes(data.actor.role));
  let people = $state<PersonProfile[]>([]), sites = $state<Site[]>([]), accounts = $state<Account[]>([]), assignments = $state<Assignment[]>([]);
  let selectedId = $state(''), editing = $state(false), loading = $state(true), saving = $state(false), ready=$state(false);
  let contextChanges = $state<{id:string;occurredAt:string;reason:string}[]>([]);
  let moodleAccountSync = $state<{state:string;lastError:string|null;completedAt:string|null}|null>(null);
  let message = $state(''), failure = $state(''), search = $state(''), showInactive = $state(false);
  let name = $state(''), employeeNumber = $state(''), email = $state(''), phone = $state(''), jobTitle = $state(''), department = $state('');
  let language = $state('en'), personType = $state<'employee'|'contractor'|'temporary'>('employee'), startDate = $state(''), active = $state(true), siteIds = $state<string[]>([]), reason = $state('');
  let accountRole = $state('learner'), accountSites = $state<string[]>([]), accountReason = $state('');
  let printed = $state<{username:string;activationCode:string;activationUrl:string;expiresAt:string}|null>(null);
  let csv = $state(''), rosterReason = $state('Roster import profile update'), preview = $state<Preview|null>(null), rosterOpen = $state(false);
  const visiblePeople = $derived(people.filter(p => (showInactive || p.active) && `${p.displayName} ${p.employeeNumber||''} ${p.department||''}`.toLowerCase().includes(search.toLowerCase())));
  const selected = $derived(people.find(p=>p.id===selectedId));
  const editable = $derived(admin || selectedId === data.actor.personId);
  const siteName = (id:string) => sites.find(s=>s.id===id)?.name || id;
  async function api<T>(url:string, body?:unknown, method='POST'):Promise<T> {
    const response=await fetch(url, body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const value=await response.json();if(!response.ok)throw new Error(value.message||'Request failed');return value;
  }
  function form(person?:PersonProfile) {
    name=person?.displayName||'';employeeNumber=person?.employeeNumber||'';email=person?.email||'';phone=person?.phone||'';
    jobTitle=person?.jobTitle||'';department=person?.department||'';language=person?.language||'en';personType=person?.personType||'employee';
    startDate=person?.startDate||'';active=person?.active??true;siteIds=person?.siteIds||[];reason='';editing=true;
  }
  async function refresh() {
    const [p,s]=await Promise.all([api<{items:PersonProfile[]}>(`/api/people${admin?'?includeInactive=true':''}`),api<{items:Site[]}>('/api/sites')]);
    people=p.items;sites=s.items;
  }
  async function select(id:string) {
    failure='';message='';printed=null;saving=true;
    try {
      const detail=await api<{person:PersonProfile;accounts:Account[];assignments:Assignment[];contextChanges:typeof contextChanges;moodleAccountSync:typeof moodleAccountSync}>(`/api/people/${id}`);
      selectedId=id;form(detail.person);accounts=detail.accounts;assignments=detail.assignments;contextChanges=detail.contextChanges;moodleAccountSync=detail.moodleAccountSync;
      accountRole=accounts[0]?.role||'learner';accountSites=accounts[0]?.siteIds||detail.person.siteIds;accountReason='';
    } catch(cause){failure=(cause as Error).message;}finally{saving=false;}
  }
  function newPerson(){selectedId='';accounts=[];assignments=[];contextChanges=[];moodleAccountSync=null;printed=null;form();failure='';message='';}
  async function save(event:SubmitEvent) {
    event.preventDefault();saving=true;failure='';message='';
    try {
      const value=admin?{displayName:name,employeeNumber:employeeNumber||null,email:email||null,phone:phone||null,jobTitle:jobTitle||null,department:department||null,
        language,personType,startDate:startDate||null,siteIds,active,reason}:{email:email||null,phone:phone||null,language,reason};
      const result=selectedId?await api<{person:PersonProfile}>(`/api/people/${selectedId}`,value,'PATCH'):await api<{id:string}>('/api/people',value);
      const id='id'in result?result.id:selectedId;await refresh();await select(id);message='Profile saved. Existing completion records are preserved.';
    }catch(cause){failure=(cause as Error).message;}finally{saving=false;}
  }
  async function account(action:'invite'|'reset'|'printed'|'grants') {
    saving=true;failure='';message='';printed=null;
    try {
      const result=await api<{delivered:string;username?:string;activationCode?:string;activationUrl?:string;expiresAt:string}>(`/api/people/${selectedId}/account`,{action,role:accountRole,siteIds:accountSites,reason:accountReason});
      await select(selectedId);
      if(result.activationCode)printed={username:result.username!,activationCode:result.activationCode,activationUrl:result.activationUrl!,expiresAt:result.expiresAt};
      message=result.delivered==='email'?'Invitation sent by the identity provider. The link expires in 30 minutes.':result.delivered==='printed'?'Activation code created. The account stays disabled until the worker chooses a password.':'Account access updated.';
    }catch(cause){failure=(cause as Error).message;}finally{saving=false;}
  }
  async function roster(dryRun:boolean) {
    saving=true;failure='';message='';
    try {
      const result=await api<Preview>('/api/people/roster',{csv,dryRun,previewHash:preview?.previewHash,reason:rosterReason});
      preview=result;if(!dryRun){await refresh();message='Roster imported. Missing people remain active. Site and work changes are recorded for training review.';preview=null;}
    }catch(cause){failure=(cause as Error).message;}finally{saving=false;}
  }
  async function upload(event:Event) { const file=(event.target as HTMLInputElement).files?.[0];if(file){csv=await file.text();preview=null;} }
  onMount(async()=>{ready=true;try{await refresh();if(data.actor.personId&&!admin)await select(data.actor.personId);}catch(cause){failure=(cause as Error).message;}finally{loading=false;}});
</script>

<svelte:head><title>{admin?'People and accounts':'My profile'} · HSE Informer</title></svelte:head>
<main>
  <header><div><a class="back" href="/">← Training workspace</a><h1>{admin?'People and accounts':'Profiles'}</h1><p>{data.actor.tenantName} · {data.actor.displayName}</p></div>
    <nav aria-label="Profile actions">{#if data.accountUrl}<a href={data.accountUrl} target="_blank" rel="noreferrer">Password and MFA settings ↗</a>{/if}{#if admin}<button disabled={!ready||loading||saving} onclick={newPerson}>Add person</button><button disabled={!ready||loading||saving} class="secondary" onclick={()=>rosterOpen=!rosterOpen}>Import roster</button>{/if}</nav></header>
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}{#if message}<p class="success" role="status">{message}</p>{/if}
  {#if printed}<section class="print-card"><h2>One-time account activation</h2><p>For {selected?.displayName}. Expires {new Date(printed.expiresAt).toLocaleString()}. Open the activation page, enter this code, and choose a password. Then sign in normally.</p><dl><dt>Activation page</dt><dd><a href={printed.activationUrl}>{printed.activationUrl}</a></dd><dt>Sign-in name</dt><dd>{printed.username}</dd><dt>Activation code</dt><dd class="password">{printed.activationCode}</dd></dl><div class="actions"><button onclick={()=>window.print()}>Print activation details</button><button class="secondary" onclick={()=>printed=null}>Dismiss code</button></div></section>{/if}
  {#if admin&&rosterOpen}<section class="roster"><h2>Roster import</h2><p>Download the <a href="/api/people/roster">CSV template</a>. Site codes: {sites.map(s=>s.code).join(', ')}. A dry run is required before import. Accounts are invited separately.</p>
    <label>CSV file<input type="file" accept=".csv,text/csv" onchange={upload}/></label><label>CSV contents<textarea rows="5" bind:value={csv} oninput={()=>preview=null}></textarea></label>
    <label>Reason<input bind:value={rosterReason} minlength="5" maxlength="500"/></label><div class="actions"><button disabled={saving||!csv} onclick={()=>roster(true)}>Run dry run</button>{#if preview}<button disabled={saving||preview.counts.rejected>0} onclick={()=>roster(false)}>Import reviewed rows</button>{/if}</div>
    {#if preview}<p role="status">{preview.counts.new} new · {preview.counts.changed} changed · {preview.counts.unchanged} unchanged · {preview.counts.rejected} rejected</p><div class="table-scroll"><table><thead><tr><th>CSV row</th><th>Person</th><th>Result</th><th>Details</th></tr></thead><tbody>{#each preview.rows as row}<tr><td>{row.row}</td><td>{row.displayName}</td><td>{row.status}</td><td>{row.errors.join('; ')}</td></tr>{/each}</tbody></table></div><p>{preview.missing.length} existing active people are absent from this file. Nobody will be deleted or deactivated.</p>{#if preview.missing.length}<details><summary>View missing people</summary><ul>{#each preview.missing as p}<li>{p.displayName}</li>{/each}</ul></details>{/if}{/if}
  </section>{/if}
  {#if loading}<p role="status">Loading profiles…</p>{:else}<div class="workspace"><aside><h2>{data.actor.role==='learner'?'My profile':'People'}</h2><label>Find a person<input type="search" bind:value={search}/></label>{#if admin}<label class="check"><input type="checkbox" bind:checked={showInactive}/> Include inactive people</label>{/if}<ul class="people">{#each visiblePeople as person}<li><button class:chosen={person.id===selectedId} onclick={()=>select(person.id)} disabled={saving}><strong>{person.displayName}</strong><span>{person.employeeNumber||person.department||'Profile'}{!person.active?' · Inactive':''}</span></button></li>{/each}</ul>{#if !visiblePeople.length}<p>No matching profiles.</p>{/if}</aside>
  <div class="detail">{#if editing}<section><h2>{selectedId?'Profile details':'New person'}</h2>{#if selectedId}<p class="identity">Stable person ID: {selectedId}</p>{/if}<form onsubmit={save}><div class="fields">
    <label>Name<input bind:value={name} required maxlength="200" disabled={!admin}/></label><label>Employee number<input bind:value={employeeNumber} maxlength="100" disabled={!admin}/></label>
    <label>Contact email<input type="email" bind:value={email} maxlength="254" disabled={!editable}/></label><label>Phone<input type="tel" bind:value={phone} maxlength="50" disabled={!editable}/></label>
    <label>Department<input bind:value={department} maxlength="150" disabled={!admin}/></label><label>Job title<input bind:value={jobTitle} maxlength="150" disabled={!admin}/></label>
    <label>Worker type<select bind:value={personType} disabled={!admin}><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="temporary">Temporary</option></select></label>
    <label>Language code<input bind:value={language} required minlength="2" maxlength="35" disabled={!editable}/></label><label>Start date<input type="date" bind:value={startDate} disabled={!admin}/></label>
  </div><fieldset disabled={!admin}><legend>Sites</legend>{#each sites as site}<label class="check"><input type="checkbox" value={site.id} bind:group={siteIds}/>{site.name}</label>{/each}</fieldset>
    {#if admin&&selectedId}<label class="check"><input type="checkbox" bind:checked={active} disabled={data.actor.personId===selectedId}/> Active profile</label><p>Deactivation disables HSE sign-in, disables the identity account, and queues Moodle suspension. Assignments and completion history are preserved.</p>{#if moodleAccountSync}<p role="status">Moodle account synchronization: {moodleAccountSync.state}. {moodleAccountSync.state==='done'?'The requested Moodle account state has been confirmed.':'Moodle account state has not yet been confirmed. Existing Moodle access may remain until synchronization succeeds.'}</p>{#if moodleAccountSync.lastError}<p class="error">{moodleAccountSync.lastError}</p>{/if}{/if}{/if}
    {#if editable}<label>Reason for change<input bind:value={reason} required minlength="5" maxlength="500"/></label><button type="submit" disabled={saving}>Save profile</button>{/if}</form></section>
    {#if selectedId&&admin}<section><h2>Account access</h2><p class="identity">Login identifier: {selected?.identityEmail}</p>{#if selected?.identityEmailTechnical}<p>This technical identifier links the worker's HSE and Moodle accounts. It is not a contact address, cannot receive email, and stays fixed when contact details change. Use printed one-time access.</p>{:else}<p>The login email stays fixed when contact details change. Invitation and reset links go to this login address.</p>{/if}{#each accounts as a}<p>{a.role.replaceAll('_',' ')} · {a.active?'Active':'Disabled'}{a.invitationExpiresAt&&!a.invitationAcceptedAt?` · Invitation expires ${new Date(a.invitationExpiresAt).toLocaleString()}`:''}</p>{/each}{#if !accounts.length}<p>No identity account yet. Invite this person to create one.</p>{/if}
      <label>Account role<select bind:value={accountRole} disabled={data.actor.role!=='tenant_admin'}>{#each ['learner','site_admin','tenant_admin','hse_reviewer','evaluator','auditor'] as r}<option value={r}>{r.replaceAll('_',' ')}</option>{/each}</select></label>
      {#if data.actor.role==='tenant_admin'}<fieldset><legend>Administrative site grants</legend>{#each sites as site}<label class="check"><input type="checkbox" value={site.id} bind:group={accountSites}/>{site.name}</label>{/each}</fieldset>{/if}
      <label>Reason for account action<input bind:value={accountReason} minlength="5" maxlength="500"/></label><div class="actions"><button disabled={saving||!active||accountReason.trim().length<5||selected?.identityEmailTechnical} onclick={()=>account('invite')}>{accounts.length?'Resend invitation':'Invite by email'}</button><button class="secondary" disabled={saving||!active||accountReason.trim().length<5} onclick={()=>account('printed')}>Create printed activation code</button>{#if accounts.length}<button class="secondary" disabled={saving||!active||accountReason.trim().length<5||selected?.identityEmailTechnical} onclick={()=>account('reset')}>Send password reset</button>{#if data.actor.role==='tenant_admin'}<button class="secondary" disabled={saving||!active||accountReason.trim().length<5} onclick={()=>account('grants')}>Save role and site grants</button>{/if}{/if}</div><p>Administrative roles require multi-factor authentication. Email delivery requires the identity provider's mail service.</p>
    </section>{/if}
    {#if selectedId&&contextChanges.length}<section><h2>Training context review</h2><p>Site or work details have changed. Review applicable training and update assignments manually. Reviewed automatic reevaluation is planned for a later version.</p><ul>{#each contextChanges as change}<li>{new Date(change.occurredAt).toLocaleDateString()} · Pending review · {change.reason}</li>{/each}</ul></section>{/if}
    {#if selectedId}<section><h2>Assignments and completion history</h2><p><a href={`/records?personId=${selectedId}`}>View completion records</a></p>{#if assignments.length}<div class="table-scroll"><table><thead><tr><th>Training</th><th>Site</th><th>Due</th><th>Completion</th></tr></thead><tbody>{#each assignments as a}<tr><td>{a.title}</td><td>{siteName(a.siteId)}</td><td>{new Date(a.dueAt).toLocaleDateString()}</td><td>{a.completedAt?`${new Date(a.completedAt).toLocaleDateString()} · ${a.deliverySource||'recorded'}`:a.cancelledAt?'Cancelled':'Open'}</td></tr>{/each}</tbody></table></div>{:else}<p>No assignments have been recorded.</p>{/if}</section>{/if}
  {:else}<section><h2>Select a profile</h2><p>Review personal information, account access, assignments, and completion history.</p></section>{/if}</div></div>{/if}
</main>

<style>
  :global(body){margin:0;background:#f5f7f9;color:#172b3a;font-family:Inter,system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:24px}h1{font-size:30px;margin:12px 0 4px}h2{font-size:20px;margin:0 0 18px}p{color:#4c6171;line-height:1.6}a{color:#125e7c}nav,.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.workspace{display:grid;grid-template-columns:290px 1fr;gap:24px}.detail{min-width:0}section,aside{background:white;border:1px solid #dbe3e9;border-radius:12px;padding:24px;margin-bottom:20px}aside{align-self:start}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;font-size:14px;font-weight:600}input,select,textarea{padding:10px 12px;border:1px solid #b5c4cf;border-radius:6px;font:inherit;min-width:0}input:disabled,select:disabled{background:#f3f6f8;color:#536776}button{border:1px solid #165b75;background:#165b75;color:white;border-radius:7px;padding:11px 16px;font:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.secondary{background:white;color:#165b75}.check{flex-direction:row;align-items:center;font-weight:400;margin:10px 0}fieldset{border:1px solid #dbe3e9;border-radius:6px;margin:4px 0 18px;padding:12px}.people{list-style:none;padding:0;margin-top:20px}.people li{margin:6px 0}.people button{width:100%;text-align:left;background:white;border:1px solid transparent;color:#172b3a;padding:12px}.people button.chosen{background:#e9f3f6;border-color:#abd0de}.people strong,.people span{display:block}.people span{font-size:12px;margin-top:5px;color:#536776}.identity{font-size:12px;overflow-wrap:anywhere}.error,.success{padding:14px;border-radius:6px}.error{background:#ffe7e5;color:#9b2720}.success{background:#e0f3e9;color:#1a6141}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th,td{border-bottom:1px solid #dbe3e9;padding:12px 8px;vertical-align:top}th{color:#4c6171;font-weight:600}.password{font-family:monospace;font-size:20px;overflow-wrap:anywhere}dd{margin:5px 0 18px}.print-card{border:2px solid #165b75}.back{font-size:14px}@media(max-width:800px){main{padding:16px}header{display:block}nav{margin-top:16px}.workspace{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.people{max-height:250px;overflow:auto}}@media print{header,.workspace,.roster,.error,.success{display:none}.print-card button{display:none}.print-card{border:0}}
</style>
