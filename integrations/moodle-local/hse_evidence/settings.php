<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_hse_evidence', get_string('pluginname', 'local_hse_evidence'));
    $ADMIN->add('localplugins', $settings);
    $settings->add(new admin_setting_configtext('local_hse_evidence/oauthissuerid',
        get_string('oauthissuerid', 'local_hse_evidence'),
        get_string('oauthissuerid_desc', 'local_hse_evidence'), 0, PARAM_INT));
    $settings->add(new admin_setting_configtext('local_hse_evidence/oauthissuerurl',
        get_string('oauthissuerurl', 'local_hse_evidence'),
        get_string('oauthissuerurl_desc', 'local_hse_evidence'), '', PARAM_URL));
}
