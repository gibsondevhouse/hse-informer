import { afterEach, describe, expect, it, vi } from 'vitest';
import { keycloakAdmin } from '../src/lib/server/keycloak';
import { mayReadPerson, parseRosterCsv, requireManagePerson } from '../src/lib/server/people';
import { verifiedMfa, type Actor } from '../src/lib/server/auth';

const actor:Actor={id:'actor',tenantId:'tenant',tenantName:'Company',tenantSynthetic:true,personId:'self',displayName:'Admin',role:'site_admin',siteIds:['site-a']};
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('people boundaries and roster parser',()=>{
  it('restricts learner reads and requires every profile site for administrative changes',()=>{
    expect(mayReadPerson({...actor,role:'learner'},{id:'other',siteIds:['site-a']})).toBe(false);
    expect(mayReadPerson({...actor,role:'learner'},{id:'self',siteIds:[]})).toBe(true);
    expect(mayReadPerson(actor,{id:'other',siteIds:['site-b']})).toBe(false);
    expect(()=>requireManagePerson(actor,{siteIds:['site-a','site-b']})).toThrow();
    expect(()=>requireManagePerson(actor,{siteIds:[]})).toThrow();
    expect(()=>requireManagePerson(actor,{siteIds:['site-a']})).not.toThrow();
  });
  it('parses quoted names, commas, embedded newlines, and CRLF without dropping rows',()=>{
    const rows=parseRosterCsv('\uFEFFemployeeNumber,displayName,siteCode\r\n1,"Worker, One",alpha\r\n2,"Worker\nTwo",alpha\r\n');
    expect(rows).toEqual([{employeeNumber:'1',displayName:'Worker, One',siteCode:'alpha'},{employeeNumber:'2',displayName:'Worker\nTwo',siteCode:'alpha'}]);
  });
  it('rejects broken quoting, duplicate headers, missing identity, and mismatched row widths',()=>{
    for(const csv of ['employeeNumber,displayName,siteCode\n1,"Unclosed,alpha',
      'employeeNumber,displayName,siteCode,siteCode\n1,A,a,a','displayName,siteCode\nA,a',
      'employeeNumber,displayName,siteCode\n1,A,a,extra'])expect(()=>parseRosterCsv(csv)).toThrow();
  });
  it('requires proven multiple factors or configured level of assurance',()=>{
    expect(verifiedMfa({amr:['pwd']})).toBe(false);
    expect(verifiedMfa({amr:['hwk']})).toBe(false);
    expect(verifiedMfa({acr:'0'})).toBe(false);
    expect(verifiedMfa({acr:'2'})).toBe(true);
    expect(verifiedMfa({amr:['pwd','otp']})).toBe(true);
    expect(verifiedMfa({amr:['mfa']})).toBe(true);
  });
});
describe('Keycloak account adapter',()=>{
  function configured(){vi.stubEnv('OIDC_ISSUER','https://identity.example/realms/pilot');vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID','hse-admin');vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET','service-secret');vi.stubEnv('OIDC_CLIENT_ID','hse');vi.stubEnv('APP_ORIGIN','https://hse.example');}
  it('fails closed when identity administration is not configured',()=>{
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET','');expect(()=>keycloakAdmin()).toThrow();
  });
  it('maps identities by tenant and stable person ID and requires privileged MFA enrollment',async()=>{
    configured();const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({access_token:'service-token'}))
      .mockResolvedValueOnce(new Response(null,{status:201,headers:{location:'https://identity.example/admin/realms/pilot/users/new-subject'}}));
    const adapter=keycloakAdmin(fetcher);const subject=await adapter.createAccount({tenantId:'tenant-a',personId:'person-a',displayName:'Admin',email:'admin@example.com',role:'tenant_admin'});
    expect(subject).toBe('new-subject');
    const body=JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(body.username).toBe('hse-person-a');expect(body.attributes).toEqual({hse_person_id:['person-a'],hse_tenant_id:['tenant-a'],hse_identity_email_technical:['false']});
    expect(body.requiredActions).toContain('CONFIGURE_TOTP');
  });
  it('never requires email verification for technical identifiers and keeps them unverified',async()=>{
    configured();const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({access_token:'service-token'}))
      .mockResolvedValueOnce(new Response(null,{status:201,headers:{location:'https://identity.example/admin/realms/pilot/users/technical-subject'}}));
    await keycloakAdmin(fetcher).createAccount({tenantId:'tenant-a',personId:'person-a',displayName:'Printed Worker',email:'person-a@tenant-a.login.invalid',technicalEmail:true,role:'learner'});
    const body=JSON.parse(fetcher.mock.calls[1][1]!.body as string);
    expect(body.emailVerified).toBe(false);expect(body.requiredActions).not.toContain('VERIFY_EMAIL');expect(body.attributes.hse_identity_email_technical).toEqual(['true']);
  });
  it('does not report an invitation as sent if the provider rejects mail',async()=>{
    configured();const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({access_token:'service-token'}))
      .mockResolvedValueOnce(new Response(null,{status:500}));
    await expect(keycloakAdmin(fetcher).invite('subject',1800)).rejects.toMatchObject({status:503});
    expect(fetcher.mock.calls[1][0]).toContain('lifespan=1800');
  });
  it('sets a chosen permanent password while preserving the privileged MFA enrollment requirement',async()=>{
    configured();const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({access_token:'service-token'}))
      .mockResolvedValueOnce(new Response(null,{status:204})).mockResolvedValueOnce(Response.json({requiredActions:['UPDATE_PASSWORD','VERIFY_EMAIL','CONFIGURE_TOTP']}))
      .mockResolvedValueOnce(new Response(null,{status:204}));
    await keycloakAdmin(fetcher).setPassword('subject','Chosen password 123!');
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({type:'password',value:'Chosen password 123!',temporary:false});
    expect(JSON.parse(fetcher.mock.calls[3][1]!.body as string).requiredActions).toEqual(['CONFIGURE_TOTP']);
    expect(JSON.parse(fetcher.mock.calls[3][1]!.body as string).emailVerified).toBe(false);
  });
  it('does not call account operations after rejected service credentials',async()=>{
    configured();const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:401}));
    await expect(keycloakAdmin(fetcher).logout('subject')).rejects.toMatchObject({status:503});expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
