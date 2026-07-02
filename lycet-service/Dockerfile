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
RUN rm -rf html /var/www/html \
    && git clone --depth=1 https://github.com/giansalex/lycet.git html \
    && cd html && composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

WORKDIR /var/www/html

# Permisos para var/ (Symfony cache, logs y configs de empresa)
RUN mkdir -p var && chown -R www-data:www-data /var/www/html/var

# Configuración de nginx para Symfony (puerto se inyecta en runtime)
COPY nginx.conf /etc/nginx/sites-available/lycet
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/lycet /etc/nginx/sites-enabled/lycet

# Script de arranque
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
