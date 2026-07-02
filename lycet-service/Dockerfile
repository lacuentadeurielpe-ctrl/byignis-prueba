# Lycet — REST API para facturación electrónica SUNAT (Greenter oficial)
# https://github.com/giansalex/lycet
#
# Variables de entorno requeridas en Railway:
#   API_KEY    — token de autenticación de la API (?token=... en cada request)
#   APP_SECRET — clave secreta de Symfony (cualquier string aleatorio)
#   APP_ENV    — "prod" para producción
#   PORT       — Railway lo inyecta automáticamente

FROM php:8.2-apache

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libxml2-dev libzip-dev libssl-dev \
        xfonts-75dpi xfonts-base fontconfig libfreetype6 \
        libjpeg62-turbo libxrender1 libxext6 gettext-base \
    && docker-php-ext-install soap zip dom \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# wkhtmltopdf para generación de PDF
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && wget -q https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get install -y ./wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# OpenSSL legacy provider para certificados SUNAT/RENIEC (RC2/3DES)
RUN printf '[openssl_init]\nproviders = provider_sect\n\n[provider_sect]\ndefault = default_sect\nlegacy = legacy_sect\n\n[default_sect]\nactivate = 1\n\n[legacy_sect]\nactivate = 1\n' \
    > /etc/ssl/openssl_lycet.cnf
ENV OPENSSL_CONF=/etc/ssl/openssl_lycet.cnf

# Eliminar cualquier MPM conflictivo y dejar solo mpm_prefork + rewrite
RUN rm -f /etc/apache2/mods-enabled/mpm_event.conf \
          /etc/apache2/mods-enabled/mpm_event.load \
          /etc/apache2/mods-enabled/mpm_worker.conf \
          /etc/apache2/mods-enabled/mpm_worker.load \
    && a2enmod mpm_prefork rewrite

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Clonar Lycet
WORKDIR /var/www/html
RUN git clone --depth=1 https://github.com/giansalex/lycet.git . \
    && composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Apuntar Apache al directorio public de Symfony y habilitar AllowOverride All
# (Symfony usa .htaccess para routing; sin AllowOverride All Apache ignora el archivo
# y retorna 404 para todas las rutas /api/*)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/000-default.conf \
    && printf '\n<Directory /var/www/html/public>\n    AllowOverride All\n    Options -Indexes +FollowSymLinks\n    Require all granted\n</Directory>\n' \
        >> /etc/apache2/sites-available/000-default.conf

# Permisos para var/ (Symfony cache, logs y configs de empresa)
RUN mkdir -p var && chown -R www-data:www-data /var/www/html/var

# Script de arranque: reemplaza PORT en la config de Apache en runtime
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
