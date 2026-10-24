<?php
unset($CFG);
global $CFG;
$CFG = new stdClass();
$CFG->dbtype = 'pgsql';
$CFG->dblibrary = 'native';
$CFG->dbhost = getenv('MOODLE_DB_HOST');
$CFG->dbname = getenv('MOODLE_DB_NAME');
$CFG->dbuser = getenv('MOODLE_DB_USER');
$CFG->dbpass = getenv('MOODLE_DB_PASSWORD');
$CFG->prefix = 'mdl_';
$CFG->dboptions = ['dbpersist' => false, 'dbport' => '', 'dbsocket' => false];
$CFG->wwwroot = getenv('MOODLE_WWWROOT');
$CFG->dataroot = '/var/moodledata';
$CFG->admin = 'admin';
$CFG->directorypermissions = 02770;
$CFG->reverseproxy = true;
$CFG->sslproxy = true;
if (getenv('SMTP_HOST')) {
    $CFG->smtphosts = getenv('SMTP_HOST') . ':' . (getenv('SMTP_PORT') ?: '587');
    $CFG->smtpsecure = getenv('SMTP_SSL') === 'true' ? 'ssl' : (getenv('SMTP_STARTTLS') === 'true' ? 'tls' : '');
    $CFG->smtpuser = getenv('SMTP_AUTH') === 'true' ? getenv('SMTP_USER') : '';
    $CFG->smtppass = getenv('SMTP_AUTH') === 'true' ? getenv('SMTP_PASSWORD') : '';
    $CFG->noreplyaddress = getenv('SMTP_FROM');
}
require_once(__DIR__ . '/lib/setup.php');
