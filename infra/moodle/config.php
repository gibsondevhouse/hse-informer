<?php
// Local integration fixture only. Values come from the process environment.
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
require_once(__DIR__ . '/lib/setup.php');
