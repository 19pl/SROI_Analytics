<?php
declare(strict_types=1);

/**
 * Load the GLOBAL financial-proxy library (organization_id NULL) from a reviewed JSON file.
 * Global entries are read-only in the app, so this is the only way to add or update them.
 *
 *   php bin/load-proxies.php                                   # loads database/proxies/th-2569.json
 *   php bin/load-proxies.php --file=path/to/other.json
 *   php bin/load-proxies.php --dry-run                         # validate + show what would change, write nothing
 *   php bin/load-proxies.php --remove-demo                     # ALSO delete the six unsourced demo entries from bin/seed.php
 *
 * Rules (the library policy in README.md): every entry must carry a source AND its limitations.
 * Entries are matched by name among global entries. Existing entries are updated only if a field differs.
 * Nothing else is touched. --remove-demo is opt-in: outcomes that used a demo entry keep their own proxy_value
 * (outcomes.proxy_id is set to NULL by the foreign key). Back up storage/sroi.sqlite before using it.
 */
require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

const DEMO_PROXY_NAMES = [
    'Annual supplementary tutoring cost avoidance',
    'High school completion incremental lifetime earning proxy',
    'Value of community volunteer time',
    'Healthcare cost avoidance per treated outpatient',
    'Municipal waste diversion and paper recycling value',
    'Unregulated informal debt reduction interest avoidance',
];
const FIELDS = ['definition', 'category', 'unit', 'currency', 'value', 'geography', 'reference_year', 'source', 'source_url', 'limitations'];

function fail(string $msg): never
{
    fwrite(STDERR, "Error: $msg\n");
    exit(1);
}

/** @param list<string> $args @return array<string,string|bool> */
function parseOptions(array $args): array
{
    $opts = [];
    foreach ($args as $a) {
        if (preg_match('/^--([a-z-]+)=(.*)$/s', $a, $m)) {
            $opts[$m[1]] = $m[2];
        } elseif (preg_match('/^--([a-z-]+)$/', $a, $m)) {
            $opts[$m[1]] = true;
        }
    }
    return $opts;
}

/** @param array<string,mixed> $e @return list<string> */
function validateEntry(array $e): array
{
    $err = [];
    foreach (['name', 'category', 'unit', 'source', 'limitations'] as $f) {
        if (!isset($e[$f]) || !is_string($e[$f]) || trim($e[$f]) === '') {
            $err[] = "$f is required";
        }
    }
    if (!isset($e['currency']) || !is_string($e['currency']) || !preg_match('/^[A-Za-z]{3}$/', $e['currency'])) {
        $err[] = 'currency must be a 3-letter code';
    }
    if (!isset($e['value']) || !is_numeric($e['value']) || (float)$e['value'] < 0) {
        $err[] = 'value must be a number >= 0';
    }
    if (isset($e['reference_year']) && $e['reference_year'] !== null && (!is_int($e['reference_year']) || $e['reference_year'] < 1900 || $e['reference_year'] > 2200)) {
        $err[] = 'reference_year must be an integer 1900-2200 or null';
    }
    if (isset($e['source_url']) && $e['source_url'] !== null && !preg_match('#^https?://#i', (string)$e['source_url'])) {
        $err[] = 'source_url must be an http(s) URL or null';
    }
    foreach (['name' => 300, 'definition' => 2000, 'category' => 100, 'unit' => 200, 'geography' => 200, 'source' => 1000, 'source_url' => 1000, 'limitations' => 2000] as $f => $max) {
        if (isset($e[$f]) && is_string($e[$f]) && mb_strlen($e[$f]) > $max) {
            $err[] = "$f is longer than $max characters";
        }
    }
    return $err;
}

$opts = parseOptions(array_slice($argv, 1));
$dry = isset($opts['dry-run']);
$file = is_string($opts['file'] ?? null) ? (string)$opts['file'] : dirname(__DIR__) . '/database/proxies/th-2569.json';
if (!is_file($file)) {
    fail("file not found: $file");
}
try {
    $doc = json_decode((string)file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    fail('invalid JSON: ' . $e->getMessage());
}
$entries = $doc['proxies'] ?? null;
if (!is_array($entries) || $entries === []) {
    fail('the file must contain a non-empty "proxies" array');
}

// Validate everything first: nothing is written if any entry is invalid.
$bad = 0;
$seen = [];
foreach ($entries as $i => $e) {
    $errs = is_array($e) ? validateEntry($e) : ['entry must be an object'];
    $name = is_array($e) ? (string)($e['name'] ?? '') : '';
    if ($name !== '' && isset($seen[$name])) {
        $errs[] = 'duplicate name in file';
    }
    $seen[$name] = true;
    if ($errs !== []) {
        $bad++;
        fwrite(STDERR, sprintf("  #%d %s\n", $i + 1, $name !== '' ? $name : '(no name)'));
        foreach ($errs as $m) {
            fwrite(STDERR, "      - $m\n");
        }
    }
}
if ($bad > 0) {
    fail("$bad invalid entr" . ($bad === 1 ? 'y' : 'ies') . ' - nothing was written');
}

$app = App::fromEnv();
$db = $app->db;
$now = gmdate('Y-m-d\TH:i:s\Z');
$added = $updated = $same = 0;

$apply = function () use ($db, $entries, $dry, $now, &$added, &$updated, &$same): void {
    foreach ($entries as $e) {
        $row = $db->one('SELECT * FROM financial_proxies WHERE organization_id IS NULL AND name = ?', [$e['name']]);
        $data = [];
        foreach (FIELDS as $f) {
            $v = $e[$f] ?? null;
            $data[$f] = $f === 'value' ? (float)$v : ($f === 'currency' ? strtoupper((string)$v) : $v);
        }
        if ($row === null) {
            $added++;
            echo "  + {$e['name']}\n";
            if (!$dry) {
                $db->insert('financial_proxies', $data + ['organization_id' => null, 'name' => $e['name']]);
            }
            continue;
        }
        $changed = [];
        foreach ($data as $f => $v) {
            $old = $row[$f];
            $differs = $f === 'value' ? abs((float)$old - (float)$v) > 1e-9 : ((string)($old ?? '') !== (string)($v ?? ''));
            if ($differs) {
                $changed[] = $f;
            }
        }
        if ($changed === []) {
            $same++;
            continue;
        }
        $updated++;
        echo "  ~ {$e['name']}  (changed: " . implode(', ', $changed) . ")\n";
        if (!$dry) {
            $db->update('financial_proxies', (int)$row['id'], $data + ['updated_at' => $now]);
        }
    }
};

echo ($dry ? '[dry run] ' : '') . 'Loading ' . count($entries) . " proxies from $file\n";
if ($dry) {
    $apply();
} else {
    $db->transaction($apply);
}
echo sprintf("%s%d added, %d updated, %d unchanged.\n", $dry ? '[dry run] would be: ' : '', $added, $updated, $same);

if (isset($opts['remove-demo'])) {
    $in = implode(',', array_fill(0, count(DEMO_PROXY_NAMES), '?'));
    $demo = $db->all("SELECT id, name FROM financial_proxies WHERE organization_id IS NULL AND name IN ($in)", DEMO_PROXY_NAMES);
    echo sprintf("%sDemo entries found: %d\n", $dry ? '[dry run] ' : '', count($demo));
    foreach ($demo as $d) {
        $used = (int)$db->val('SELECT COUNT(*) FROM outcomes WHERE proxy_id = ?', [$d['id']]);
        echo "  - {$d['name']}" . ($used > 0 ? "  (used by $used outcome(s); they keep their own proxy_value)" : '') . "\n";
    }
    if (!$dry && $demo !== []) {
        $db->transaction(function () use ($db, $demo): void {
            foreach ($demo as $d) {
                $db->run('DELETE FROM financial_proxies WHERE id = ?', [$d['id']]);
            }
        });
        echo 'Removed ' . count($demo) . " demo entries.\n";
    }
} else {
    $left = (int)$db->val(
        'SELECT COUNT(*) FROM financial_proxies WHERE organization_id IS NULL AND name IN (' . implode(',', array_fill(0, count(DEMO_PROXY_NAMES), '?')) . ')',
        DEMO_PROXY_NAMES
    );
    if ($left > 0) {
        echo "Note: $left unsourced demo entr" . ($left === 1 ? 'y is' : 'ies are') . " still in the library. Run again with --remove-demo (after backing up storage/sroi.sqlite) to remove them.\n";
    }
}
