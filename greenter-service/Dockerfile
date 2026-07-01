FROM php:8.2-fpm-alpine

# Extensiones necesarias para Greenter (XML, ZIP, OpenSSL, SOAP)
RUN apk add --no-cache \
    libzip-dev zip libxml2-dev openssl-dev \
    && docker-php-ext-install soap zip dom

# Habilitar OpenSSL legacy provider para certificados SUNAT/RENIEC
# que usan algoritmos RC2/3DES (bloqueados por defecto en OpenSSL 3.x)
RUN printf '[openssl_init]\nproviders = provider_sect\n\n[provider_sect]\ndefault = default_sect\nlegacy = legacy_sect\n\n[default_sect]\nactivate = 1\n\n[legacy_sect]\nactivate = 1\n' \
    > /etc/ssl/openssl_legacy.cnf
ENV OPENSSL_CONF=/etc/ssl/openssl_legacy.cnf

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY . .

EXPOSE 8080

CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
