import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../src/lib/server/auth';
const mocks=vi.hoisted(()=>({query:vi.fn(),end:vi.fn(),find:vi.fn()}));
vi.mock('../src/lib/server/db',()=>({query:mocks.query}));
vi.mock('../src/lib/server/moodle',()=>({moodleConnection:()=>({instanceId:'instance-a'}),endMoodleUserSessions:mocks.end,findMoodleUserByHseId:mocks.find}));
import { logoutDestination } from '../src/lib/server/logout';
const actor:Actor={id:'principal',tenantId:'company-a',tenantName:'Company A',personId:'person-a',tenantSynthetic:false,displayName:'Worker',role:'learner',siteIds:[]};
beforeEach(()=>{
  vi.stubEnv('DEV_AUTH','');vi.stubEnv('OIDC_ISSUER','https://identity.test/realms/pilot');
  vi.stubEnv('OIDC_CLIENT_ID','hse');vi.stubEnv('APP_ORIGIN','https://portal.test');
  mocks.query.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([{hse_id:'stable-person'}]).mockResolvedValueOnce([{external_id:'17'}]);
  mocks.end.mockReset().mockResolvedValue(undefined);mocks.find.mockReset();
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('coordinated sign-out',()=>{
  it('ends only the authenticated mapped Moodle user and redirects through the configured identity logout',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({issuer:'https://identity.test/realms/pilot',end_session_endpoint:'https://identity.test/logout'})));
    const destination=new URL(await logoutDestination(actor));
    expect(mocks.end).toHaveBeenCalledWith('company-a',17);
    expect(mocks.query.mock.calls[2][1]).toEqual(['company-a','person-a','instance-a']);
    expect(destination.origin).toBe('https://identity.test');
    expect(destination.searchParams.get('post_logout_redirect_uri')).toBe('https://portal.test/signed-out');
    expect(destination.searchParams.get('client_id')).toBe('hse');
  });
  it('keeps explicit warnings when Moodle or identity logout cannot be confirmed',async()=>{
    mocks.end.mockRejectedValue(new Error('Unavailable'));
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Unavailable')));
    const target=new URL(await logoutDestination(actor),'https://portal.test');
    expect(target.pathname).toBe('/signed-out');expect(target.searchParams.get('moodle')).toBe('unconfirmed');expect(target.searchParams.get('identity')).toBe('unconfirmed');
  });
  it('does not send logout to an endpoint outside the configured issuer origin',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({issuer:'https://identity.test/realms/pilot',end_session_endpoint:'https://unexpected.test/logout'})));
    expect(await logoutDestination(actor)).toBe('/signed-out?identity=unconfirmed');
  });
  it('keeps synthetic preview sign-out local',async()=>{
    vi.stubEnv('DEV_AUTH','synthetic');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    expect(await logoutDestination({...actor,tenantSynthetic:true})).toBe('/signed-out');
    expect(mocks.end).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
});
