#!/bin/sh
set -eu

required="MOODLE_DB_HOST MOODLE_DB_NAME MOODLE_DB_USER MOODLE_DB_PASSWORD MOODLE_WWWROOT MOODLE_ADMIN_PASSWORD MOODLE_SITE_FULLNAME MOODLE_SITE_SHORTNAME"
for name in $required; do
    value="$(printenv "$name" || true)"
    if [ -z "$value" ]; then
        echo "Missing required Moodle setting: $name" >&2
        exit 1
    fi
done

until php -r '
try {
    new PDO("pgsql:host=" . getenv("MOODLE_DB_HOST") . ";dbname=" . getenv("MOODLE_DB_NAME"), getenv("MOODLE_DB_USER"), getenv("MOODLE_DB_PASSWORD"));
} catch (Throwable $error) {
    exit(1);
}
'; do
    echo "Waiting for Moodle PostgreSQL database..." >&2
    sleep 2
done

if ! php -r '
$db = new PDO("pgsql:host=" . getenv("MOODLE_DB_HOST") . ";dbname=" . getenv("MOODLE_DB_NAME"), getenv("MOODLE_DB_USER"), getenv("MOODLE_DB_PASSWORD"));
$statement = $db->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?");
$statement->execute(["mdl_config"]);
exit((int) $statement->fetchColumn() === 1 ? 0 : 1);
'; then
    echo "Installing the unmodified Moodle release in an empty development database..." >&2
    runuser -u www-data -- php /var/www/moodle/admin/cli/install_database.php \
        --lang=en \
        --agree-license \
        --adminuser=admin \
        "--adminpass=$MOODLE_ADMIN_PASSWORD" \
        --adminemail=admin@example.invalid \
        "--fullname=$MOODLE_SITE_FULLNAME" \
        "--shortname=$MOODLE_SITE_SHORTNAME"
fi

# Install/upgrade local extensions through Moodle's supported upgrade API.
# Core files stay untouched; the evidence plugin is mounted read-only.
runuser -u www-data -- php /var/www/moodle/admin/cli/upgrade.php --non-interactive

# Moodle requires cron for course and activity completion processing.
(
    while :; do
        runuser -u www-data -- php /var/www/moodle/admin/cli/cron.php || echo "Moodle cron failed" >&2
        sleep 60
    done
) &

exec "$@"
