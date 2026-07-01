FROM php:8.2-fpm-alpine

# Extensiones necesarias para Greenter (XML, ZIP, OpenSSL, SOAP)
RUN apk add --no-cache \
    libzip-dev zip libxml2-dev openssl-dev \
    && docker-php-ext-install soap zip dom xml openssl

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY . .

EXPOSE 8080

CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
