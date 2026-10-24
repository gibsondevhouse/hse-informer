ARG MOODLE_BASE_IMAGE
FROM ${MOODLE_BASE_IMAGE}
COPY integrations/moodle-local/hse_evidence/ /var/www/moodle/public/local/hse_evidence/
COPY infra/beta/single-host/moodle-config.php /var/www/moodle/config.php
COPY infra/beta/single-host/moodle-apache.conf /etc/apache2/sites-available/000-default.conf
COPY infra/beta/single-host/moodle-entrypoint.sh /usr/local/bin/hse-beta-moodle-entrypoint
RUN chmod 0755 /usr/local/bin/hse-beta-moodle-entrypoint \
    && find /var/www/moodle/public/local/hse_evidence -type d -exec chmod 0755 {} \; \
    && find /var/www/moodle/public/local/hse_evidence -type f -exec chmod 0644 {} \; \
    && rm -f /opt/hse/bootstrap-pilot.php /opt/hse/bootstrap-scorm.php
ENTRYPOINT ["hse-beta-moodle-entrypoint"]
CMD ["apache2-foreground"]
