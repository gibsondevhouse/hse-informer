import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSitePermission } from '../lib/server/permissions.ts';

test('site grants and role permissions deny cross-site changes', () => {
  const manager = { role: 'site_manager', siteIds: ['north'] };
  assert.equal(hasSitePermission(manager, 'north', 'read'), true);
  assert.equal(hasSitePermission(manager, 'north', 'manage'), true);
  assert.equal(hasSitePermission(manager, 'north', 'evaluate'), true);
  assert.equal(hasSitePermission(manager, 'river', 'read'), false);
  assert.equal(hasSitePermission(manager, 'river', 'manage'), false);
  assert.equal(hasSitePermission(manager, 'north', 'admin'), false);
  const evaluator = { role: 'evaluator', siteIds: ['river'] };
  assert.equal(hasSitePermission(evaluator, 'river', 'evaluate'), true);
  assert.equal(hasSitePermission(evaluator, 'river', 'manage'), false);
  assert.equal(hasSitePermission({ role: 'auditor', siteIds: ['north'] }, 'north', 'evaluate'), false);
  assert.equal(hasSitePermission({ role: 'admin', siteIds: [] }, 'river', 'admin'), true);
});
