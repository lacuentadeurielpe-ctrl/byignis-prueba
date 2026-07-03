<?php
// Genera vendor/autoload_runtime.php si symfony/runtime no lo hizo via Composer plugin.
// Symfony Runtime 5.4 necesita este archivo como proxy hacia vendor/symfony/runtime/autoload_runtime.php.
$target = __DIR__ . '/vendor/autoload_runtime.php';

if (file_exists($target)) {
    echo "vendor/autoload_runtime.php ya existe.\n";
    exit(0);
}

$content = <<<'PHP'
<?php

$_SERVER['APP_RUNTIME_OPTIONS'] = $_SERVER['APP_RUNTIME_OPTIONS'] ?? [];

require_once __DIR__.'/autoload.php';

$app = require_once __DIR__.'/../src/Kernel.php';

return (require_once __DIR__.'/symfony/runtime/autoload_runtime.php')($app);
PHP;

file_put_contents($target, $content . "\n");
echo "vendor/autoload_runtime.php generado manualmente.\n";
