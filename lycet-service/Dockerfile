# Lycet — REST API para facturación electrónica SUNAT (Greenter oficial)
# https://github.com/giansalex/lycet
#
# Variables de entorno requeridas en Railway:
#   API_KEY   — token de autenticación de la API (?token=... en cada request)
#   PORT      — Railway lo inyecta automáticamente (default 8080)

FROM php:8.2-apache

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libxml2-dev libzip-dev libssl-dev \
        xfonts-75dpi xfonts-base fontconfig libfreetype6 \
        libjpeg62-turbo libpng-dev libxrender1 libxext6 \
    && docker-php-ext-install soap zip dom \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# wkhtmltopdf para generación de PDF (versión estática con QT parches)
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

# Clonar Lycet (Symfony app oficial de Greenter)
WORKDIR /var/www/html
RUN git clone --depth=1 https://github.com/giansalex/lycet.git . \
    && composer install --no-dev --optimize-autoloader --no-interaction

# Apache: apuntar al /public de Symfony
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/*.conf \
        /etc/apache2/sites-available/000-default.conf \
    && a2enmod rewrite

# Permisos de escritura para var/ (cache, logs, configuraciones de empresa)
RUN chown -R www-data:www-data /var/www/html/var

# Railway inyecta PORT; Apache lo escucha
RUN sed -i 's/Listen 80/Listen ${PORT:-80}/' /etc/apache2/ports.conf \
    && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:${PORT:-80}>/' /etc/apache2/sites-available/000-default.conf

EXPOSE 80

CMD ["apache2-foreground"]
