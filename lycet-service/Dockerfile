# Lycet — REST API para facturación electrónica SUNAT (Greenter oficial)
# https://github.com/giansalex/lycet
#
# Usa php:8.2-fpm + nginx para evitar problemas de MPM con Apache en Railway.
#
# Variables de entorno requeridas en Railway:
#   API_KEY    — token de autenticación de la API (?token=... en cada request)
#   APP_SECRET — clave secreta de Symfony (cualquier string aleatorio)
#   APP_ENV    — "prod" para producción
#   PORT       — Railway lo inyecta automáticamente

FROM php:8.2-fpm

# Sistema + extensiones PHP
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip nginx libxml2-dev libzip-dev libssl-dev \
        xfonts-75dpi xfonts-base fontconfig libfreetype6 \
        libjpeg62-turbo libxrender1 libxext6 \
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

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Clonar Lycet — limpiar primero para evitar conflictos de build cache de Railway
WORKDIR /var/www
RUN apt-get update && apt-get install -y --no-install-recommends jq \
    && rm -rf /var/lib/apt/lists/*

COPY generate-autoload.php /tmp/generate-autoload.php

RUN rm -rf html /var/www/html \
    && git clone --depth=1 https://github.com/giansalex/lycet.git html \
    && cd html \
    && jq 'del(.scripts["post-install-cmd"]) | del(.scripts["post-update-cmd"])' composer.json > /tmp/c.json \
    && mv /tmp/c.json composer.json \
    && composer install --no-dev --optimize-autoloader --no-interaction \
    && php /tmp/generate-autoload.php

WORKDIR /var/www/html

# Permisos de escritura para php-fpm (corre como www-data):
#   var/  → cache y logs de Symfony
#   data/ → Lycet escribe aquí el certificado PEM y empresas.json de cada empresa.
#           El repo trae data/ como root (git clone corre como root); sin este chown
#           php-fpm NO puede escribir el cert → Greenter firma con un archivo vacío →
#           openssl_get_privatekey('') → "DECODER routines::unsupported" → HTTP 500.
RUN mkdir -p var data && chown -R www-data:www-data /var/www/html/var /var/www/html/data

# Configuración de nginx para Symfony (puerto se inyecta en runtime)
COPY nginx.conf /etc/nginx/sites-available/lycet
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/lycet /etc/nginx/sites-enabled/lycet

# Script de arranque
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
