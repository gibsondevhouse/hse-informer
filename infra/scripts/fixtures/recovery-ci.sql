-- Private recovery CI only. Every person and tenant is explicitly fictional.
-- No provider account, invitation, enrollment, job, or message is created.
BEGIN;
DO $$
DECLARE
  tenant uuid := gen_random_uuid();
  site uuid := gen_random_uuid();
  person uuid := gen_random_uuid();
  administrator uuid := gen_random_uuid();
  requirement uuid := gen_random_uuid();
  revision uuid := gen_random_uuid();
  course uuid := gen_random_uuid();
  assignment uuid := gen_random_uuid();
  original uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid();
BEGIN
  INSERT INTO tenants (id,slug,name,synthetic)
    VALUES (tenant,'recovery-ci','Fictional recovery CI company',true);
  INSERT INTO sites (id,tenant_id,code,name,state_code)
    VALUES (site,tenant,'recovery-ci','Fictional recovery CI site','GA');
  INSERT INTO people (id,tenant_id,display_name,email,person_type,synthetic)
    VALUES (person,tenant,'Fictional recovery CI learner','learner@recovery.single-host.test','employee',true);
  INSERT INTO person_site_memberships (tenant_id,person_id,site_id) VALUES (tenant,person,site);
  INSERT INTO principals (id,tenant_id,oidc_issuer,oidc_subject,role)
    VALUES (administrator,tenant,'recovery-ci-no-provider','recovery-ci-administrator','tenant_admin');
  INSERT INTO requirements (id,tenant_id,code,title)
    VALUES (requirement,tenant,'recovery-ci','Fictional recovery course');
  INSERT INTO requirement_versions (id,tenant_id,requirement_id,version,legal_status,authority,audience,
    site_overlay_requirement,content_digest,review_status,reviewed_by,reviewed_at,authorization_prerequisites)
    VALUES (revision,tenant,requirement,'ci-1','general_awareness','Synthetic CI only','Synthetic CI only',
      'None',repeat('a',64),'approved','Synthetic CI reviewer',now(),'["knowledge"]');
  UPDATE requirements SET active_version_id=revision WHERE id=requirement;
  INSERT INTO course_versions (id,tenant_id,requirement_version_id,content_id,content_version,title,
    package_sha256,export_format,moodle_course_id,review_status,reviewed_by,reviewed_at)
    VALUES (course,tenant,revision,'recovery-ci','ci-1','Fictional recovery course',repeat('b',64),
      'scorm_1_2',42,'approved','Synthetic CI reviewer',now());
  INSERT INTO assignments (id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,
    course_version_id,reason,trigger_kind,due_at,created_by)
    VALUES (assignment,tenant,person,site,requirement,revision,course,'Synthetic recovery CI record',
      'manual',now()+interval '1 year',administrator);
  INSERT INTO moodle_learning_progress (tenant_id,assignment_id,course_version_id,instance_key,
    moodle_course_id,moodle_user_id,started,course_last_access_at,activities_with_progress,
    tracked_activities,started_attempts,read_started_at,observed_at,source_observation)
    VALUES (tenant,assignment,course,'11111111-2222-4333-8444-555555555555',42,99,true,
      '2020-03-14T09:00:00Z',1,2,2,now(),now(),
      '{"synthetic":true,"courseId":42,"userId":99,"activityStates":[1,0],"startedAttempts":2}');
  INSERT INTO knowledge_evidence (id,tenant_id,assignment_id,course_version_id,moodle_course_id,
    moodle_user_id,moodle_timecompleted,score,attempts,delivery_method,source_payload)
    VALUES (original,tenant,assignment,course,42,99,'2020-03-14T10:00:00Z',85,2,'scorm',
      '{"synthetic":true,"attempts":[{"score":40},{"score":85}]}');
  INSERT INTO knowledge_evidence (id,tenant_id,assignment_id,course_version_id,delivery_source,
    completed_at,delivery_method,source_payload,completion_snapshot)
    VALUES (replacement,tenant,assignment,course,'manual','2020-03-15T10:00:00Z','manual_record',
      '{"synthetic":true}',jsonb_build_object('person',jsonb_build_object('id',person,
        'displayName','Fictional recovery CI learner'),'source','Synthetic corrected instructor certificate'));
  INSERT INTO manual_completion_details (tenant_id,evidence_id,person_id,site_id,source_reference,reason,recorded_by)
    VALUES (tenant,replacement,person,site,'Synthetic recovery CI certificate','Synthetic correction',administrator);
  INSERT INTO completion_record_events (tenant_id,evidence_id,replacement_evidence_id,kind,reason,recorded_by)
    VALUES (tenant,original,replacement,'corrected','Synthetic correction',administrator),
      (tenant,replacement,NULL,'voided','Synthetic withdrawn certificate',administrator);
  INSERT INTO audit_log (tenant_id,actor_principal_id,action,entity_type,entity_id,after_value)
    VALUES (tenant,administrator,'completion.corrected','knowledge_evidence',original,
      jsonb_build_object('replacementId',replacement,'synthetic',true)),
      (tenant,administrator,'completion.voided','knowledge_evidence',replacement,'{"synthetic":true}');
END;
$$;
COMMIT;
