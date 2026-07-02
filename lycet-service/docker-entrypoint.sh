#!/bin/sh
PORT=${PORT:-80}

# Sobrescribir ports.conf con el puerto correcto (más robusto que sed)
echo "Listen $PORT" > /etc/apache2/ports.conf

# Actualizar el VirtualHost con el puerto correcto
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost *:$PORT>/" /etc/apache2/sites-available/000-default.conf

exec "$@"
