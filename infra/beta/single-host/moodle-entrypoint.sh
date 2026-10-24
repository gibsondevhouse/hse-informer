#!/bin/sh
set -eu
for beta_name in MOODLE_DB_HOST MOODLE_DB_NAME MOODLE_DB_USER MOODLE_DB_PASSWORD MOODLE_WWWROOT MOODLE_ADMIN_USER MOODLE_ADMIN_PASSWORD MOODLE_ADMIN_EMAIL MOODLE_SITE_FULLNAME MOODLE_SITE_SHORTNAME; do
  beta_value=$(printenv "$beta_name" || true)
  if [ -z "$beta_value" ]; then echo "Missing required Moodle setting: $beta_name" >&2; exit 1; fi
done
case "$MOODLE_WWWROOT" in https://*) ;; *) echo 'Moodle requires the configured public HTTPS origin' >&2; exit 1;; esac
case "$MOODLE_ADMIN_EMAIL" in *@*.invalid|*@example.com|*@example.org) echo 'Configure the actual administrator email' >&2; exit 1;; esac
if [ "${#MOODLE_ADMIN_PASSWORD}" -lt 24 ]; then echo 'Use the generated Moodle administrator password' >&2; exit 1; fi
until php -r '
try { new PDO("pgsql:host=".getenv("MOODLE_DB_HOST").";dbname=".getenv("MOODLE_DB_NAME"),getenv("MOODLE_DB_USER"),getenv("MOODLE_DB_PASSWORD")); }
catch (Throwable $error) { exit(1); }'; do sleep 2; done
if ! php -r '
$db=new PDO("pgsql:host=".getenv("MOODLE_DB_HOST").";dbname=".getenv("MOODLE_DB_NAME"),getenv("MOODLE_DB_USER"),getenv("MOODLE_DB_PASSWORD"));
$query=$db->prepare("SELECT count(*) FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=?");
$query->execute(["mdl_config"]);
exit((int)$query->fetchColumn()===1 ? 0 : 1);'; then
  echo 'Initializing the configured Moodle site in its empty database.'
  runuser -u www-data -- php /var/www/moodle/admin/cli/install_database.php \
    --lang=en --agree-license "--adminuser=$MOODLE_ADMIN_USER" "--adminpass=$MOODLE_ADMIN_PASSWORD" \
    "--adminemail=$MOODLE_ADMIN_EMAIL" "--fullname=$MOODLE_SITE_FULLNAME" "--shortname=$MOODLE_SITE_SHORTNAME"
fi
runuser -u www-data -- php /var/www/moodle/admin/cli/upgrade.php --non-interactive
(
  while :; do
    runuser -u www-data -- php /var/www/moodle/admin/cli/cron.php || echo 'Moodle cron failed' >&2
    sleep 60
  done
) &
exec "$@"
