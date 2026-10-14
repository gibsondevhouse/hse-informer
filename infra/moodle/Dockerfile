FROM php:8.3-apache

ARG MOODLE_SHA256=7e5edf110555956571f40e42acffde0eb23681ebebd212a2fec0fe7d795dd511

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl libcurl4-openssl-dev libfreetype6-dev libicu-dev \
        libjpeg62-turbo-dev libonig-dev libpng-dev libpq-dev libsodium-dev \
        libxml2-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" curl exif gd intl mbstring opcache pdo_pgsql pgsql soap sodium zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

# Official Moodle 5.3.0 release package, fixed by its published SHA-256.
# This copies no plugin, theme, or change into Moodle core.
RUN mkdir -p /var/www/moodle /var/moodledata \
    && curl -fsSL "https://download.moodle.org/download.php/direct/stable503/moodle-5.3.tgz" -o /tmp/moodle.tgz \
    && echo "${MOODLE_SHA256}  /tmp/moodle.tgz" | sha256sum -c - \
    && tar -xzf /tmp/moodle.tgz -C /var/www/moodle --strip-components=1 \
    && rm /tmp/moodle.tgz \
    && chown -R root:root /var/www/moodle \
    && chown -R www-data:www-data /var/moodledata

COPY apache.conf /etc/apache2/sites-available/000-default.conf
COPY moodle.ini /usr/local/etc/php/conf.d/moodle.ini
COPY config.php /var/www/moodle/config.php
COPY entrypoint.sh /usr/local/bin/hse-moodle-entrypoint
COPY bootstrap-pilot.php /opt/hse/bootstrap-pilot.php
COPY bootstrap-scorm.php /opt/hse/bootstrap-scorm.php
RUN chmod 0644 /var/www/moodle/config.php \
    && chmod 0644 /opt/hse/bootstrap-pilot.php \
    && chmod 0644 /opt/hse/bootstrap-scorm.php \
    && chmod 0755 /usr/local/bin/hse-moodle-entrypoint

WORKDIR /var/www/moodle
ENTRYPOINT ["hse-moodle-entrypoint"]
CMD ["apache2-foreground"]
